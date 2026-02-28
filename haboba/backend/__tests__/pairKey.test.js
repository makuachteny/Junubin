import { makePairKey } from '../src/utils/pairKey.js';

describe('makePairKey', () => {
  it('produces a deterministic key regardless of argument order', () => {
    expect(makePairKey('aaa', 'bbb')).toBe(makePairKey('bbb', 'aaa'));
  });

  it('returns colon-separated sorted IDs', () => {
    expect(makePairKey('z', 'a')).toBe('a:z');
    expect(makePairKey('a', 'z')).toBe('a:z');
  });

  it('handles identical IDs', () => {
    expect(makePairKey('x', 'x')).toBe('x:x');
  });
});
