/**
 * Public type surface for patternmatch.
 *
 * The runtime is intentionally tiny — almost everything here is type-only,
 * with the single exception of `MATCHER_BRAND`, the well-known symbol used
 * to identify objects that participate in pattern matching.
 */

/**
 * Well-known symbol identifying a value as a {@link Matcher}. Any object that
 * carries `[MATCHER_BRAND]: true` and a `test` method will be dispatched as
 * a matcher by `walk`. This is the public protocol — third-party libraries
 * (Zod, Valibot, Effect, …) can implement it to interop without a wrapper.
 */
export const MATCHER_BRAND: unique symbol = Symbol.for('patternmatch.matcher');

/** A path segment produced when descending into nested values. */
export type PathSegment = string | number | symbol;

/** A successful match. Singleton — never carries data. */
export interface MatchOk {
  readonly ok: true;
}

/** A failed match. Carries enough context to render a precise diff. */
export interface MatchFail {
  readonly ok: false;
  /** Path from the root value to the failing node, e.g. `["users", 0, "email"]`. */
  readonly path: readonly PathSegment[];
  /** Value found at `path`. */
  readonly actual: unknown;
  /** Pattern (or pattern fragment) that was expected at `path`. */
  readonly expected: unknown;
  /** Short human-readable explanation. */
  readonly reason: string;
  /** Underlying failure when wrapped by a higher-level combinator (e.g. `M.union`). */
  readonly cause?: MatchFail;
}

export type MatchResult = MatchOk | MatchFail;

/**
 * Per-walk state. Lives only for the duration of a single `match()` call.
 *
 * - `seen`  — co-recursive cycle table; once a `(value, pattern)` pair is
 *             encountered it is treated as already-matched on re-entry, which
 *             is the standard interpretation for self-referential structures.
 * - `bindings` — name table populated by `M.bind(name, ...)` and consumed by
 *                `M.ref(name)`; supports cross-field equality assertions.
 * - `path`  — mutable stack pushed/popped during descent. Slicing on failure
 *             keeps the hot path allocation-free.
 */
export interface MatchContext {
  readonly seen: WeakMap<object, WeakMap<object, true>>;
  readonly bindings: Map<string | symbol, unknown>;
  readonly path: PathSegment[];
}

/**
 * A pattern matcher. Created once via the `M` namespace, then reused.
 *
 * The phantom `_T` field is type-only and exists solely so that `Infer<>`
 * can recover the value type a matcher accepts.
 */
export interface Matcher<out T = unknown> {
  readonly [MATCHER_BRAND]: true;
  /** Diagnostic label — appears in failure messages. */
  readonly tag: string;
  test(value: unknown, ctx: MatchContext): MatchResult;
  /** Phantom — never present at runtime. */
  readonly _T?: T;
}

/**
 * Anything `match()` and `isMatch()` accept as a pattern.
 *
 * Default semantics for non-matcher values:
 *   • plain object   → partial-shape match (every pattern key must match;
 *                      extra keys on the value are ignored)
 *   • array          → strict tuple match (length and positions must agree)
 *   • RegExp         → matches strings the regex accepts
 *   • Date           → matches Dates with the same instant
 *   • function       → strict reference equality (use `M.when` for predicates)
 *   • null/undefined → strict equality (no `==` coercion)
 *   • other primitives → SameValue-like equality (NaN matches NaN)
 *
 * Use `M.exact`, `M.tuple`, `M.arrayOf`, `M.deepEqual`, … to opt out of
 * the defaults when the assertion needs different semantics.
 */
export type Pattern<T = unknown> = unknown extends T ? unknown : Matcher<T> | T;

/**
 * Recover the value type a pattern accepts. Drives type narrowing for
 * `isMatch(value, pattern)`, which acts as a `value is Infer<typeof pattern>`
 * type predicate.
 */
export type Infer<P> =
  P extends Matcher<infer T>
    ? T
    : P extends RegExp
      ? string
      : P extends Date
        ? Date
        : P extends readonly [...infer Tup]
          ? { -readonly [I in keyof Tup]: Infer<Tup[I]> }
          : P extends ReadonlyArray<infer U>
            ? Infer<U>[]
            : // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
              // deno-lint-ignore ban-types
              P extends Function
              ? P
              : P extends object
                ? { -readonly [K in keyof P]: Infer<P[K]> }
                : P;
