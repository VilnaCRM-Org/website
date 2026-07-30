import {
  GraphQLError,
  Kind,
  OperationTypeNode,
  getNamedType,
  isInterfaceType,
  isObjectType,
} from 'graphql';
import type {
  ASTVisitor,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLArgument,
  GraphQLField,
  GraphQLNamedType,
  GraphQLSchema,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  ValidationContext,
  ValidationRule,
  ValueNode,
} from 'graphql';

/**
 * Query-cost controls for the local Apollo mock (issue #381, F3).
 *
 * The mock previously shipped no `validationRules` at all: no depth bound, no cost
 * budget, no rate limiting. A single deeply-nested or heavily-aliased document could
 * therefore amplify CPU and memory without bound (OWASP API4:2023 — Unrestricted
 * Resource Consumption). The mock is not deployed, but `CLAUDE.md` / `agents.md`
 * point agents at it as the canonical API shape, so it has to model the control.
 *
 * Two rules are exported, both plain `graphql-js` validation rules so they compose
 * with everything Apollo already runs and need no runtime dependency:
 *
 *   * `createQueryDepthLimitRule` — rejects a document nested deeper than `maxDepth`.
 *   * `createQueryCostLimitRule`  — rejects a document whose static cost estimate
 *     exceeds `maxCost`. Each field costs 1, multiplied by every list bound
 *     (`first` / `last`) in effect above it, so breadth, aliasing and pagination
 *     amplification are all priced.
 *
 * Both expand fragment spreads (with a cycle guard, since `NoFragmentCycles` reports
 * the cycle itself) and both skip introspection meta-fields: introspection is gated
 * separately by `introspectionEnabled` below, and exempting the meta-fields keeps the
 * standard — and legitimately deep — introspection query usable in local development.
 *
 * A real service should price fields from the schema with a cost directive; this is
 * the smallest honest control that actually rejects an over-budget document.
 */

export const DEFAULT_MAX_QUERY_DEPTH = 8;
export const DEFAULT_MAX_QUERY_COST = 500;

/**
 * Assumed page size when a paginated field's bound is not a literal in the document
 * (a variable, or omitted entirely). Deliberately pessimistic: an unbounded list is
 * the expensive case, so it must not price as 1.
 */
export const DEFAULT_LIST_SIZE = 25;

/**
 * Absolute ceiling on how deep either walker will recurse, and the clamp applied to a
 * configured `maxDepth`. Both walkers are recursive, so an unbounded walk over a
 * deeply nested document would overflow the call stack *before* the guard could
 * reject it — the control would become the DoS.
 */
export const MAX_TRAVERSAL_DEPTH = 64;

/**
 * graphql-js parses by recursive descent, so a sufficiently nested document crashes
 * the parser with a RangeError *before* any validation rule runs — no guard here can
 * catch that. `parse` only bounds it when given `maxTokens`, which the server passes
 * through as `parseOptions`.
 *
 * 1000 is generous for what this mock serves: the client's signup mutation is 28
 * tokens and the full introspection query is 183. It caps nesting at roughly 330
 * levels, comfortably inside the parser's stack budget.
 */
export const DEFAULT_MAX_QUERY_TOKENS = 1000;

/** Argument names that bound a list and therefore multiply the subtree below them. */
const LIST_SIZE_ARGUMENTS: readonly string[] = ['first', 'last'];

/**
 * Apollo forces `code: GRAPHQL_VALIDATION_FAILED` onto every validation error, so a
 * guard rejection marks itself with this extension key instead of a custom code.
 * `error-formatting.ts` reads it to decide the message is repo-authored and therefore
 * safe to return verbatim.
 */
export const QUERY_GUARD_EXTENSION = 'queryGuard';

export const QUERY_GUARDS = {
  DEPTH: 'QUERY_DEPTH_LIMIT',
  COST: 'QUERY_COST_LIMIT',
} as const;

export type QueryGuard = (typeof QUERY_GUARDS)[keyof typeof QUERY_GUARDS];

/** Introspection and `__typename` are meta-fields; see the module comment. */
function isMetaField(name: string): boolean {
  return name.startsWith('__');
}

function collectFragments(document: DocumentNode): Map<string, FragmentDefinitionNode> {
  const fragments = new Map<string, FragmentDefinitionNode>();
  document.definitions.forEach(definition => {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  });
  return fragments;
}

function guardError(
  message: string,
  guard: QueryGuard,
  node: OperationDefinitionNode
): GraphQLError {
  return new GraphQLError(message, {
    nodes: [node],
    extensions: {
      [QUERY_GUARD_EXTENSION]: guard,
      http: { status: 400 },
    },
  });
}

