/**
 * Two-Factor Authentication (2FA) Module
 * Adds TOTP-based 2FA to existing auth flow without changing it
 * 
 * Integration Points:
 * - After login succeeds: Check if 2FA enabled
 * - If enabled: Redirect to 2FA verification screen
 * - After 2FA verified: Proceed with normal session creation
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { hashPassword } from './auth';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

/**
 * Generate backup codes for account recovery
 */
function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random()
      .toString(36)
      .substring(2, 2 + BACKUP_CODE_LENGTH)
      .toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Enable 2FA for a user
 * Returns secret and QR code for scanning
 */
export async function enable2FA(email: string): Promise<{
  ok: boolean;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  message?: string;
}> {
  try {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `ClaimFlow Pro (${email})`,
      issuer: 'ClaimFlow Pro',
      length: 32
    });

    if (!secret.base32) {
      return {
        ok: false,
        message: 'Failed to generate 2FA secret'
      };
    }

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map(code => hashPassword(code));

    // Store in database (2fa_secrets table)
    const { error } = await supabase
      .from('user_2fa_settings')
      .insert({
        email,
        secret_base32: secret.base32,
        backup_codes: hashedBackupCodes,
        enabled: false, // Not enabled until verified
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store 2FA secret:', error);
      return {
        ok: false,
        message: 'Failed to enable 2FA'
      };
    }

    return {
      ok: true,
      secret: secret.base32,
      qrCode,
      backupCodes // Show only once!
    };
  } catch (error) {
    console.error('Error in enable2FA:', error);
    return {
      ok: false,
      message: 'Error enabling 2FA'
    };
  }
}

/**
 * Verify 2FA token during setup
 * Activates 2FA after verification
 */
export async function verify2FASetup(
  email: string,
  token: string
): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    // Get pending 2FA secret
    const { data: twoFAData } = await supabase
      .from('user_2fa_settings')
      .select('secret_base32')
      .eq('email', email)
      .eq('enabled', false)
      .single();

    if (!twoFAData?.secret_base32) {
      return {
        ok: false,
        message: '2FA setup not found'
      };
    }

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret: twoFAData.secret_base32,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 time window (±30 seconds)
    });

    if (!isValid) {
      return {
        ok: false,
        message: 'Invalid 2FA token'
      };
    }

    // Enable 2FA
    const { error } = await supabase
      .from('user_2fa_settings')
      .update({
        enabled: true,
        verified_at: new Date().toISOString()
      })
      .eq('email', email);

    if (error) {
      return {
        ok: false,
        message: 'Failed to enable 2FA'
      };
    }

    return {
      ok: true,
      message: '2FA enabled successfully'
    };
  } catch (error) {
    console.error('Error in verify2FASetup:', error);
    return {
      ok: false,
      message: 'Error verifying 2FA'
    };
  }
}

/**
 * Verify 2FA token during login
 * Used in auth flow after password validation
 */
export async function verify2FALogin(
  email: string,
  token: string
): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    // Get active 2FA secret
    const { data: twoFAData } = await supabase
      .from('user_2fa_settings')
      .select('secret_base32, backup_codes')
      .eq('email', email)
      .eq('enabled', true)
      .single();

    if (!twoFAData?.secret_base32) {
      return {
        ok: false,
        message: '2FA not enabled'
      };
    }

    // Try TOTP token first
    const isTOTPValid = speakeasy.totp.verify({
      secret: twoFAData.secret_base32,
      encoding: 'base32',
      token: token.replace(/\s/g, ''), // Remove spaces
      window: 1
    });

    if (isTOTPValid) {
      return { ok: true };
    }

    // Try backup codes if TOTP failed
    const { matchesStoredPassword } = require('./auth-security');
    const backupCodes = twoFAData.backup_codes || [];

    for (const hashedCode of backupCodes) {
      if (matchesStoredPassword(hashedCode, token)) {
        // Backup code used - remove it
        const updatedCodes = backupCodes.filter(
          (code: string) => code !== hashedCode
        );

        await supabase
          .from('user_2fa_settings')
          .update({ backup_codes: updatedCodes })
          .eq('email', email);

        return { ok: true };
      }
    }

    return {
      ok: false,
      message: 'Invalid 2FA token or backup code'
    };
  } catch (error) {
    console.error('Error in verify2FALogin:', error);
    return {
      ok: false,
      message: 'Error verifying 2FA'
    };
  }
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(
  email: string,
  password: string
): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    // Verify password before disabling
    const { data: user } = await supabase
      .from('users')
      .select('password')
      .eq('email', email)
      .single();

    const { matchesStoredPassword } = require('./auth-security');
    if (!user || !matchesStoredPassword(user.password, password)) {
      return {
        ok: false,
        message: 'Invalid password'
      };
    }

    // Disable 2FA
    const { error } = await supabase
      .from('user_2fa_settings')
      .update({ enabled: false })
      .eq('email', email);

    if (error) {
      return {
        ok: false,
        message: 'Failed to disable 2FA'
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error in disable2FA:', error);
    return {
      ok: false,
      message: 'Error disabling 2FA'
    };
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function has2FAEnabled(email: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_2fa_settings')
      .select('enabled')
      .eq('email', email)
      .eq('enabled', true)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Get remaining backup codes count
 */
export async function getBackupCodesCount(email: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('user_2fa_settings')
      .select('backup_codes')
      .eq('email', email)
      .single();

    return data?.backup_codes?.length || 0;
  } catch {
    return 0;
  }
}
