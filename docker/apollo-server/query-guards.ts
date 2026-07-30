import {
  GraphQLError,
  Kind,
  OperationTypeNode,
  getNamedType,
  isInterfaceType,
  isObjectType,
  visit,
} from 'graphql';
import type {
  ASTNode,
  ASTVisitor,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
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
 * The controls, all built on `graphql-js` and Apollo's own hooks so they compose with
 * everything already running and need no runtime dependency:
 *
 *   * `createQueryDepthLimitRule` — rejects a document nested deeper than `maxDepth`.
 *   * `createQueryCostLimitRule`  — rejects a document whose static cost estimate
 *     exceeds `maxCost`. Each field costs 1, multiplied by every list bound
 *     (`first` / `last`) in effect above it, so breadth, aliasing and pagination
 *     amplification are all priced.
 *   * `createPageSizeLimitRule` / `createPageSizeLimitPlugin` — enforce `maxPageSize`
 *     on literal and variable bounds respectively, which is what makes the cost
 *     estimate an upper bound rather than a guess.
 *   * `resolveQueryGuardLimits().maxTokens` — bounds `parse` itself, since a document
 *     nested deeply enough crashes the parser before any rule can run.
 *
 * Depth and cost share one iterative, explicitly-stacked traversal. It expands fragment
 * spreads (with a cycle guard, since `NoFragmentCycles` reports the cycle itself), skips
 * introspection meta-fields — introspection is gated separately by `introspectionEnabled`
 * below, and the exemption keeps the standard, legitimately deep introspection query
 * usable in local development — and stops at the depth ceiling. Iterative on purpose: a
 * recursive walk descends once per nesting level, so a deep enough document would
 * overflow the stack inside the guard, crashing the server instead of rejecting the
 * request.
 *
 * A real service should price fields from the schema with a cost directive; this is
 * the smallest honest control that actually rejects an over-budget document.
 */

export const DEFAULT_MAX_QUERY_DEPTH = 8;
export const DEFAULT_MAX_QUERY_COST = 500;

/**
 * The largest page a paginated field may request, and therefore the size assumed when
 * a bound is not a literal in the document (a variable, or omitted entirely). Making
 * it a real ceiling rather than a guess is what makes the cost estimate sound: without
 * one, `first: $n` prices as the guess while runtime could supply any Int at all.
 *
 * It is enforced in both places a page size can be decided: `createPageSizeLimitRule`
 * rejects an over-large literal at validation time, and `createPageSizeLimitPlugin`
 * rejects an over-large *variable* at `didResolveOperation`, which is the first point
 * where variable values exist.
 */
export const DEFAULT_MAX_PAGE_SIZE = 25;

/**
 * Absolute ceiling on how deep the traversal descends, and the clamp applied to a
 * configured `maxDepth`. The walk is iterative, so this is about bounding work rather
 * than the call stack: a document past this depth is rejected by the depth guard
 * regardless, so there is nothing to gain by measuring the rest of it.
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
  PAGE_SIZE: 'QUERY_PAGE_SIZE_LIMIT',
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

function guardError(message: string, guard: QueryGuard, node?: ASTNode): GraphQLError {
  return new GraphQLError(message, {
    ...(node ? { nodes: [node] } : {}),
    extensions: {
      [QUERY_GUARD_EXTENSION]: guard,
      // Apollo overrides this with GRAPHQL_VALIDATION_FAILED for a validation rule.
      // It survives on the plugin path, where the alternative is Apollo's default of
      // INTERNAL_SERVER_ERROR — misleading for a rejected request.
      code: 'BAD_USER_INPUT',
      http: { status: 400 },
    },
  });
}

// ---------------------------------------------------------------------------
// Traversal
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
 * document wins; a bound that cannot be read statically prices at `maxPageSize`, which
 * the page-size guards make a genuine ceiling; everything else multiplies by 1.
 */
function listMultiplier(
  field: FieldNode,
  definition: GraphQLField<unknown, unknown> | undefined,
  maxPageSize: number
): number {
  const bound = field.arguments?.find(argument =>
    LIST_SIZE_ARGUMENTS.includes(argument.name.value)
  );

  if (bound) {
    return literalListSize(bound.value) ?? maxPageSize;
  }

  return definition && declaresListBound(definition.args) ? maxPageSize : 1;
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
  schema: GraphQLSchema | undefined,
  name: string | undefined,
  fallback: GraphQLNamedType | undefined
): GraphQLNamedType | undefined {
  if (!schema || !name) return fallback;
  return schema.getType(name) ?? fallback;
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

interface TraversalOptions {
  fragments: Map<string, FragmentDefinitionNode>;
  /** Absent for the depth walk, which needs no type information. */
  schema?: GraphQLSchema | undefined;
  maxPageSize: number;
  /**
   * The walk does not descend past this. A document that deep is rejected by the
   * depth guard anyway, and refusing to go further is what keeps the traversal — and
   * therefore the control itself — bounded.
   */
  maxDepth: number;
}

/** One pending selection set. Frames are pushed and popped on an explicit stack. */
interface Frame {
  selections: readonly SelectionNode[];
  index: number;
  depth: number;
  multiplier: number;
  parentType: GraphQLNamedType | undefined;
  /** Set when the frame came from a spread, so the cycle guard can be released. */
  fragment: string | undefined;
}

/** Each field the walk reaches, with the depth and cost multiplier in effect there. */
interface VisitedField {
  depth: number;
  multiplier: number;
}

function frameOf(
  selectionSet: SelectionSetNode,
  depth: number,
  multiplier: number,
  parentType: GraphQLNamedType | undefined,
  fragment: string | undefined
): Frame {
  return { selections: selectionSet.selections, index: 0, depth, multiplier, parentType, fragment };
}

function fieldFrame(
  field: FieldNode,
  frame: Frame,
  options: TraversalOptions,
  visit: (visited: VisitedField) => void
): Frame | undefined {
  // Introspection meta-fields and their subtrees are exempt; see the module comment.
  if (isMetaField(field.name.value)) return undefined;

  const depth = frame.depth + 1;
  visit({ depth, multiplier: frame.multiplier });

  if (!field.selectionSet || depth > options.maxDepth) return undefined;

  const definition = fieldDefinition(frame.parentType, field.name.value);

  return frameOf(
    field.selectionSet,
    depth,
    frame.multiplier * listMultiplier(field, definition, options.maxPageSize),
    definition ? getNamedType(definition.type) : undefined,
    undefined
  );
}

function spreadFrame(
  spread: FragmentSpreadNode,
  frame: Frame,
  options: TraversalOptions,
  active: Set<string>
): Frame | undefined {
  const name = spread.name.value;
  const fragment = options.fragments.get(name);

  // An unknown fragment is reported by KnownFragmentNames and a cyclic one by
  // NoFragmentCycles; here they simply do not extend the walk.
  if (!fragment || active.has(name)) return undefined;

  active.add(name);

  return frameOf(
    fragment.selectionSet,
    frame.depth,
    frame.multiplier,
    typeCondition(options.schema, fragment.typeCondition.name.value, frame.parentType),
    name
  );
}

function nextFrame(
  selection: SelectionNode,
  frame: Frame,
  options: TraversalOptions,
  active: Set<string>,
  visit: (visited: VisitedField) => void
): Frame | undefined {
  if (selection.kind === Kind.FIELD) {
    return fieldFrame(selection, frame, options, visit);
  }

  if (selection.kind === Kind.INLINE_FRAGMENT) {
    return frameOf(
      selection.selectionSet,
      frame.depth,
      frame.multiplier,
      typeCondition(options.schema, selection.typeCondition?.name.value, frame.parentType),
      undefined
    );
  }

  return spreadFrame(selection, frame, options, active);
}

/**
 * Depth-first walk over every field an operation reaches, expanding fragments.
 *
 * Deliberately iterative. A recursive walk descends once per nesting level, so a
 * document nested deeply enough overflows the call stack *inside the guard* — the
 * control crashing the server instead of rejecting the request. With an explicit
 * stack the traversal costs heap, not stack, and cannot fail that way at all.
 */
function walkFields(
  operation: OperationDefinitionNode,
  options: TraversalOptions,
  visit: (visited: VisitedField) => void
): void {
  const active = new Set<string>();
  const parentType = options.schema ? rootType(options.schema, operation) : undefined;
  const stack: Frame[] = [frameOf(operation.selectionSet, 0, 1, parentType, undefined)];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1] as Frame;

    if (frame.index >= frame.selections.length) {
      if (frame.fragment !== undefined) active.delete(frame.fragment);
      stack.pop();
      continue;
    }

    const selection = frame.selections[frame.index] as SelectionNode;
    frame.index += 1;

    const child = nextFrame(selection, frame, options, active, visit);
    if (child) stack.push(child);
  }
}

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