interface FragmentWalk {
  fragments: Map<string, FragmentDefinitionNode>;
  /** Fragment names on the current path, so a cyclic spread cannot recurse forever. */
  active: Set<string>;
  /**
   * Neither walker descends past this. Without a bound, measuring a document nested
   * tens of thousands of levels deep would itself blow the call stack *before* the
   * guard could reject it — turning the control into the very DoS it exists to stop.
   */
  maxDepth: number;
}

/** Resolves a spread once, skipping unknown and cyclic fragments. */
function visitFragment<T>(
  walk: FragmentWalk,
  name: string,
  visit: (fragment: FragmentDefinitionNode) => T
): T | undefined {
  const fragment = walk.fragments.get(name);
  if (!fragment || walk.active.has(name)) return undefined;

  walk.active.add(name);
  try {
    return visit(fragment);
  } finally {
    walk.active.delete(name);
  }
}

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

function measureDepth(selectionSet: SelectionSetNode, walk: FragmentWalk, depth: number): number {
  // Once the budget is already blown the answer cannot get smaller, so stop.
  if (depth > walk.maxDepth) return depth;

  return selectionSet.selections.reduce(
    (deepest, selection) => Math.max(deepest, depthOfSelection(selection, walk, depth)),
    depth
  );
}

function depthOfSelection(selection: SelectionNode, walk: FragmentWalk, depth: number): number {
  if (selection.kind === Kind.FIELD) {
    if (isMetaField(selection.name.value)) return depth;
    return selection.selectionSet
      ? measureDepth(selection.selectionSet, walk, depth + 1)
      : depth + 1;
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    return measureDepth(selection.selectionSet, walk, depth);
  }

  return (
    visitFragment(walk, selection.name.value, fragment =>
      measureDepth(fragment.selectionSet, walk, depth)
    ) ?? depth
  );
}

/**
 * Nesting depth of `operation`, saturating at `maxDepth + 1` — the exact depth of an
 * over-budget document is never needed, and computing it is what makes the walk
 * unbounded.
 */
export function measureOperationDepth(
  operation: OperationDefinitionNode,
  document: DocumentNode,
  maxDepth: number = MAX_TRAVERSAL_DEPTH
): number {
  return measureDepth(
    operation.selectionSet,
    { fragments: collectFragments(document), active: new Set<string>(), maxDepth },
    0
  );
}

