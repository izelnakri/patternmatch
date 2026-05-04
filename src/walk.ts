/**
 * Core dispatch loop. Everything in `src/matchers.ts` ultimately delegates
 * back here when it needs to match a sub-pattern.
 *
 * Hot-path constraints:
 *   - no `try/catch`
 *   - no allocations on success (singleton `OK`)
 *   - mutate the path stack in place (no slicing until a failure escapes)
 *   - dispatch on `typeof` and `instanceof` only — avoid generic `equals`
 */

import type { Infer, MatchContext, MatchFail, MatchResult, Matcher, PathSegment } from './types.ts';
import { MATCHER_BRAND } from './types.ts';

const OK: MatchResult = Object.freeze({ ok: true });

const isObject = (v: unknown): v is object => typeof v === 'object' && v !== null;

export function isMatcher(value: unknown): value is Matcher {
  return isObject(value) && (value as { [MATCHER_BRAND]?: unknown })[MATCHER_BRAND] === true;
}

export function createContext(): MatchContext {
  return { seen: new WeakMap(), bindings: new Map(), path: [] };
}

export function ok(): MatchResult {
  return OK;
}

export function fail(
  ctx: MatchContext,
  reason: string,
  actual: unknown,
  expected: unknown,
  cause?: MatchResult,
): MatchFail {
  return {
    ok: false,
    path: ctx.path.slice(),
    actual,
    expected,
    reason,
    cause: cause && !cause.ok ? cause : undefined,
  };
}

/**
 * Mark `(actual, pattern)` as visited. Returns true if the pair was already
 * seen on this walk — caller should treat as an immediate `ok` to terminate
 * the cycle.
 */
function markSeen(ctx: MatchContext, actual: object, pattern: object): boolean {
  let inner = ctx.seen.get(actual);
  if (inner === undefined) {
    inner = new WeakMap();
    ctx.seen.set(actual, inner);
  } else if (inner.has(pattern)) {
    return true;
  }
  inner.set(pattern, true);
  return false;
}

export function walk(value: unknown, pattern: unknown, ctx: MatchContext): MatchResult {
  // 1. Custom matchers first — fast path, dispatched by symbol.
  if (isMatcher(pattern)) {
    return pattern.test(value, ctx);
  }

  // 2. RegExp — strings only; we do not coerce to avoid surprising behavior.
  if (pattern instanceof RegExp) {
    if (typeof value !== 'string') {
      return fail(ctx, `Expected string matching ${pattern}`, value, pattern);
    }
    return pattern.test(value)
      ? ok()
      : fail(ctx, `String does not match ${pattern}`, value, pattern);
  }

  // 3. null / undefined — strict, never coerced.
  if (pattern === null || pattern === undefined) {
    return value === pattern ? ok() : fail(ctx, `Expected ${String(pattern)}`, value, pattern);
  }

  const pType = typeof pattern;

  // 4. Primitives — SameValue equality so NaN matches NaN.
  if (pType !== 'object' && pType !== 'function') {
    if (value === pattern || (Number.isNaN(value) && Number.isNaN(pattern))) {
      return ok();
    }
    return fail(ctx, 'Values are not equal', value, pattern);
  }

  // 5. Function as a pattern → reference equality. Use M.when for predicates.
  if (pType === 'function') {
    return value === pattern ? ok() : fail(ctx, 'Function references differ', value, pattern);
  }

  // 6. Date — same instant.
  if (pattern instanceof Date) {
    if (!(value instanceof Date)) {
      return fail(ctx, 'Expected Date', value, pattern);
    }
    return value.getTime() === pattern.getTime()
      ? ok()
      : fail(ctx, 'Date instants differ', value, pattern);
  }

  // From here on, the pattern is a plain object or array.
  if (!isObject(value)) {
    return fail(ctx, Array.isArray(pattern) ? 'Expected array' : 'Expected object', value, pattern);
  }

  // 7. Cycle short-circuit — corecursive interpretation.
  if (markSeen(ctx, value, pattern)) return ok();

  // 8. Array → strict tuple match.
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) {
      return fail(ctx, 'Expected array', value, pattern);
    }
    if (value.length !== pattern.length) {
      return fail(
        ctx,
        `Expected array of length ${pattern.length}, got ${value.length}`,
        value,
        pattern,
      );
    }
    for (let i = 0; i < pattern.length; i++) {
      ctx.path.push(i);
      const res = walk(value[i], pattern[i], ctx);
      ctx.path.pop();
      if (!res.ok) return res;
    }
    return ok();
  }

  // 9. Plain object → partial-shape match (extra keys on `value` are fine).
  for (const key of Reflect.ownKeys(pattern)) {
    const subPattern = (pattern as Record<PropertyKey, unknown>)[key];
    const subValue = (value as Record<PropertyKey, unknown>)[key];
    ctx.path.push(key as PathSegment);
    const res = walk(subValue, subPattern, ctx);
    ctx.path.pop();
    if (!res.ok) return res;
  }
  return ok();
}

/** Run `pattern` against `value` and return a structured result. */
export function match(value: unknown, pattern: unknown): MatchResult {
  return walk(value, pattern, createContext());
}

/**
 * Boolean form of {@link match} that doubles as a TypeScript type predicate.
 * On a truthy result, `value` is narrowed to `Infer<typeof pattern>`.
 */
export function isMatch<P>(value: unknown, pattern: P): value is Infer<P> {
  return walk(value, pattern, createContext()).ok;
}