/**
 * Nesting depth of `operation`, saturating at `maxDepth + 1` — the exact depth of an
 * over-budget document is never needed, and computing it is what would make the walk
 * unbounded.
 */
export function measureOperationDepth(
  operation: OperationDefinitionNode,
  document: DocumentNode,
  maxDepth: number = MAX_TRAVERSAL_DEPTH
): number {
  let deepest = 0;

  walkFields(
    operation,
    { fragments: collectFragments(document), maxPageSize: DEFAULT_MAX_PAGE_SIZE, maxDepth },
    field => {
      deepest = Math.max(deepest, field.depth);
    }
  );

  return deepest;
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

export function measureOperationCost(
  operation: OperationDefinitionNode,
  document: DocumentNode,
  schema: GraphQLSchema,
  maxPageSize: number = DEFAULT_MAX_PAGE_SIZE,
  maxDepth: number = MAX_TRAVERSAL_DEPTH
): number {
  let total = 0;

  walkFields(
    operation,
    { fragments: collectFragments(document), schema, maxPageSize, maxDepth },
    field => {
      total += field.multiplier;
    }
  );

  return total;
}

export function createQueryCostLimitRule(
  maxCost: number = DEFAULT_MAX_QUERY_COST,
  maxPageSize: number = DEFAULT_MAX_PAGE_SIZE,
  maxDepth: number = DEFAULT_MAX_QUERY_DEPTH
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation: OperationDefinitionNode): void {
      const cost = measureOperationCost(
        operation,
        context.getDocument(),
        context.getSchema(),
        maxPageSize,
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
// Page size
// ---------------------------------------------------------------------------

/** Every variable used as a `first` / `last` bound anywhere in the document. */
export function paginationVariables(document: DocumentNode): string[] {
  const names = new Set<string>();

  visit(document, {
    Argument(node) {
      if (LIST_SIZE_ARGUMENTS.includes(node.name.value) && node.value.kind === Kind.VARIABLE) {
        names.add(node.value.name.value);
      }
    },
  });

  return [...names];
}

function pageSizeError(requested: number, maxPageSize: number, node?: ASTNode): GraphQLError {
  return guardError(
    `Page size ${requested} exceeds the maximum of ${maxPageSize}.`,
    QUERY_GUARDS.PAGE_SIZE,
    node
  );
}

/** Rejects a literal `first: 1000`. Visitor-based, so it never recurses. */
export function createPageSizeLimitRule(
  maxPageSize: number = DEFAULT_MAX_PAGE_SIZE
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    Argument(node): void {
      if (!LIST_SIZE_ARGUMENTS.includes(node.name.value)) return;

      const requested = literalListSize(node.value);
      if (requested !== undefined && requested > maxPageSize) {
        context.reportError(pageSizeError(requested, maxPageSize, node));
      }
    },
  });
}

/**
 * The slice of Apollo's request pipeline this plugin needs. Declared structurally
 * rather than imported: `@apollo/server` ships separate CJS and ESM type trees, and
 * this module compiles to CJS while `server.mts` compiles to ESM, so importing the
 * plugin interface here would make the two nominally incompatible.
 */
export interface PageSizeLimitPlugin {
  requestDidStart(): Promise<{
    didResolveOperation(requestContext: {
      document: DocumentNode;
      request: { variables?: Record<string, unknown> | undefined };
    }): Promise<void>;
  }>;
}

/**
 * Closes the gap validation cannot: `users(first: $n)` is priced at `maxPageSize`
 * statically, but nothing stops the request supplying `$n = 100000`. Variable values
 * first exist at `didResolveOperation`, so the ceiling is re-checked there — before
 * execution, which is what makes the static estimate an actual upper bound.
 */
export function createPageSizeLimitPlugin(
  maxPageSize: number = DEFAULT_MAX_PAGE_SIZE
): PageSizeLimitPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ document, request }): Promise<void> {
          const variables: Record<string, unknown> = request.variables ?? {};

          paginationVariables(document).forEach(name => {
            const value = variables[name];
            if (typeof value === 'number' && value > maxPageSize) {
              throw pageSizeError(value, maxPageSize);
            }
          });
        },
      };
    },
  };
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