export function createQueryDepthLimitRule(
  maxDepth: number = DEFAULT_MAX_QUERY_DEPTH
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation: OperationDefinitionNode): void {
      if (measureOperationDepth(operation, context.getDocument(), maxDepth) > maxDepth) {
        context.reportError(
          guardError(
            `Query is too deep: it nests deeper than the maximum of ${maxDepth} levels.`,
            QUERY_GUARDS.DEPTH,
            operation
          )
        );
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

function literalListSize(value: ValueNode): number | undefined {
  if (value.kind === Kind.INT) {
    const parsed = Number.parseInt(value.value, 10);
    return Number.isFinite(parsed) ? Math.max(parsed, 1) : undefined;
  }
  return undefined;
}

function declaresListBound(args: readonly GraphQLArgument[]): boolean {
  return args.some(argument => LIST_SIZE_ARGUMENTS.includes(argument.name));
}

/**
 * How much the subtree below `field` is multiplied. A literal `first` / `last` in the
 * document wins; otherwise a field the schema declares as paginated falls back to
 * `defaultListSize`, and everything else multiplies by 1.
 */
function listMultiplier(
  field: FieldNode,
  definition: GraphQLField<unknown, unknown> | undefined,
  defaultListSize: number
): number {
  const bound = field.arguments?.find(argument =>
    LIST_SIZE_ARGUMENTS.includes(argument.name.value)
  );

  if (bound) {
    return literalListSize(bound.value) ?? defaultListSize;
  }

  return definition && declaresListBound(definition.args) ? defaultListSize : 1;
}

function fieldDefinition(
  parentType: GraphQLNamedType | undefined,
  fieldName: string
): GraphQLField<unknown, unknown> | undefined {
  if (!parentType || !(isObjectType(parentType) || isInterfaceType(parentType))) {
    return undefined;
  }
  return parentType.getFields()[fieldName];
}

function typeCondition(
  schema: GraphQLSchema,
  name: string | undefined,
  fallback: GraphQLNamedType | undefined
): GraphQLNamedType | undefined {
  return name ? (schema.getType(name) ?? fallback) : fallback;
}

interface CostWalk extends FragmentWalk {
  schema: GraphQLSchema;
  defaultListSize: number;
}

function measureCost(
  selectionSet: SelectionSetNode,
  walk: CostWalk,
  multiplier: number,
  parentType: GraphQLNamedType | undefined,
  depth: number
): number {
  // Anything nested this deep is already rejected by the depth guard, so pricing
  // the rest of the subtree buys nothing and would leave this walk unbounded.
  if (depth > walk.maxDepth) return 0;

  return selectionSet.selections.reduce(
    (total, selection) => total + costOfSelection(selection, walk, multiplier, parentType, depth),
    0
  );
}

function costOfSelection(
  selection: SelectionNode,
  walk: CostWalk,
  multiplier: number,
  parentType: GraphQLNamedType | undefined,
  depth: number
): number {
  if (selection.kind === Kind.FIELD) {
    return costOfField(selection, walk, multiplier, parentType, depth);
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    return measureCost(
      selection.selectionSet,
      walk,
      multiplier,
      typeCondition(walk.schema, selection.typeCondition?.name.value, parentType),
      depth
    );
  }

  return (
    visitFragment(walk, selection.name.value, fragment =>
      measureCost(
        fragment.selectionSet,
        walk,
        multiplier,
        typeCondition(walk.schema, fragment.typeCondition.name.value, parentType),
        depth
      )
    ) ?? 0
  );
}

function costOfField(
  field: FieldNode,
  walk: CostWalk,
  multiplier: number,
  parentType: GraphQLNamedType | undefined,
  depth: number
): number {
  if (isMetaField(field.name.value)) return 0;

  const definition = fieldDefinition(parentType, field.name.value);
  if (!field.selectionSet) return multiplier;

  return (
    multiplier +
    measureCost(
      field.selectionSet,
      walk,
      multiplier * listMultiplier(field, definition, walk.defaultListSize),
      definition ? getNamedType(definition.type) : undefined,
      depth + 1
    )
  );
}

function rootType(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode
): GraphQLNamedType | undefined {
  if (operation.operation === OperationTypeNode.MUTATION) {
    return schema.getMutationType() ?? undefined;
  }
  if (operation.operation === OperationTypeNode.SUBSCRIPTION) {
    return schema.getSubscriptionType() ?? undefined;
  }
  return schema.getQueryType() ?? undefined;
}

export function measureOperationCost(
  operation: OperationDefinitionNode,
  document: DocumentNode,
  schema: GraphQLSchema,
  defaultListSize: number = DEFAULT_LIST_SIZE,
  maxDepth: number = MAX_TRAVERSAL_DEPTH
): number {
  return measureCost(
    operation.selectionSet,
    {
      schema,
      fragments: collectFragments(document),
      active: new Set<string>(),
      defaultListSize,
      maxDepth,
    },
    1,
    rootType(schema, operation),
    0
  );
}

export function createQueryCostLimitRule(
  maxCost: number = DEFAULT_MAX_QUERY_COST,
  defaultListSize: number = DEFAULT_LIST_SIZE,
  maxDepth: number = DEFAULT_MAX_QUERY_DEPTH
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation: OperationDefinitionNode): void {
      const cost = measureOperationCost(
        operation,
        context.getDocument(),
        context.getSchema(),
        defaultListSize,
        maxDepth
      );

      if (cost > maxCost) {
        context.reportError(
          guardError(
            `Query is too expensive: estimated cost ${cost} exceeds the maximum of ${maxCost}.`,
            QUERY_GUARDS.COST,
            operation
          )
        );
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Introspection / Sandbox
// ---------------------------------------------------------------------------

/**
 * Introspection and the embedded Apollo Sandbox are local-development affordances.
 * Anywhere else — the compose test stack, a CI runner, anything reachable — they are
 * schema disclosure and an unauthenticated query console, so they stay off.
 */
export function introspectionEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'development';
}

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface QueryGuardLimits {
  maxDepth: number;
  maxCost: number;
  defaultListSize: number;
  /** graphql-js parse limit; see MAX_TRAVERSAL_DEPTH for why parsing is bounded too. */
  maxTokens: number;
}

export function resolveQueryGuardLimits(
  env: Readonly<Record<string, string | undefined>> = process.env
): QueryGuardLimits {
  return {
    // Clamped: the walkers recurse up to maxDepth, so a misconfigured value must not
    // be able to reintroduce an unbounded — and therefore stack-overflowing — walk.
    maxDepth: Math.min(
      positiveIntFromEnv(env.GRAPHQL_MAX_QUERY_DEPTH, DEFAULT_MAX_QUERY_DEPTH),
      MAX_TRAVERSAL_DEPTH
    ),
    maxCost: positiveIntFromEnv(env.GRAPHQL_MAX_QUERY_COST, DEFAULT_MAX_QUERY_COST),
    defaultListSize: positiveIntFromEnv(env.GRAPHQL_DEFAULT_LIST_SIZE, DEFAULT_LIST_SIZE),
    maxTokens: positiveIntFromEnv(env.GRAPHQL_MAX_QUERY_TOKENS, DEFAULT_MAX_QUERY_TOKENS),
  };
}

export function createQueryGuardRules(limits: QueryGuardLimits): ValidationRule[] {
  return [
    createQueryDepthLimitRule(limits.maxDepth),
    createQueryCostLimitRule(limits.maxCost, limits.defaultListSize, limits.maxDepth),
  ];
}
