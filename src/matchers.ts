/**
 * The `M` namespace — every matcher is a pure factory returning a frozen
 * {@link Matcher}. Re-exported as `M` from the package entry.
 *
 * Matchers are values, not control flow. Construct them once and reuse:
 *
 *   const isUser = M.shape({ id: M.string, age: M.gte(18) });
 *   if (isMatch(input, isUser)) { ... }
 */

import type { Infer, MatchContext, MatchFail, MatchResult, Matcher } from './types.ts';
import { MATCHER_BRAND } from './types.ts';
import { fail, ok, walk } from './walk.ts';

function defineMatcher<T = unknown>(
  tag: string,
  test: (value: unknown, ctx: MatchContext) => MatchResult,
): Matcher<T> {
  return { [MATCHER_BRAND]: true, tag, test };
}

// ─── Wildcards ──────────────────────────────────────────────────────────────

export const any: Matcher<unknown> = defineMatcher('any', () => ok());
export const anything = any;

export const never: Matcher<never> = defineMatcher('never', (v, ctx) =>
  fail(ctx, 'M.never always fails', v, 'M.never'),
);

export const defined: Matcher<NonNullable<unknown>> = defineMatcher('defined', (v, ctx) =>
  v !== null && v !== undefined ? ok() : fail(ctx, 'Expected non-nullish value', v, 'M.defined'),
);

export const nullish: Matcher<null | undefined> = defineMatcher('nullish', (v, ctx) =>
  v === null || v === undefined ? ok() : fail(ctx, 'Expected null or undefined', v, 'M.nullish'),
);

// ─── Primitive type predicates ──────────────────────────────────────────────

export const string: Matcher<string> = defineMatcher('string', (v, ctx) =>
  typeof v === 'string' ? ok() : fail(ctx, 'Expected string', v, 'M.string'),
);

export const number: Matcher<number> = defineMatcher('number', (v, ctx) =>
  typeof v === 'number' ? ok() : fail(ctx, 'Expected number', v, 'M.number'),
);

export const boolean: Matcher<boolean> = defineMatcher('boolean', (v, ctx) =>
  typeof v === 'boolean' ? ok() : fail(ctx, 'Expected boolean', v, 'M.boolean'),
);

export const bigint: Matcher<bigint> = defineMatcher('bigint', (v, ctx) =>
  typeof v === 'bigint' ? ok() : fail(ctx, 'Expected bigint', v, 'M.bigint'),
);

export const symbol: Matcher<symbol> = defineMatcher('symbol', (v, ctx) =>
  typeof v === 'symbol' ? ok() : fail(ctx, 'Expected symbol', v, 'M.symbol'),
);

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
// deno-lint-ignore ban-types
export const fn: Matcher<Function> = defineMatcher('fn', (v, ctx) =>
  typeof v === 'function' ? ok() : fail(ctx, 'Expected function', v, 'M.fn'),
);

export const array: Matcher<unknown[]> = defineMatcher('array', (v, ctx) =>
  Array.isArray(v) ? ok() : fail(ctx, 'Expected array', v, 'M.array'),
);

export const object: Matcher<Record<string, unknown>> = defineMatcher('object', (v, ctx) =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? ok()
    : fail(ctx, 'Expected plain object', v, 'M.object'),
);

export const date: Matcher<Date> = defineMatcher('date', (v, ctx) =>
  v instanceof Date ? ok() : fail(ctx, 'Expected Date', v, 'M.date'),
);

// ─── Numeric comparisons ────────────────────────────────────────────────────

export const gt = (n: number): Matcher<number> =>
  defineMatcher(`gt(${n})`, (v, ctx) =>
    typeof v === 'number' && v > n ? ok() : fail(ctx, `Expected number > ${n}`, v, `M.gt(${n})`),
  );

