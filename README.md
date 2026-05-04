# patternmatch

> Pattern matching for JavaScript and TypeScript — designed for assertions and runtime guards. Universal: Node.js, Deno, browsers. Zero dependencies.

```ts
import { match, isMatch, M, formatMatchFailure } from '@izelnakri/patternmatch';

const result = match(user, {
  id: M.string,
  email: /@/,
  age: M.gte(18),
  friends: M.arrayOf({ id: M.string }),
  createdAt: M.date,
});

if (!result.ok) {
  console.error(formatMatchFailure(result));
  // → String does not match /@/ at email
  //     Expected: /@/
  //     Actual:   "not-an-email"
}
```

## Status

Alpha. API will change before 1.0. The intended consumer is [`qunitx`](https://github.com/izelnakri/qunitx) for its `assert.match` API, but `patternmatch` is a standalone library with no test-runner dependencies.

## Why another pattern-matching library?

The TypeScript ecosystem already has several pattern-matching tools, but each is built around a different goal:

| Library                                                                | Goal                                | Returns           | Default object semantics | Diff output    | Bundle |
| ---------------------------------------------------------------------- | ----------------------------------- | ----------------- | ------------------------ | -------------- | ------ |
| [`ts-pattern`](https://github.com/gvergnaud/ts-pattern)                | Exhaustive control flow             | `match(...).with(...).exhaustive()` → handler value | strict on objects        | none           | ~5 kB  |
| [`match-iz`](https://github.com/shuckster/match-iz)                    | TC39-proposal mimic                 | `match(...)(when(...))` → handler value             | strict                   | none           | tiny   |
| [`@core/match`](https://github.com/jsr-core/match)                     | Structured binding + validation     | bound values OR `undefined`                          | strict                   | none           | tiny   |
| [`Effect/Match`](https://effect.website/docs/code-style/pattern-matching) | Discriminated unions in Effect      | handler value                                       | tag-based                | none           | (large; part of Effect) |
| [`lodash-match-pattern`](https://github.com/mjhm/lodash-match-pattern) | JSON API testing                    | `null` or error string                               | strict, opt-out via `...` DSL | string  | medium |
| [`chai-match-pattern`](https://www.chaijs.com/plugins/chai-match-pattern/) | Wraps lodash-match-pattern for chai | chai assertion                                       | inherited                | string  | medium |
| [`assert-match`](https://www.npmjs.com/package/assert-match)           | Asserting against matcher trees     | throws                                              | strict                   | basic   | tiny   |
| **`patternmatch`**                                                     | **Assertions + runtime guards**     | **`MatchResult` (`{ ok, path, expected, actual, reason }`)** | **partial-by-default**   | **structured + path** | **target ≤ 4 kB** |

`patternmatch` is an *assertion-first* library. The control-flow-first design of `ts-pattern` is intentionally different — it solves a different problem (exhaustive case analysis on discriminated unions). For test assertions you want:

1. Partial-by-default object matching (frameworks add fields you don't care about).
2. Path-aware error reporting (`at users[0].email` is the difference between a 5-second debug and a 5-minute debug).
3. A pattern-as-data design where matchers are values you can compose, store, and pass around — no builder API.
4. A predicate form (`isMatch(value, pattern): value is Infer<typeof pattern>`) that doubles as a TypeScript type guard.

If you're building a switch-style state machine, reach for `ts-pattern`. If you're asserting that an arbitrary in-memory object satisfies an ad-hoc shape (testing, validating webhook payloads, gating runtime data), reach for `patternmatch`.

## Quick start

```bash
npm install @izelnakri/patternmatch
# or: deno add jsr:@izelnakri/patternmatch
```

```ts
import { match, isMatch, M } from '@izelnakri/patternmatch';

// Boolean form — also a type predicate.
isMatch(value, { id: M.string, email: /@/ });

// Structured form — for diff output.
const result = match(value, { id: M.string });
if (!result.ok) {
  result.path;     // ['id']
  result.expected; // M.string matcher
  result.actual;   // whatever was at .id
  result.reason;   // 'Expected string'
}
```

## Default semantics

| Pattern type      | What it matches                                                   |
| ----------------- | ----------------------------------------------------------------- |
| primitive         | strict equality (`NaN` matches `NaN` — SameValue)                  |
| `null`/`undefined`| strict equality (no `==` coercion)                                |
| `RegExp`          | strings the regex accepts (no coercion of non-strings)            |
| `Date`            | another `Date` with the same instant                              |
| function          | strict reference equality (use `M.when` for predicate semantics)  |
| `[…]` literal     | strict tuple — same length, same positions                        |
| `{ … }` literal   | **partial shape** — every pattern key must match; extras allowed  |
| `Matcher`         | delegates to `matcher.test`                                       |

Use `M.exact`, `M.tuple`, `M.arrayOf`, `M.deepEqual`, etc. to override.

## Matcher reference

```
Wildcards     : M.any  M.anything  M.never  M.defined  M.nullish
Type guards   : M.string  M.number  M.boolean  M.bigint  M.symbol
                M.fn  M.array  M.object  M.date
Numeric       : M.gt(n)  M.gte(n)  M.lt(n)  M.lte(n)  M.between(min, max)
Strings       : M.regex(re)  M.startsWith(s)  M.endsWith(s)
Sized         : M.length(n | { min, max })  M.includes(needle)
Class         : M.instanceOf(Class)
Structural    : M.shape({…})  M.exact({…})  M.tuple([…])
                M.arrayOf(p)  M.setOf(p)  M.mapOf(k, v)  M.recordOf(k, v)
Combinators   : M.union(...)  M.oneOf(...)  M.intersection(...)  M.allOf(...)
                M.not(p)  M.optional(p)
Custom        : M.when(predicate, message?)  M.satisfies(predicate)
                M.deepEqual(value)  M.lazy(() => pattern)
```

Each matcher carries a `tag` for diagnostics and the `[MATCHER_BRAND]` symbol — third-party validators (Zod, Valibot, …) can implement the same shape to interoperate without a wrapper.

## Cycle handling

Self-referential values are matched co-recursively — once a `(value, pattern)` pair has been visited it is treated as already matching. This is the standard interpretation for recursive structures and avoids infinite loops without a depth limit.

```ts
const a: any = { id: 1 }; a.self = a;
const p: any = { id: 1 }; p.self = p;
isMatch(a, p); // true
```

## TypeScript inference

`isMatch(value, pattern)` is typed as `value is Infer<typeof pattern>`, so a true result narrows the value:

```ts
declare const v: unknown;
if (isMatch(v, { id: M.string, age: M.gte(18) })) {
  v.id;  // string
  v.age; // number
}
```

`Infer<P>` walks the pattern recursively, extracting `T` from any `Matcher<T>` it encounters and preserving structural types for plain objects and tuples.

## Roadmap

These features are on the path to 1.0 and not yet shipped:

- **`M.bind(name, pattern)` + `M.ref(name)`** — back-references for asserting cross-field equality (e.g. `{ users[0].id === orders[0].userId }`).
- **`M.compile(pattern)`** — pre-walk a pattern into a closed-over predicate to skip dispatch on hot paths.
- **`M.promiseResolves(p)` / `M.promiseRejects(errorPattern)`** — async matchers.
- **`M.error(spec)`** — friendlier error matching for `assert.throws` / `assert.rejects`.
- **Standard Schema interop** — accept any [Standard Schema](https://standardschema.dev) validator wherever a matcher is accepted.
- **LCS-based diff** in `formatMatchFailure` for multi-line object printouts (similar to qunitx's existing `assert.deepEqual` output).
- **Benchmarks** vs `ts-pattern`, `match-iz`, jest's `expect.objectContaining`, lodash deep-equal.

## License

MIT © Izel Nakri
