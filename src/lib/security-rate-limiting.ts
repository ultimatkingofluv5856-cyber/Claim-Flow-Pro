/**
 * Rate Limiting Module
 * Provides IP-based and token-based rate limiting
 * Integrates transparently with existing API endpoints
 */

import { supabase } from '@/integrations/supabase/client';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests in window
  message?: string; // Error message
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
  message?: string;
}

interface RateLimitRecord {
  key: string;
  requests: number;
  resetTime: number;
}

type RateLimitCheck<TInput> = (input: TInput) => RateLimitResult;

type RateLimiter<TInput> = RateLimitCheck<TInput> & {
  checkLimit: (input: TInput) => Promise<RateLimitResult>;
  reset: (input: TInput) => void;
};

// In-memory store (for development)
// In production: use Redis for distributed rate limiting
class RateLimitStore {
  private records: Map<string, RateLimitRecord> = new Map();

  get(key: string): RateLimitRecord | null {
    const record = this.records.get(key);
    
    if (!record) return null;
    
    // Check if window expired
    if (Date.now() >= record.resetTime) {
      this.records.delete(key);
      return null;
    }
    
    return record;
  }

  increment(key: string, windowMs: number): number {
    const record = this.get(key);
    const now = Date.now();
    
    if (!record) {
      this.records.set(key, {
        key,
        requests: 1,
        resetTime: now + windowMs
      });
      return 1;
    }
    
    record.requests += 1;
    return record.requests;
  }

  reset(key: string): void {
    this.records.delete(key);
  }

  clear(): void {
    this.records.clear();
  }
}

const store = new RateLimitStore();

/**
 * Get client IP address from request
 */
function getClientIP(
  headers?: Record<string, string>
): string {
  if (!headers) return '127.0.0.1';
  
  return (
    headers['x-forwarded-for']?.split(',')[0] ||
    headers['x-client-ip'] ||
    headers['cf-connecting-ip'] ||
    '127.0.0.1'
  );
}

/**
 * Rate limiter by IP address
 * Use for login, password reset, public endpoints
 */
export function createIPRateLimiter(config: RateLimitConfig) {
  const limiter = ((headers?: Record<string, string>): RateLimitResult => {
    const ip = getClientIP(headers);
    const key = `ip:${ip}`;
    
    return checkRateLimit(key, config);
  }) as RateLimiter<Record<string, string> | undefined>;

  limiter.checkLimit = async (headers?: Record<string, string>) => limiter(headers);
  limiter.reset = (headers?: Record<string, string>) => {
    const ip = getClientIP(headers);
    resetRateLimit(`ip:${ip}`);
  };

  return limiter;
}

/**
 * Rate limiter by authentication token
 * Use for authenticated API endpoints
 */
export function createTokenRateLimiter(config: RateLimitConfig) {
  const limiter = ((token: string): RateLimitResult => {
    const key = `token:${token}`;
    
    return checkRateLimit(key, config);
  }) as RateLimiter<string>;

  limiter.checkLimit = async (token: string) => limiter(token);
  limiter.reset = (token: string) => {
    resetRateLimit(`token:${token}`);
  };

  return limiter;
}

/**
 * Rate limiter by email (for user-specific limits)
 * Use for claim submission, approval actions
 */
export function createEmailRateLimiter(config: RateLimitConfig) {
  const limiter = ((email: string): RateLimitResult => {
    const key = `email:${email}`;
    
    return checkRateLimit(key, config);
  }) as RateLimiter<string>;

  limiter.checkLimit = async (email: string) => limiter(email);
  limiter.reset = (email: string) => {
    resetRateLimit(`email:${email}`);
  };

  return limiter;
}

/**
 * Core rate limit check
 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const record = store.get(key);
  const now = Date.now();
  
  if (!record) {
    // First request in window
    store.increment(key, config.windowMs);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      retryAfterSeconds: 0,
    };
  }
  
  if (record.requests >= config.maxRequests) {
    // Limit exceeded
    const retryAfterMs = Math.max(0, record.resetTime - now);
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      message: config.message || 'Rate limit exceeded'
    };
  }
  
  // Increment and allow
  const newCount = store.increment(key, config.windowMs);
  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetTime: record.resetTime,
    retryAfterSeconds: 0,
  };
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  store.reset(key);
}

/**
 * Pre-configured rate limiters for common operations
 */
export const rateLimiters = {
  // Login: 5 attempts per 15 minutes
  login: createEmailRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many login attempts. Please try again later.'
  }),

  // Password reset: 3 attempts per hour
  passwordReset: createEmailRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again later.'
  }),

  // Claim submission: 10 per hour per user
  claimSubmission: createEmailRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: 'You have submitted too many claims. Please try again later.'
  }),

  // API calls: 100 per minute per token
  api: createTokenRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'API rate limit exceeded'
  }),

  // Approval actions: 50 per hour per user
  approval: createEmailRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 50,
    message: 'Too many approval actions. Please try again later.'
  })
};

/**
 * Middleware for API calls
 * Example usage: 
 * const result = rateLimiters.api(userToken, headers);
 * if (!result.allowed) return error(429, result.message);
 */
export async function checkAPIRateLimit(
  token: string,
  ip: string
): Promise<RateLimitResult> {
  // Check both token and IP limits
  const tokenLimit = rateLimiters.api(token);
  const ipLimit = rateLimiters.api(ip);
  
  // Fail if either limit exceeded
  if (!tokenLimit.allowed) return tokenLimit;
  if (!ipLimit.allowed) return ipLimit;
  
  return tokenLimit;
}

/**
 * Log rate limit violations to database
 */
export async function logRateLimitViolation(
  type: string, // 'login', 'api', 'claim', etc.
  identifier: string, // IP, email, token
  timestamp: Date = new Date()
): Promise<void> {
  try {
    await supabase.from('rate_limit_violations').insert({
      type,
      identifier,
      timestamp: timestamp.toISOString()
    });
  } catch (error) {
    console.error('Failed to log rate limit violation:', error);
  }
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(
  type: string,
  hours: number = 24
): Promise<{
  totalViolations: number;
  uniqueIdentifiers: number;
  topOffenders: Array<{ identifier: string; count: number }>;
}> {
  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data } = await supabase
      .from('rate_limit_violations')
      .select('identifier')
      .eq('type', type)
      .gte('timestamp', cutoff.toISOString());

    const violations = data || [];
    const identifierCounts = new Map<string, number>();
    
    violations.forEach(v => {
      identifierCounts.set(
        v.identifier,
        (identifierCounts.get(v.identifier) || 0) + 1
      );
    });

    const topOffenders = Array.from(identifierCounts.entries())
      .map(([identifier, count]) => ({ identifier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViolations: violations.length,
      uniqueIdentifiers: identifierCounts.size,
      topOffenders
    };
  } catch (error) {
    console.error('Failed to get rate limit stats:', error);
    return {
      totalViolations: 0,
      uniqueIdentifiers: 0,
      topOffenders: []
    };
  }
}

export default {
  createIPRateLimiter,
  createTokenRateLimiter,
  createEmailRateLimiter,
  checkRateLimit,
  rateLimiters,
  checkAPIRateLimit,
  logRateLimitViolation,
  getRateLimitStats,
  resetRateLimit
};
