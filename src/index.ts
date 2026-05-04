/**
 * patternmatch — pattern matching for JavaScript and TypeScript.
 *
 *   import { match, isMatch, M, formatMatchFailure } from '@izelnakri/patternmatch';
 *
 *   const result = match(user, {
 *     id: M.string,
 *     email: /@/,
 *     age: M.gte(18),
 *     friends: M.arrayOf({ id: M.string }),
 *   });
 *
 *   if (!result.ok) {
 *     console.error(formatMatchFailure(result));
 *   }
 */

export { createContext, isMatch, isMatcher, match } from './walk.ts';
export { formatMatchFailure } from './format.ts';
export type { FormatOptions } from './format.ts';
export { MATCHER_BRAND } from './types.ts';
export type {
  Infer,
  MatchContext,
  MatchFail,
  MatchOk,
  MatchResult,
  Matcher,
  Pattern,
  PathSegment,
} from './types.ts';
export * as M from './matchers.ts';