export const gte = (n: number): Matcher<number> =>
  defineMatcher(`gte(${n})`, (v, ctx) =>
    typeof v === 'number' && v >= n ? ok() : fail(ctx, `Expected number >= ${n}`, v, `M.gte(${n})`),
  );

export const lt = (n: number): Matcher<number> =>
  defineMatcher(`lt(${n})`, (v, ctx) =>
    typeof v === 'number' && v < n ? ok() : fail(ctx, `Expected number < ${n}`, v, `M.lt(${n})`),
  );

export const lte = (n: number): Matcher<number> =>
  defineMatcher(`lte(${n})`, (v, ctx) =>
    typeof v === 'number' && v <= n ? ok() : fail(ctx, `Expected number <= ${n}`, v, `M.lte(${n})`),
  );

export const between = (min: number, max: number): Matcher<number> =>
  defineMatcher(`between(${min}, ${max})`, (v, ctx) =>
    typeof v === 'number' && v >= min && v <= max
      ? ok()
      : fail(ctx, `Expected number in [${min}, ${max}]`, v, `M.between(${min}, ${max})`),
  );

// ─── String predicates ──────────────────────────────────────────────────────

export const startsWith = (prefix: string): Matcher<string> => {
  const tag = `startsWith(${JSON.stringify(prefix)})`;
  return defineMatcher(tag, (v, ctx) =>
    typeof v === 'string' && v.startsWith(prefix)
      ? ok()
      : fail(ctx, `Expected string starting with ${JSON.stringify(prefix)}`, v, `M.${tag}`),
  );
};

export const endsWith = (suffix: string): Matcher<string> => {
  const tag = `endsWith(${JSON.stringify(suffix)})`;
  return defineMatcher(tag, (v, ctx) =>
    typeof v === 'string' && v.endsWith(suffix)
      ? ok()
      : fail(ctx, `Expected string ending with ${JSON.stringify(suffix)}`, v, `M.${tag}`),
  );
};

export const regex = (re: RegExp): Matcher<string> =>
  defineMatcher(`regex(${re})`, (v, ctx) =>
    typeof v === 'string' && re.test(v)
      ? ok()
      : fail(ctx, `String does not match ${re}`, v, `M.regex(${re})`),
  );

/**
 * Length check for strings, arrays, typed arrays, or any value with a
 * numeric `.length` property. Pass a number for exact length, or
 * `{ min, max }` for a range (either bound optional).
 */
export const length = (
  spec: number | { readonly min?: number; readonly max?: number },
): Matcher<{ readonly length: number }> => {
  const tag = typeof spec === 'number' ? `length(${spec})` : `length(${JSON.stringify(spec)})`;
  return defineMatcher(tag, (v, ctx) => {
    if (v == null || typeof (v as { length?: unknown }).length !== 'number') {
      return fail(ctx, 'Expected value with numeric .length', v, `M.${tag}`);
    }
    const len = (v as { length: number }).length;
    if (typeof spec === 'number') {
      return len === spec
        ? ok()
        : fail(ctx, `Expected .length === ${spec}, got ${len}`, v, `M.${tag}`);
    }
    if (spec.min !== undefined && len < spec.min) {
      return fail(ctx, `Expected .length >= ${spec.min}, got ${len}`, v, `M.${tag}`);
    }
    if (spec.max !== undefined && len > spec.max) {
      return fail(ctx, `Expected .length <= ${spec.max}, got ${len}`, v, `M.${tag}`);
    }
    return ok();
  });
};

// ─── Container membership ───────────────────────────────────────────────────

/** Element-of-array OR substring-of-string check. */
export const includes = <T>(needle: T): Matcher<string | readonly T[]> => {
  const label = typeof needle === 'string' ? JSON.stringify(needle) : String(needle);
  const tag = `includes(${label})`;
  return defineMatcher(tag, (v, ctx) => {
    if (typeof v === 'string') {
      return typeof needle === 'string' && v.includes(needle)
        ? ok()
        : fail(ctx, `String missing substring ${label}`, v, `M.${tag}`);
    }
    if (Array.isArray(v)) {
      return v.includes(needle) ? ok() : fail(ctx, `Array missing element ${label}`, v, `M.${tag}`);
    }
    return fail(ctx, 'Expected string or array', v, `M.${tag}`);
  });
};

