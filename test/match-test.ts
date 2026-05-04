import { module, test } from 'qunitx';
import { formatMatchFailure, isMatch, M, match } from 'type-match';

module('match: primitives', () => {
  test('strict equality of strings', (assert) => {
    assert.true(isMatch('hi', 'hi'));
    assert.false(isMatch('hi', 'bye'));
  });

  test('NaN matches NaN (SameValue)', (assert) => {
    assert.true(isMatch(NaN, NaN));
  });

  test('null/undefined are strict — no coercion', (assert) => {
    assert.true(isMatch(null, null));
    assert.false(isMatch(undefined, null));
    assert.false(isMatch(null, undefined));
  });

  test('numbers', (assert) => {
    assert.true(isMatch(42, 42));
    assert.false(isMatch(42, 43));
  });
});

module('match: regex', () => {
  test('matches strings the regex accepts', (assert) => {
    assert.true(isMatch('foo@bar', /@/));
    assert.false(isMatch('foo', /@/));
  });
  test('non-strings always fail (no coercion)', (assert) => {
    assert.false(isMatch(42, /42/));
    assert.false(isMatch(null, /.*/));
  });
});

module('match: dates', () => {
  test('same instant matches', (assert) => {
    assert.true(isMatch(new Date('2024-01-01'), new Date('2024-01-01')));
    assert.false(isMatch(new Date('2024-01-01'), new Date('2024-01-02')));
  });
});

module('match: shape (default partial object)', () => {
  test('extra keys are ignored', (assert) => {
    assert.true(isMatch({ a: 1, b: 2, c: 3 }, { a: 1 }));
  });

  test('missing key fails with path', (assert) => {
    const r = match({ a: 1 }, { b: 2 });
    assert.false(r.ok);
    if (!r.ok) assert.deepEqual(r.path, ['b']);
  });

  test('nested partial with mixed matchers', (assert) => {
    const r = match(
      { user: { id: 1, name: 'Izel', email: 'i@example.com' } },
      { user: { id: M.number, email: /@/ } },
    );
    assert.true(r.ok);
  });

  test('deep failure reports nested path', (assert) => {
    const r = match(
      { user: { id: 1, name: 'Izel', email: 'no-at-sign' } },
      { user: { email: /@/ } },
    );
    assert.false(r.ok);
    if (!r.ok) assert.deepEqual(r.path, ['user', 'email']);
  });
});

module('match: tuple', () => {
  test('strict positions and length', (assert) => {
    assert.true(isMatch([1, 2, 3], [1, 2, 3]));
    assert.false(isMatch([1, 2], [1, 2, 3]));
    assert.false(isMatch([1, 2, 3, 4], [1, 2, 3]));
  });

  test('mixed matcher elements', (assert) => {
    assert.true(isMatch([1, 'two', 3], [1, M.string, M.gt(2)]));
    assert.false(isMatch([1, 'two', 1], [1, M.string, M.gt(2)]));
  });
});

module('match: combinators', () => {
  test('union matches if any branch matches', (assert) => {
    const p = M.union(M.string, M.number);
    assert.true(isMatch('hi', p));
    assert.true(isMatch(42, p));
    assert.false(isMatch(true, p));
  });

  test('intersection requires all branches', (assert) => {
    const p = M.intersection(M.number, M.gte(10), M.lte(20));
    assert.true(isMatch(15, p));
    assert.false(isMatch(5, p));
    assert.false(isMatch(25, p));
  });

  test('not inverts a pattern', (assert) => {
    assert.true(isMatch('foo', M.not(M.number)));
    assert.false(isMatch(42, M.not(M.number)));
  });

  test('optional permits missing or matching values', (assert) => {
    const p = { name: M.string, age: M.optional(M.number) };
    assert.true(isMatch({ name: 'a' }, p));
    assert.true(isMatch({ name: 'a', age: 20 }, p));
    assert.false(isMatch({ name: 'a', age: 'old' }, p));
  });
});

module('match: classes', () => {
  class User {
    id: number;
    constructor(id: number) {
      this.id = id;
    }
  }

  test('instanceOf', (assert) => {
    assert.true(isMatch(new User(1), M.instanceOf(User)));
    assert.false(isMatch({ id: 1 }, M.instanceOf(User)));
  });

  test('shape against a class instance reads own properties', (assert) => {
    const r = match(new User(42), { id: M.gte(1) });
    assert.true(r.ok);
  });
});

