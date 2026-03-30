import { describe, expect, it } from 'vitest';
import CryptoJS from 'crypto-js';
import {
  clearAuthFailures,
  formatThrottleMessage,
  getAuthThrottleStatus,
  hashPassword,
  matchesStoredPassword,
  registerAuthFailure,
  validatePasswordStrength,
} from '@/lib/auth-security';

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

describe('auth security helpers', () => {
  it('hashes passwords with PBKDF2 and verifies them', () => {
    const password = 'ClaimFlow@2026';
    const hashed = hashPassword(password);

    expect(hashed.startsWith('pbkdf2$sha256$')).toBe(true);
    expect(matchesStoredPassword(hashed, password)).toBe(true);
    expect(matchesStoredPassword(hashed, 'WrongPassword@2026')).toBe(false);
  }, 60000);

  it('keeps compatibility with legacy plain and sha256 hashes', () => {
    const legacySha = CryptoJS.SHA256('Legacy@123').toString(CryptoJS.enc.Hex);
    expect(matchesStoredPassword('Legacy@123', 'Legacy@123')).toBe(true);
    expect(matchesStoredPassword(legacySha, 'Legacy@123')).toBe(true);
    expect(matchesStoredPassword(legacySha, 'Wrong')).toBe(false);
  });

  it('enforces stronger password rules', () => {
    expect(validatePasswordStrength('short').ok).toBe(false);
    expect(validatePasswordStrength('alllowercase1!').ok).toBe(false);
    expect(validatePasswordStrength('ALLUPPERCASE1!').ok).toBe(false);
    expect(validatePasswordStrength('NoNumber!').ok).toBe(false);
    expect(validatePasswordStrength('NoSpecial1').ok).toBe(false);
    expect(validatePasswordStrength('StrongPass1!').ok).toBe(true);
  });

  it('throttles repeated failures and clears on success', () => {
    const storage = createMemoryStorage();
    const email = 'user@example.com';
    const baseTime = 1_700_000_000_000;

    for (let index = 0; index < 4; index += 1) {
      const status = registerAuthFailure('login', email, baseTime + index, storage);
      expect(status.blocked).toBe(false);
    }

    const blockedStatus = registerAuthFailure('login', email, baseTime + 5, storage);
    expect(blockedStatus.blocked).toBe(true);

    const throttle = getAuthThrottleStatus('login', email, baseTime + 6, storage);
    expect(throttle.blocked).toBe(true);
    expect(formatThrottleMessage('login', throttle.remainingMs)).toContain('Too many login attempts');

    clearAuthFailures('login', email, storage);
    expect(getAuthThrottleStatus('login', email, baseTime + 7, storage).blocked).toBe(false);
  });
});