// ─── Class / instance ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// deno-lint-ignore no-explicit-any
export const instanceOf = <C extends abstract new (...a: any) => any>(
  Ctor: C,
): Matcher<InstanceType<C>> => {
  const name = Ctor.name || 'AnonymousClass';
  return defineMatcher(`instanceOf(${name})`, (v, ctx) =>
    v instanceof Ctor
      ? ok()
      : fail(ctx, `Expected instance of ${name}`, v, `M.instanceOf(${name})`),
  );
};

// ─── Structural ─────────────────────────────────────────────────────────────

/** Partial object match — every key of `shape` must be present and match. Extra keys allowed. */
export function shape<S extends Record<string, unknown>>(
  shape: S,
): Matcher<{ [K in keyof S]: Infer<S[K]> }> {
  return defineMatcher('shape', (value, ctx) => walk(value, shape, ctx));
}

/** Strict object match — same keys, no extras, no missing. */
export function exact<S extends Record<string, unknown>>(
  shape: S,
): Matcher<{ [K in keyof S]: Infer<S[K]> }> {
  const expectedKeys = new Set(Object.keys(shape));
  return defineMatcher('exact', (value, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(ctx, 'Expected plain object', value, shape);
    }
    for (const k of Object.keys(value as object)) {
      if (!expectedKeys.has(k)) return fail(ctx, `Unexpected key "${k}"`, value, shape);
    }
    for (const k of expectedKeys) {
      if (!(k in (value as object))) return fail(ctx, `Missing key "${k}"`, value, shape);
    }
    return walk(value, shape, ctx);
  });
}

/** Strict positional/length array match. Equivalent to passing an array literal. */
export function tuple<P extends readonly unknown[]>(
  parts: P,
): Matcher<{ -readonly [I in keyof P]: Infer<P[I]> }> {
  return defineMatcher('tuple', (value, ctx) => walk(value, parts, ctx));
}

/** Every array element must match the given pattern. */
export function arrayOf<P>(itemPattern: P): Matcher<Infer<P>[]> {
  return defineMatcher('arrayOf', (value, ctx) => {
    if (!Array.isArray(value)) return fail(ctx, 'Expected array', value, 'M.arrayOf(...)');
    for (let i = 0; i < value.length; i++) {
      ctx.path.push(i);
      const res = walk(value[i], itemPattern, ctx);
      ctx.path.pop();
      if (!res.ok) return res;
    }
    return ok();
  });
}

export function setOf<P>(itemPattern: P): Matcher<Set<Infer<P>>> {
  return defineMatcher('setOf', (value, ctx) => {
    if (!(value instanceof Set)) return fail(ctx, 'Expected Set', value, 'M.setOf(...)');
    let i = 0;
    for (const item of value) {
      ctx.path.push(i++);
      const res = walk(item, itemPattern, ctx);
      ctx.path.pop();
      if (!res.ok) return res;
    }
    return ok();
  });
}

export function mapOf<KP, VP>(
  keyPattern: KP,
  valuePattern: VP,
): Matcher<Map<Infer<KP>, Infer<VP>>> {
  return defineMatcher('mapOf', (value, ctx) => {
    if (!(value instanceof Map)) return fail(ctx, 'Expected Map', value, 'M.mapOf(...)');
    let i = 0;
    for (const [k, v] of value) {
      const keySeg =
        typeof k === 'string' || typeof k === 'number' || typeof k === 'symbol'
          ? k
          : `<entry ${i}>`;
      ctx.path.push(keySeg);
      const kr = walk(k, keyPattern, ctx);
      if (!kr.ok) {
        ctx.path.pop();
        return kr;
      }
      const vr = walk(v, valuePattern, ctx);
      ctx.path.pop();
      if (!vr.ok) return vr;
      i++;
    }
    return ok();
  });
}