module('match: containers', () => {
  test('arrayOf', (assert) => {
    assert.true(isMatch([1, 2, 3], M.arrayOf(M.number)));
    assert.false(isMatch([1, 'a'], M.arrayOf(M.number)));
  });

  test('setOf', (assert) => {
    assert.true(isMatch(new Set([1, 2, 3]), M.setOf(M.number)));
    assert.false(isMatch(new Set([1, 'two']), M.setOf(M.number)));
  });

  test('mapOf', (assert) => {
    const m = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    assert.true(isMatch(m, M.mapOf(M.string, M.number)));
  });

  test('recordOf', (assert) => {
    assert.true(isMatch({ a: 1, b: 2 }, M.recordOf(M.string, M.number)));
    assert.false(isMatch({ a: 1, b: 'x' }, M.recordOf(M.string, M.number)));
  });
});

module('match: numeric and string predicates', () => {
  test('between', (assert) => {
    assert.true(isMatch(15, M.between(10, 20)));
    assert.false(isMatch(9, M.between(10, 20)));
  });

  test('startsWith / endsWith', (assert) => {
    assert.true(isMatch('hello world', M.startsWith('hello')));
    assert.true(isMatch('hello world', M.endsWith('world')));
  });

  test('length exact and range', (assert) => {
    assert.true(isMatch([1, 2, 3], M.length(3)));
    assert.true(isMatch('abcdef', M.length({ min: 3, max: 10 })));
    assert.false(isMatch('ab', M.length({ min: 3 })));
  });
});

module('match: cycles', () => {
  test('self-referential structures unify', (assert) => {
    const a: Record<string, unknown> = { x: 1 };
    a['self'] = a;
    const p: Record<string, unknown> = { x: 1 };
    p['self'] = p;
    assert.true(isMatch(a, p));
  });
});

module('match: deepEqual escape hatch', () => {
  test('rejects extra keys', (assert) => {
    assert.false(isMatch({ a: 1, b: 2 }, M.deepEqual({ a: 1 })));
    assert.true(isMatch({ a: 1 }, M.deepEqual({ a: 1 })));
  });
});

module('match: exact', () => {
  test('rejects extra keys', (assert) => {
    assert.false(isMatch({ a: 1, b: 2 }, M.exact({ a: M.number })));
  });
  test('rejects missing keys', (assert) => {
    assert.false(isMatch({ a: 1 }, M.exact({ a: M.number, b: M.number })));
  });
  test('accepts a perfect match', (assert) => {
    assert.true(isMatch({ a: 1, b: 2 }, M.exact({ a: M.number, b: M.number })));
  });
});

module('match: when (predicate escape hatch)', () => {
  test('custom predicate', (assert) => {
    const isEven = M.when((v) => typeof v === 'number' && v % 2 === 0);
    assert.true(isMatch(4, isEven));
    assert.false(isMatch(3, isEven));
  });
});

module('formatMatchFailure', () => {
  test('produces a path-aware diagnostic', (assert) => {
    const r = match(
      { user: { id: 1, name: 'Izel', email: 'no-at-sign' } },
      { user: { email: /@/ } },
    );
    assert.false(r.ok);
    if (!r.ok) {
      const out = formatMatchFailure(r);
      assert.true(/at user\.email/.test(out), 'mentions the failing path');
      assert.true(/Expected: \/@\//.test(out), 'shows the expected pattern');
      assert.true(/Actual:\s+"no-at-sign"/.test(out), 'shows the actual value');
    }
  });
});

module('isMatch as a TypeScript type predicate', () => {
  test('narrows the value type', (assert) => {
    const v: unknown = { id: 1, name: 'x' };
    if (isMatch(v, { id: M.number, name: M.string })) {
      const id: number = v.id;
      const name: string = v.name;
      assert.strictEqual(typeof id, 'number');
      assert.strictEqual(typeof name, 'string');
    } else {
      assert.true(false, 'expected narrowing branch');
    }
  });
});
