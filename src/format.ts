/**
 * Render a {@link MatchFail} into a human-readable diagnostic string.
 * Produces output like:
 *
 *   String does not match /@/ at users[0].email
 *     Expected: /@/
 *     Actual:   "no-at-sign"
 */

import type { MatchResult, PathSegment } from './types.ts';

export interface FormatOptions {
  /** Maximum recursion depth for printing nested values. Defaults to 4. */
  readonly depth?: number;
  /** Custom value inspector. Defaults to a built-in printer. */
  readonly inspect?: (value: unknown) => string;
}

export function formatMatchFailure(result: MatchResult, options: FormatOptions = {}): string {
  if (result.ok) return '';
  const inspect = options.inspect ?? ((v: unknown) => defaultInspect(v, 0, options.depth ?? 4));
  return renderFail(result, inspect, '');
}

function renderFail(
  fail: Exclude<MatchResult, { ok: true }>,
  inspect: (v: unknown) => string,
  indent: string,
): string {
  const path = formatPath(fail.path);
  const lines = [
    `${indent}${fail.reason}${path ? ` at ${path}` : ''}`,
    `${indent}  Expected: ${inspect(fail.expected)}`,
    `${indent}  Actual:   ${inspect(fail.actual)}`,
  ];
  if (fail.cause) {
    lines.push(`${indent}  Cause:`);
    lines.push(renderFail(fail.cause, inspect, `${indent}    `));
  }
  return lines.join('\n');
}

const SAFE_KEY = /^[a-zA-Z_$][\w$]*$/;

function formatPath(path: readonly PathSegment[]): string {
  if (path.length === 0) return '';
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (typeof seg === 'symbol') {
      out += `[${String(seg)}]`;
    } else if (SAFE_KEY.test(seg)) {
      out += out === '' ? seg : `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

function defaultInspect(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number' || t === 'boolean') return String(value);
  if (t === 'bigint') return `${String(value)}n`;
  if (t === 'symbol') return String(value);
  if (t === 'function') {
    const name = (value as { name?: string }).name;
    return `[Function${name ? `: ${name}` : ''}]`;
  }
  if (depth > maxDepth) return '…';
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Set) {
    const items = [...value].map((v) => defaultInspect(v, depth + 1, maxDepth));
    return `Set(${items.length}) { ${items.join(', ')} }`;
  }
  if (value instanceof Map) {
    const entries = [...value].map(
      ([k, v]) =>
        `${defaultInspect(k, depth + 1, maxDepth)} => ${defaultInspect(v, depth + 1, maxDepth)}`,
    );
    return `Map(${entries.length}) { ${entries.join(', ')} }`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => defaultInspect(v, depth + 1, maxDepth)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const ctor = (value as { constructor?: { name?: string } }).constructor;
    const name = ctor?.name && ctor.name !== 'Object' ? `${ctor.name} ` : '';
    const entries = Object.entries(value as object).map(
      ([k, v]) => `${k}: ${defaultInspect(v, depth + 1, maxDepth)}`,
    );
    return `${name}{ ${entries.join(', ')} }`;
  }
  return String(value);
}
