import {
  Kind,
  OperationTypeNode,
  getNamedType,
  isInterfaceType,
  isObjectType,
  visit,
} from 'graphql';
import type {
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
  ValueNode,
} from 'graphql';

/**
 * The AST walk behind the query guards (issue #381, F3).
 *
 * Depth and cost are two accumulators over one traversal, kept here so
 * `query-guards.ts` is only about the rules and their thresholds.
 *
 * The walk is **iterative and doubly bounded**, because a control that can be made to
 * consume unbounded resources is not a control:
 *
 *   * an explicit stack rather than recursion — a recursive walk descends once per
 *     nesting level, so a deep enough document overflows the call stack inside the
 *     guard, crashing the server instead of rejecting the request;
 *   * a cap on depth *and* on total field visits — the fragment cycle guard only
 *     blocks repeats along the current path, so a document that spreads the same
 *     acyclic fragments repeatedly (`fragment a { ...b ...b }`, chained) expands
 *     exponentially while staying small on the wire.
 *
 * Fragment spreads are expanded; introspection meta-fields and their subtrees are
 * skipped, because introspection is gated separately and the exemption keeps the
 * standard — legitimately deep — introspection query usable in local development.
 */

/**
 * The largest page a paginated field may request, and therefore the size assumed when
 * a bound is not a literal in the document (a variable, or omitted entirely). Making
 * it a real ceiling rather than a guess is what makes the cost estimate sound: without
 * one, `first: $n` prices as the guess while runtime could supply any Int at all. It
 * is enforced by the page-size guards in `query-guards.ts`.
 */
export const DEFAULT_MAX_PAGE_SIZE = 25;

/**
 * Ceiling on how deep the walk descends, and the clamp applied to a configured
 * `maxDepth`. A document past this is rejected by the depth guard regardless, so
 * there is nothing to gain by measuring the rest of it.
 */
export const MAX_TRAVERSAL_DEPTH = 64;

/**
 * Ceiling on how many fields the walk visits. Orders of magnitude above any real
 * operation (the shipped signup mutation visits 7) and far above the default cost
 * budget, so a document that reaches it is over budget by construction.
 */
export const MAX_TRAVERSAL_VISITS = 10_000;

/** Argument names that bound a list and therefore multiply the subtree below them. */
const LIST_SIZE_ARGUMENTS: readonly string[] = ['first', 'last'];

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

export function literalListSize(value: ValueNode): number | undefined {
  if (value.kind === Kind.INT) {
    const parsed = Number.parseInt(value.value, 10);
    return Number.isFinite(parsed) ? Math.max(parsed, 1) : undefined;
  }
  return undefined;
}

/**
 * Every variable used as a `first` / `last` bound anywhere in the document, regardless
 * of which operation uses it. Use `operationPaginationVariables` for a request:
 * rejecting a named request because of a bound in an operation it did not select
 * would be a false positive.
 */
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

export function isListSizeArgument(name: string): boolean {
  return LIST_SIZE_ARGUMENTS.includes(name);
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
  maxDepth: number;
  maxVisits: number;
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
  node: FieldNode;
  depth: number;
  multiplier: number;
}

type OnField = (visited: VisitedField) => void;

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
  onField: OnField
): Frame | undefined {
  if (isMetaField(field.name.value)) return undefined;

  const depth = frame.depth + 1;
  onField({ node: field, depth, multiplier: frame.multiplier });

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
  onField: OnField
): Frame | undefined {
  if (selection.kind === Kind.FIELD) {
    return fieldFrame(selection, frame, options, onField);
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

function walkFields(
  operation: OperationDefinitionNode,
  options: TraversalOptions,
  onField: OnField
): void {
  const active = new Set<string>();
  const parentType = options.schema ? rootType(options.schema, operation) : undefined;
  const stack: Frame[] = [frameOf(operation.selectionSet, 0, 1, parentType, undefined)];

  let visits = 0;
  const record: OnField = visited => {
    visits += 1;
    onField(visited);
  };

  while (stack.length > 0 && visits < options.maxVisits) {
    const frame = stack[stack.length - 1] as Frame;

    if (frame.index >= frame.selections.length) {
      if (frame.fragment !== undefined) active.delete(frame.fragment);
      stack.pop();
    } else {
      const selection = frame.selections[frame.index] as SelectionNode;
      frame.index += 1;

      const child = nextFrame(selection, frame, options, active, record);
      if (child) stack.push(child);
    }
  }
}

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
    {
      fragments: collectFragments(document),
      maxPageSize: DEFAULT_MAX_PAGE_SIZE,
      maxDepth,
      maxVisits: MAX_TRAVERSAL_VISITS,
    },
    field => {
      deepest = Math.max(deepest, field.depth);
    }
  );

  return deepest;
}

export interface CostOptions {
  schema: GraphQLSchema;
  maxPageSize?: number | undefined;
  maxDepth?: number | undefined;
  /**
   * Must stay below `MAX_TRAVERSAL_VISITS`; `resolveQueryGuardLimits` clamps it.
   * A budget at or above the cap could otherwise be "met" by a document the walk
   * simply stopped measuring.
   */
  maxCost?: number | undefined;
}

/**
 * Static cost estimate for `operation`, saturating just past `maxCost`.
 *
 * The visit cap is exact for cost: every visited field adds at least 1, so once more
 * than `maxCost` fields have been counted the budget is already blown and the rest of
 * the document cannot change the verdict.
 */
export function measureOperationCost(
  operation: OperationDefinitionNode,
  document: DocumentNode,
  options: CostOptions
): number {
  const maxCost = Math.min(options.maxCost ?? MAX_TRAVERSAL_VISITS, MAX_TRAVERSAL_VISITS - 1);
  let total = 0;

  walkFields(
    operation,
    {
      fragments: collectFragments(document),
      schema: options.schema,
      maxPageSize: options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE,
      maxDepth: options.maxDepth ?? MAX_TRAVERSAL_DEPTH,
      maxVisits: maxCost + 1,
    },
    field => {
      total += field.multiplier;
    }
  );

  return total;
}

/**
 * The `first` / `last` variables the *resolved* operation actually reaches, following
 * only the fragments it spreads. A request naming one operation must not be rejected
 * because a different operation in the same document paginates.
 */
export function operationPaginationVariables(
  operation: OperationDefinitionNode,
  document: DocumentNode
): string[] {
  const names = new Set<string>();

  walkFields(
    operation,
    {
      fragments: collectFragments(document),
      maxPageSize: DEFAULT_MAX_PAGE_SIZE,
      maxDepth: MAX_TRAVERSAL_DEPTH,
      maxVisits: MAX_TRAVERSAL_VISITS,
    },
    ({ node }) => {
      node.arguments?.forEach(argument => {
        if (
          LIST_SIZE_ARGUMENTS.includes(argument.name.value) &&
          argument.value.kind === Kind.VARIABLE
        ) {
          names.add(argument.value.name.value);
        }
      });
    }
  );

  return [...names];
}