/**
 * Requires the WHOLE value to be a positive integer. `Number.parseInt` stops at the
 * first non-digit, so `8junk` would otherwise silently configure a limit of 8.
 */
function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  if (!/^\d+$/.test(raw ?? '')) return fallback;

  const parsed = Number.parseInt(raw as string, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface QueryGuardLimits {
  maxDepth: number;
  maxCost: number;
  maxPageSize: number;
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
    maxPageSize: positiveIntFromEnv(env.GRAPHQL_MAX_PAGE_SIZE, DEFAULT_MAX_PAGE_SIZE),
    maxTokens: positiveIntFromEnv(env.GRAPHQL_MAX_QUERY_TOKENS, DEFAULT_MAX_QUERY_TOKENS),
  };
}

export function createQueryGuardRules(limits: QueryGuardLimits): ValidationRule[] {
  return [
    createQueryDepthLimitRule(limits.maxDepth),
    createQueryCostLimitRule(limits.maxCost, limits.maxPageSize, limits.maxDepth),
    createPageSizeLimitRule(limits.maxPageSize),
  ];
}

/** The guards that cannot run as validation rules, because they need request values. */
export function createQueryGuardPlugins(limits: QueryGuardLimits): PageSizeLimitPlugin[] {
  return [createPageSizeLimitPlugin(limits.maxPageSize)];
}
