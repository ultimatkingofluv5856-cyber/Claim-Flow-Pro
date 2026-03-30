import { supabase } from '@/integrations/supabase/client';
import { sendEmail } from '@/lib/send-email';
import { rateLimiters } from '@/lib/security-rate-limiting';
import {
  clearAuthFailures,
  formatThrottleMessage,
  getAuthThrottleStatus,
  hashPassword,
  matchesStoredPassword,
  needsPasswordUpgrade,
  registerAuthFailure,
  validatePasswordStrength,
} from '@/lib/auth-security';

export type UserRole = 'User' | 'Manager' | 'Admin' | 'Super Admin';

export interface AppUser {
  email: string;
  name: string;
  role: UserRole;
  profile_picture_url?: string | null;
}

export interface SessionData {
  token: string;
  user: AppUser;
}

function generateSecureToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function upgradeLegacyPasswordIfNeeded(email: string, storedPassword: unknown, plainPassword: string) {
  const storedValue = String(storedPassword || '');

  if (!storedValue || !needsPasswordUpgrade(storedValue)) return;

  await supabase
    .from('users')
    .update({ password_hash: hashPassword(plainPassword) })
    .eq('email', email);
}

export async function login(email: string, password: string): Promise<{ ok: boolean; message?: string; session?: SessionData }> {
  email = email.trim().toLowerCase();
  if (!email || !password) return { ok: false, message: 'Email and password required.' };

  // Check rate limit first (Phase 5: Security)
  const limitCheck = await rateLimiters.login.checkLimit(email);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      message: `Too many login attempts. Please try again in ${Math.ceil(limitCheck.retryAfterSeconds)} seconds.`
    };
  }

  const throttle = getAuthThrottleStatus('login', email);
  if (throttle.blocked) {
    return { ok: false, message: formatThrottleMessage('login', throttle.remainingMs) };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    registerAuthFailure('login', email);
    return { ok: false, message: 'Invalid email or password.' };
  }
  if (!matchesStoredPassword((user as any).password_hash, password)) {
    const failedAttempt = registerAuthFailure('login', email);
    return {
      ok: false,
      message: failedAttempt.blocked
        ? formatThrottleMessage('login', failedAttempt.remainingMs)
        : 'Invalid email or password.',
    };
  }
  if ((user as any).active === false) return { ok: false, message: 'Account is deactivated.' };

  await upgradeLegacyPasswordIfNeeded(email, (user as any).password_hash, password);
  clearAuthFailures('login', email);

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: sessionError } = await supabase.from('sessions').insert({
    token,
    user_email: email,
    role: (user as any).role,
    expires_at: expiresAt,
  });

  if (sessionError) return { ok: false, message: 'Failed to create session.' };

  const session: SessionData = {
    token,
    user: {
      email: (user as any).email,
      name: (user as any).name,
      role: (user as any).role as UserRole,
      profile_picture_url: (user as any).profile_picture_url,
    },
  };

  return { ok: true, session };
}

export async function verifyToken(token: string): Promise<AppUser | null> {
  if (!token) return null;

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('name, email, role, profile_picture_url')
    .eq('email', (data as any).user_email)
    .single();

  if (!userData) return null;

  return {
    email: (userData as any).email,
    name: (userData as any).name,
    role: (userData as any).role as UserRole,
    profile_picture_url: (userData as any).profile_picture_url,
  };
}

export async function logout(token: string) {
  if (token) {
    await supabase.from('sessions').delete().eq('token', token);
  }
}

export function isAdmin(role: UserRole) {
  return role === 'Admin' || role === 'Super Admin';
}

export function isManagerOrAbove(role: UserRole) {
  return role === 'Manager' || role === 'Admin' || role === 'Super Admin';
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message?: string }> {
  email = email.trim().toLowerCase();
  if (!email) return { ok: false, message: 'Email is required.' };

  const throttle = getAuthThrottleStatus('password-reset', email);
  if (throttle.blocked) {
    return { ok: false, message: formatThrottleMessage('password reset', throttle.remainingMs) };
  }

  // Phase 5: Check rate limit for password reset
  const limitCheck = await rateLimiters.passwordReset.checkLimit(email);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      message: `Too many password reset requests. Please try again in ${Math.ceil(limitCheck.retryAfterSeconds)} seconds.`
    };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .single();

  if (error || !user) {
    registerAuthFailure('password-reset', email);
    return { ok: false, message: 'If this email is registered, you will receive a password reset link.' };
  }

  const resetToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  try {
    const { error: insertError } = await supabase.from('password_resets').insert({
      email,
      token: resetToken,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('Password reset insert error:', insertError);
      return { ok: false, message: 'Failed to create reset request. Please try again.' };
    }

    const resetLink = `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;

    const emailResult = await sendEmail(email, 'password_reset', {
      resetLink,
      expiresIn: '1 hour',
    });

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return { ok: true, message: 'If this email is registered, you will receive a password reset link.' };
    }

    clearAuthFailures('password-reset', email);
    return { ok: true, message: 'If this email is registered, you will receive a password reset link.' };
  } catch (error) {
    console.error('Password reset error:', error);
    return { ok: false, message: 'An error occurred. Please try again.' };
  }
}

export async function resetPassword(email: string, resetToken: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
  email = email.trim().toLowerCase();

  if (!email || !resetToken || !newPassword) {
    return { ok: false, message: 'Email, reset token, and password are required.' };
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.ok) {
    return { ok: false, message: passwordValidation.message };
  }

  try {
    const { data: resetRequest, error: selectError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('email', email)
      .eq('token', resetToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (selectError || !resetRequest) {
      return { ok: false, message: 'Invalid or expired reset token.' };
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('email', email);

    if (updateError) {
      return { ok: false, message: 'Failed to update password. Please try again.' };
    }

    await supabase.from('password_resets').delete().eq('id', (resetRequest as any).id);
    sessionStorage.removeItem(`reset_token_${email}`);

    return { ok: true, message: 'Password has been reset successfully.' };
  } catch (error) {
    console.error('Reset password error:', error);
    return { ok: false, message: 'An error occurred. Please try again.' };
  }
}

export { hashPassword, matchesStoredPassword, validatePasswordStrength };
