import { describe, it, expect } from 'vitest';
import { assertPathWithin, sanitizePathParam } from './security.js';

describe('assertPathWithin', () => {
  it('allows paths within base directory', () => {
    const result = assertPathWithin('/home/user/skills/test/SKILL.md', '/home/user/skills');
    expect(result).toBe('/home/user/skills/test/SKILL.md');
  });

  it('allows the base directory itself', () => {
    const result = assertPathWithin('/home/user/skills', '/home/user/skills');
    expect(result).toBe('/home/user/skills');
  });

  it('rejects directory traversal with ../', () => {
    expect(() => {
      assertPathWithin('/home/user/skills/../../../etc/passwd', '/home/user/skills');
    }).toThrow();
  });

  it('rejects paths completely outside base', () => {
    expect(() => {
      assertPathWithin('/etc/passwd', '/home/user/skills');
    }).toThrow();
  });

  it('thrown error has status 403', () => {
    try {
      assertPathWithin('/etc/passwd', '/home/user');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
    }
  });

  it('normalizes paths with redundant separators', () => {
    const result = assertPathWithin('/home/user//skills/./test/SKILL.md', '/home/user/skills');
    expect(result).toBe('/home/user/skills/test/SKILL.md');
  });
});

describe('sanitizePathParam', () => {
  it('returns normal folder names unchanged', () => {
    expect(sanitizePathParam('my-skill')).toBe('my-skill');
  });

  it('strips .. segments', () => {
    expect(sanitizePathParam('../../etc')).toBe('etc');
  });

  it('strips . segments', () => {
    expect(sanitizePathParam('./test')).toBe('test');
  });

  it('strips empty segments from leading slashes', () => {
    expect(sanitizePathParam('/test')).toBe('test');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizePathParam(undefined)).toBe('');
    expect(sanitizePathParam(null)).toBe('');
    expect(sanitizePathParam(123)).toBe('');
  });

  it('handles complex traversal attempts', () => {
    expect(sanitizePathParam('..%2F..%2Fetc')).toBe('..%2F..%2Fetc');
    expect(sanitizePathParam('../../../etc/passwd')).toBe('etc/passwd');
  });
});
