/**
 * Email notification sender utility
 * Uses Supabase SDK's functions.invoke() for proper JWT authentication
 * 
 * Usage:
 *   import { sendEmail } from '@/lib/send-email'
 *   
 *   await sendEmail('user@example.com', 'user_created', {
 *     name: 'John Doe',
 *     role: 'Manager'
 *   })
 */

import { supabase } from '@/integrations/supabase/client';

export type EmailType =
  | 'user_created'
  | 'claim_submitted'
  | 'claim_submitted_user'
  | 'claim_submitted_admin'
  | 'claim_submitted_manager'
  | 'claim_approved'
  | 'claim_rejected'
  | 'password_reset';

export interface SendEmailOptions {
  recipientEmail: string;
  type: EmailType;
  data?: Record<string, any>;
}

export interface SendEmailResponse {
  success: boolean;
  id?: string;
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Send an email notification via Supabase Edge Function
 * 
 * @param recipientEmail - Email address to send to
 * @param type - Email template type
 * @param data - Template data for personalization
 * @returns Response from Edge Function
 * 
 * @example
 * const result = await sendEmail('user@example.com', 'user_created', {
 *   name: 'John Doe'
 * });
 */
export async function sendEmail(
  recipientEmail: string,
  type: EmailType,
  data?: Record<string, any>
): Promise<SendEmailResponse> {
  try {
    console.log('📧 Sending email:', { recipientEmail, type });

    const requestBody = {
      recipientEmail,
      type,
      data: data || {},
    };

    // Use Supabase SDK's functions.invoke() - handles JWT properly
    const { data: result, error } = await supabase.functions.invoke('send-notification', {
      body: requestBody,
    });

    if (error) {
      console.error('❌ Email send failed:', error);
      return {
        success: false,
        error: error.message || 'Email send failed',
        details: error,
      };
    }

    console.log('✅ Email sent successfully:', result?.id);
    return {
      success: true,
      id: result?.id,
      message: result?.message,
    };
  } catch (error: any) {
    console.error('❌ Email send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
      details: error,
    };
  }
}

/**
 * Send welcome email for new user
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  role: string,
  advance?: number
): Promise<SendEmailResponse> {
  return sendEmail(email, 'user_created', {
    name,
    role,
    advance: advance || 0,
    companyName: 'Irrigation Products International Pvt Ltd',
    companySubtitle: 'Claims Management System',
    supportEmail: 'projects@ipi-india.com',
    currencySymbol: '₹',
  });
}

/**
 * Send claim submission notification
 */
export async function sendClaimSubmittedEmail(
  email: string,
  employeeName: string,
  claimAmount: number,
  claimDate: string,
  description: string,
  claimId: string
): Promise<SendEmailResponse> {
  return sendEmail(email, 'claim_submitted', {
    employeeName,
    claimAmount,
    claimDate,
    description,
    claimId,
    companyName: 'Irrigation Products International Pvt Ltd',
    companySubtitle: 'Claims Management System',
    supportEmail: 'projects@ipi-india.com',
    currencySymbol: '₹',
  });
}

/**
 * Send claim approval notification
 */
export async function sendClaimApprovedEmail(
  email: string,
  employeeName: string,
  claimAmount: number,
  claimId: string
): Promise<SendEmailResponse> {
  return sendEmail(email, 'claim_approved', {
    employeeName,
    claimAmount,
    claimId,
    companyName: 'Irrigation Products International Pvt Ltd',
    companySubtitle: 'Claims Management System',
    supportEmail: 'projects@ipi-india.com',
    currencySymbol: '₹',
  });
}

/**
 * Send claim rejection notification
 */
export async function sendClaimRejectedEmail(
  email: string,
  employeeName: string,
  claimAmount: number,
  claimId: string,
  reason: string
): Promise<SendEmailResponse> {
  return sendEmail(email, 'claim_rejected', {
    employeeName,
    claimAmount,
    claimId,
    reason,
    companyName: 'Irrigation Products International Pvt Ltd',
    companySubtitle: 'Claims Management System',
    supportEmail: 'projects@ipi-india.com',
    currencySymbol: '₹',
  });
}
