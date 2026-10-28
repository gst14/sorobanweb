import { describe, expect, it } from 'vitest';

describe('domain project', () => {
  it('corre en node, sin DOM', () => {
    expect(typeof globalThis).toBe('object');
    expect('document' in globalThis).toBe(false);
  });
});
