import { GraphQLError } from 'graphql';
import type {
  ASTNode,
  ASTVisitor,
  DocumentNode,
  OperationDefinitionNode,
  ValidationContext,
  ValidationRule,
} from 'graphql';

import {
  DEFAULT_MAX_PAGE_SIZE,
  MAX_TRAVERSAL_DEPTH,
  isListSizeArgument,
  literalListSize,
  measureOperationCost,
  measureOperationDepth,
  paginationVariables,
} from './query-traversal.js';

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
 * The walk the first two share lives in `query-traversal.ts`; it is iterative and
 * bounded in both depth and total visits, so the guard can never become the DoS.
 *
 * A real service should price fields from the schema with a cost directive; this is
 * the smallest honest control that actually rejects an over-budget document.
 */

export const DEFAULT_MAX_QUERY_DEPTH = 8;
export const DEFAULT_MAX_QUERY_COST = 500;

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

export {
  DEFAULT_MAX_PAGE_SIZE,
  MAX_TRAVERSAL_DEPTH,
  MAX_TRAVERSAL_VISITS,
  measureOperationCost,
  measureOperationDepth,
  paginationVariables,
} from './query-traversal.js';

/**
 * Apollo forces `code: GRAPHQL_VALIDATION_FAILED` onto every validation error, so a
 * guard rejection marks itself with this extension key instead of a custom code.
 * `error-formatting.ts` maps the value to a message it authors itself.
 */
export const QUERY_GUARD_EXTENSION = 'queryGuard';

export const QUERY_GUARDS = {
  DEPTH: 'QUERY_DEPTH_LIMIT',
  COST: 'QUERY_COST_LIMIT',
  PAGE_SIZE: 'QUERY_PAGE_SIZE_LIMIT',
} as const;

export type QueryGuard = (typeof QUERY_GUARDS)[keyof typeof QUERY_GUARDS];

const QUERY_GUARD_VALUES: readonly string[] = Object.values(QUERY_GUARDS);

/** True only for a value this module authored. Used to validate, never to trust. */
export function isQueryGuard(value: unknown): value is QueryGuard {
  return typeof value === 'string' && QUERY_GUARD_VALUES.includes(value);
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
// Depth and cost
// ---------------------------------------------------------------------------

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
        maxDepth,
        maxCost
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
      if (!isListSizeArgument(node.name.value)) return;

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

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

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
  /** graphql-js parse limit; see DEFAULT_MAX_QUERY_TOKENS for why parsing is bounded. */
  maxTokens: number;
}

export function resolveQueryGuardLimits(
  env: Readonly<Record<string, string | undefined>> = process.env
): QueryGuardLimits {
  return {
    // Clamped: the walk descends up to maxDepth, so a misconfigured value must not be
    // able to turn a bounded traversal into an arbitrarily long one.
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