/** Every own enumerable string-keyed property of an object must match. */
export function recordOf<KP, VP>(
  keyPattern: KP,
  valuePattern: VP,
): Matcher<Record<string, Infer<VP>>> {
  return defineMatcher('recordOf', (value, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(ctx, 'Expected plain object', value, 'M.recordOf(...)');
    }
    for (const [k, v] of Object.entries(value as object)) {
      ctx.path.push(k);
      const kr = walk(k, keyPattern, ctx);
      if (!kr.ok) {
        ctx.path.pop();
        return kr;
      }
      const vr = walk(v, valuePattern, ctx);
      ctx.path.pop();
      if (!vr.ok) return vr;
    }
    return ok();
  });
}

// ─── Combinators ────────────────────────────────────────────────────────────

export function union<P extends readonly unknown[]>(
  ...patterns: P
): Matcher<{ [I in keyof P]: Infer<P[I]> }[number]> {
  return defineMatcher('union', (value, ctx) => {
    let lastFail: MatchFail | undefined;
    for (const p of patterns) {
      const res = walk(value, p, ctx);
      if (res.ok) return res;
      lastFail = res;
    }
    return fail(ctx, 'No union branch matched', value, 'M.union(...)', lastFail);
  });
}
export const oneOf = union;

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export function intersection<P extends readonly unknown[]>(
  ...patterns: P
): Matcher<UnionToIntersection<{ [I in keyof P]: Infer<P[I]> }[number]>> {
  return defineMatcher('intersection', (value, ctx) => {
    for (const p of patterns) {
      const res = walk(value, p, ctx);
      if (!res.ok) return res;
    }
    return ok();
  });
}
export const allOf = intersection;

export function not<P>(pattern: P): Matcher<unknown> {
  return defineMatcher('not', (value, ctx) => {
    const res = walk(value, pattern, ctx);
    return res.ok ? fail(ctx, 'Expected pattern NOT to match', value, 'M.not(...)') : ok();
  });
}

/** Matches if the property is missing/`undefined` or the inner pattern matches. */
export function optional<P>(pattern: P): Matcher<Infer<P> | undefined> {
  return defineMatcher('optional', (value, ctx) =>
    value === undefined ? ok() : walk(value, pattern, ctx),
  );
}

// ─── Custom predicates / explicit semantics ─────────────────────────────────

/** Arbitrary predicate matcher. Use this to escape the structural defaults. */
export function when<T = unknown>(
  predicate: (value: unknown) => boolean,
  message?: string,
): Matcher<T> {
  return defineMatcher('when', (value, ctx) =>
    predicate(value)
      ? ok()
      : fail(ctx, message ?? 'Predicate returned false', value, 'M.when(...)'),
  );
}
export const satisfies = when;

/** Strict structural equality — bypass partial-shape semantics for this subtree. */
export function deepEqual<T>(expected: T): Matcher<T> {
  return defineMatcher('deepEqual', (value, ctx) =>
    deepEq(value, expected) ? ok() : fail(ctx, 'Values are not deeply equal', value, expected),
  );
}

/** Defer pattern construction — required for self-referential / recursive patterns. */
export function lazy<P>(thunk: () => P): Matcher<Infer<P>> {
  let cached: P | undefined;
  return defineMatcher('lazy', (value, ctx) => {
    if (cached === undefined) cached = thunk();
    return walk(value, cached, ctx);
  });
}

// Self-contained deep-equality helper used only by `deepEqual`. It does not
// handle cycles — callers can wrap with `M.lazy` if they need that.
function deepEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (a instanceof Date) return b instanceof Date && a.getTime() === b.getTime();
  if (a instanceof RegExp) {
    return b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.hasOwn(b as object, k)) return false;
    if (!deepEq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}
