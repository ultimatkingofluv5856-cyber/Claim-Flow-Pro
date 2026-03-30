import CryptoJS from 'crypto-js';

const PBKDF2_PREFIX = 'pbkdf2';
const PBKDF2_HASHER = 'sha256';
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_SIZE_WORDS = 256 / 32;

const THROTTLE_PREFIX = 'claimflow-auth-throttle';
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_BASE_LOCK_MS = 60 * 1000;
const THROTTLE_MAX_LOCK_MS = 30 * 60 * 1000;

type AuthAction = 'login' | 'password-reset';

export interface PasswordValidationResult {
  ok: boolean;
  message?: string;
}

export interface AuthThrottleStatus {
  blocked: boolean;
  remainingMs: number;
  attempts: number;
}

interface AuthThrottleRecord {
  attempts: number;
  firstFailureAt: number;
  lastFailureAt: number;
  lockUntil: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function randomSaltHex() {
  return CryptoJS.lib.WordArray.random(PBKDF2_SALT_BYTES).toString(CryptoJS.enc.Hex);
}

function computePbkdf2Hash(password: string, saltHex: string, iterations = PBKDF2_ITERATIONS) {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  return CryptoJS.PBKDF2(password, salt, {
    hasher: CryptoJS.algo.SHA256,
    iterations,
    keySize: PBKDF2_KEY_SIZE_WORDS,
  }).toString(CryptoJS.enc.Hex);
}

function sha256Hex(password: string) {
  return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
}

function getStorage(customStorage?: StorageLike | null) {
  if (customStorage) return customStorage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getThrottleKey(action: AuthAction, identifier: string) {
  return `${THROTTLE_PREFIX}:${action}:${identifier.trim().toLowerCase()}`;
}

function readThrottleRecord(storage: StorageLike | null, action: AuthAction, identifier: string): AuthThrottleRecord | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(getThrottleKey(action, identifier));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthThrottleRecord>;
    return {
      attempts: Number(parsed.attempts || 0),
      firstFailureAt: Number(parsed.firstFailureAt || 0),
      lastFailureAt: Number(parsed.lastFailureAt || 0),
      lockUntil: Number(parsed.lockUntil || 0),
    };
  } catch {
    return null;
  }
}

function writeThrottleRecord(storage: StorageLike | null, action: AuthAction, identifier: string, record: AuthThrottleRecord) {
  if (!storage) return;
  storage.setItem(getThrottleKey(action, identifier), JSON.stringify(record));
}

function clearThrottleRecord(storage: StorageLike | null, action: AuthAction, identifier: string) {
  if (!storage) return;
  storage.removeItem(getThrottleKey(action, identifier));
}

function calculateLockDuration(attempts: number) {
  const multiplier = Math.max(0, attempts - THROTTLE_MAX_ATTEMPTS);
  return Math.min(THROTTLE_MAX_LOCK_MS, THROTTLE_BASE_LOCK_MS * Math.max(1, 2 ** multiplier));
}

export function hashPassword(password: string) {
  const saltHex = randomSaltHex();
  const hashHex = computePbkdf2Hash(password, saltHex, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_HASHER}$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

export function isLegacySha256Hash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function matchesStoredPassword(storedPassword: unknown, plainPassword: string) {
  const storedValue = String(storedPassword || '').trim();
  if (!storedValue) return false;

  if (storedValue.startsWith(`${PBKDF2_PREFIX}$`)) {
    const [, hasher, iterationText, saltHex, expectedHash] = storedValue.split('$');
    const iterations = parseInt(iterationText || '', 10);

    if (hasher !== PBKDF2_HASHER || !saltHex || !expectedHash || !Number.isFinite(iterations) || iterations < 1000) {
      return false;
    }

    return computePbkdf2Hash(plainPassword, saltHex, iterations) === expectedHash;
  }

  if (isLegacySha256Hash(storedValue)) {
    return sha256Hex(plainPassword) === storedValue;
  }

  return storedValue === plainPassword;
}

export function needsPasswordUpgrade(storedPassword: unknown) {
  const storedValue = String(storedPassword || '').trim();
  return Boolean(storedValue) && !storedValue.startsWith(`${PBKDF2_PREFIX}$`);
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const value = String(password || '');

  if (value.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(value)) {
    return { ok: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(value)) {
    return { ok: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, message: 'Password must include at least one number.' };
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, message: 'Password must include at least one special character.' };
  }

  return { ok: true };
}

export function getAuthThrottleStatus(action: AuthAction, identifier: string, now = Date.now(), customStorage?: StorageLike | null): AuthThrottleStatus {
  const storage = getStorage(customStorage);
  const record = readThrottleRecord(storage, action, identifier);

  if (!record) {
    return { blocked: false, remainingMs: 0, attempts: 0 };
  }

  if (record.lockUntil > now) {
    return {
      blocked: true,
      remainingMs: record.lockUntil - now,
      attempts: record.attempts,
    };
  }

  if (now - record.lastFailureAt > THROTTLE_WINDOW_MS) {
    clearThrottleRecord(storage, action, identifier);
    return { blocked: false, remainingMs: 0, attempts: 0 };
  }

  return { blocked: false, remainingMs: 0, attempts: record.attempts };
}

export function registerAuthFailure(action: AuthAction, identifier: string, now = Date.now(), customStorage?: StorageLike | null): AuthThrottleStatus {
  const storage = getStorage(customStorage);
  const current = readThrottleRecord(storage, action, identifier);
  const isFreshWindow = !current || now - current.lastFailureAt > THROTTLE_WINDOW_MS;

  const nextAttempts = isFreshWindow ? 1 : current.attempts + 1;
  const nextFirstFailureAt = isFreshWindow ? now : current.firstFailureAt;
  const nextLockUntil = nextAttempts >= THROTTLE_MAX_ATTEMPTS ? now + calculateLockDuration(nextAttempts) : 0;

  writeThrottleRecord(storage, action, identifier, {
    attempts: nextAttempts,
    firstFailureAt: nextFirstFailureAt,
    lastFailureAt: now,
    lockUntil: nextLockUntil,
  });

  return {
    blocked: nextLockUntil > now,
    remainingMs: nextLockUntil > now ? nextLockUntil - now : 0,
    attempts: nextAttempts,
  };
}

export function clearAuthFailures(action: AuthAction, identifier: string, customStorage?: StorageLike | null) {
  clearThrottleRecord(getStorage(customStorage), action, identifier);
}

export function formatThrottleMessage(actionLabel: string, remainingMs: number) {
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  if (remainingSeconds < 60) {
    return `Too many ${actionLabel} attempts. Try again in ${remainingSeconds}s.`;
  }

  return `Too many ${actionLabel} attempts. Try again in ${remainingMinutes} min.`;
}
