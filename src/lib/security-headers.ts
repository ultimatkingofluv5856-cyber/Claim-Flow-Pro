/**
 * Security Headers Module
 * Implements CSP, HSTS, X-Frame-Options, etc.
 * Non-breaking additions to existing app
 */

/**
 * Content Security Policy (CSP) Header
 * Prevents XSS and other injection attacks
 */
export const getCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api.resend.com https://*.supabase.co wss://*.supabase.co https://api.sentry.io",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
};

/**
 * Strict-Transport-Security (HSTS)
 * Forces HTTPS connection
 */
export const getHSTSHeader = (): string => {
  return 'max-age=31536000; includeSubDomains; preload';
};

/**
 * X-Content-Type-Options
 * Prevents MIME type sniffing
 */
export const getContentTypeHeader = (): string => {
  return 'nosniff';
};

/**
 * X-Frame-Options
 * Prevents clickjacking
 */
export const getFrameOptionsHeader = (): string => {
  return 'DENY';
};

/**
 * X-XSS-Protection
 * Legacy XSS protection
 */
export const getXSSProtectionHeader = (): string => {
  return '1; mode=block';
};

/**
 * Referrer-Policy
 * Controls referrer information
 */
export const getReferrerPolicyHeader = (): string => {
  return 'strict-origin-when-cross-origin';
};

/**
 * Permissions-Policy (formerly Feature-Policy)
 * Controls browser features
 */
export const getPermissionsPolicyHeader = (): string => {
  return [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'usb=()',
    'vr=()',
    'xr-spatial-tracking=()'
  ].join(', ');
};

/**
 * Apply all security headers to response
 * For Vite dev server, use vite.config.ts middleware
 * For production, use hosting provider (Vercel, etc.)
 */
export function applySecurityHeaders(
  headers: Record<string, string>
): Record<string, string> {
  return {
    ...headers,
    'Content-Security-Policy': getCSPHeader(),
    'Strict-Transport-Security': getHSTSHeader(),
    'X-Content-Type-Options': getContentTypeHeader(),
    'X-Frame-Options': getFrameOptionsHeader(),
    'X-XSS-Protection': getXSSProtectionHeader(),
    'Referrer-Policy': getReferrerPolicyHeader(),
    'Permissions-Policy': getPermissionsPolicyHeader(),
    'X-Permitted-Cross-Domain-Policies': 'none'
  };
}

/**
 * HTML meta tags for CSP (for dev environment)
 * Add to index.html <head>
 */
export const getCSPMetaTag = (): string => {
  return `<meta http-equiv="Content-Security-Policy" content="${getCSPHeader()}">`;
};

/**
 * Vite config for development security headers
 * Usage in vite.config.ts:
 * 
 * import { applySecurityHeaders } from '@/lib/security-headers';
 * 
 * export default defineConfig({
 *   server: {
 *     middlewares: [
 *       (req, res, next) => {
 *         applySecurityHeaders(res.headers);
 *         next();
 *       }
 *     ]
 *   }
 * });
 */

/**
 * Verify CSRF token
 * Add to form submissions
 */
export async function verifyCSRFToken(
  token: string,
  sessionToken: string
): Promise<boolean> {
  // CSRF token should be derived from session
  // Simple validation: token should match hash of session + timestamp
  
  try {
    // This is a simplified check
    // In production, use library like csrf or similar
    return token && token.length > 10;
  } catch {
    return false;
  }
}

/**
 * Generate CSRF token for forms
 */
export function generateCSRFToken(sessionToken: string): string {
  // Derive token from session
  // In production, use proper CSRF library
  
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(sessionToken + Date.now())
    .digest('hex');
}

/**
 * Inject CSRF token into forms
 * Usage: Add to form as hidden input
 */
export function injectCSRFToken(
  sessionToken: string
): { token: string; field: string } {
  const token = generateCSRFToken(sessionToken);
  
  return {
    token,
    field: 'csrf_token' // HTML input name
  };
}

/**
 * Security configuration object
 * Centralizes all security settings
 */
export const securityConfig = {
  // Password policy
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
  },

  // Session policy
  session: {
    expirationMs: 24 * 60 * 60 * 1000, // 24 hours
    refreshThreshold: 60 * 60 * 1000, // 1 hour
    maxConcurrentSessions: 3
  },

  // CORS policy
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.VITE_APP_URL || 'https://example.com'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    allowCredentials: true
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },

  // Two-factor authentication
  twoFA: {
    enabled: true,
    issuer: 'ClaimFlow Pro',
    window: 1 // Allow ±1 time step (±30 seconds)
  }
};

export default {
  getCSPHeader,
  getHSTSHeader,
  getContentTypeHeader,
  getFrameOptionsHeader,
  getXSSProtectionHeader,
  getReferrerPolicyHeader,
  getPermissionsPolicyHeader,
  applySecurityHeaders,
  getCSPMetaTag,
  verifyCSRFToken,
  generateCSRFToken,
  injectCSRFToken,
  securityConfig
};
