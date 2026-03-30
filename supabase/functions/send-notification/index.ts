import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getTemplate, EmailTemplateType } from "./emailTemplates.ts";
import nodemailer from "npm:nodemailer";

const DEFAULT_FROM_NAME = 'Claim App Notifications';
const DEFAULT_RESEND_FROM_EMAIL = 'onboarding@resend.dev';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://github-upload-ready-full-20260329.vercel.app',
  'https://github-upload-ready-full-20260329-pankaradithya-4791s-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:4173',
];
const ALLOWED_METHODS = 'POST, OPTIONS';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const SEND_RETRY_DELAYS_MS = [0, 1000, 2500];
const TEMPLATE_TYPES: EmailTemplateType[] = [
  'welcome_user',
  'claim_submitted',
  'claim_submitted_user',
  'claim_submitted_admin',
  'claim_submitted_manager',
  'claim_approved',
  'claim_rejected',
  'user_created',
  'password_reset',
];

function getAllowedOrigins() {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])];
}

function resolveCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!requestOrigin) {
    return {
      'Access-Control-Allow-Origin': allowedOrigins[0] || '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      Vary: 'Origin',
    };
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)) {
    return {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      Vary: 'Origin',
    };
  }

  console.error('Email function rejected origin', {
    requestOrigin,
    allowedOrigins,
  });
  return null;
}

function jsonResponse(req: Request, status: number, payload: Record<string, unknown>) {
  const corsHeaders = resolveCorsHeaders(req);
  if (!corsHeaders) {
    return new Response(
      JSON.stringify({ success: false, error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

function isValidTemplateType(value: unknown): value is EmailTemplateType {
  return typeof value === 'string' && TEMPLATE_TYPES.includes(value as EmailTemplateType);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

async function sendWithRetry(transporter: nodemailer.Transporter, mailOptions: nodemailer.SendMailOptions) {
  let lastError: unknown = null;

  for (const delayMs of SEND_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      console.error('Email send attempt failed', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown email send failure'));
}

async function sendWithGmail(
  gmailUser: string,
  gmailPassword: string,
  emailFromName: string,
  recipientEmail: string,
  template: { subject: string; html: string },
) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });

  const mailResult = await sendWithRetry(transporter, {
    from: `"${emailFromName}" <${gmailUser}>`,
    to: recipientEmail,
    subject: template.subject,
    html: template.html,
  });

  return {
    messageId: String(mailResult?.messageId || ''),
  };
}

async function sendWithResend(
  apiKey: string,
  fromEmail: string,
  emailFromName: string,
  recipientEmail: string,
  template: { subject: string; html: string },
) {
  let lastError: unknown = null;

  for (const delayMs of SEND_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `"${emailFromName}" <${fromEmail}>`,
          to: [recipientEmail],
          subject: template.subject,
          html: template.html,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === 'string'
            ? payload.message
            : typeof payload?.error?.message === 'string'
              ? payload.error.message
              : `Resend API returned ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      lastError = error;
      console.error('Resend email send attempt failed', {
        to: recipientEmail,
        subject: template.subject,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Unknown Resend send failure'));
}

Deno.serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req);

  if (!corsHeaders) {
    return new Response(
      JSON.stringify({ success: false, error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, {
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || DEFAULT_RESEND_FROM_EMAIL).trim();
    const emailFromName = (Deno.env.get('EMAIL_FROM_NAME') || DEFAULT_FROM_NAME).trim();

    const hasGmail = Boolean(gmailUser && gmailPassword);
    const hasResend = Boolean(resendApiKey);

    if (!hasGmail && !hasResend) {
      console.error('Email function missing configured providers');
      return jsonResponse(req, 500, {
        success: false,
        error: 'No email provider configured. Set RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD.',
      });
    }

    let requestBody: any;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return jsonResponse(req, 400, {
        success: false,
        error: 'Invalid JSON in request body',
        details: String(parseError),
      });
    }

    const recipientEmail = String(requestBody?.recipientEmail || '').trim().toLowerCase();
    const type = requestBody?.type;
    const data = (typeof requestBody?.data === 'object' && requestBody?.data !== null) ? requestBody.data : {};

    if (!isValidEmail(recipientEmail)) {
      return jsonResponse(req, 400, {
        success: false,
        error: 'recipientEmail is required and must be a valid email address',
      });
    }

    if (!isValidTemplateType(type)) {
      return jsonResponse(req, 400, {
        success: false,
        error: 'Invalid email template type',
      });
    }

    const template = getTemplate(type, data);
    const deliveryErrors: string[] = [];
    let providerUsed = '';
    let messageId = '';

    if (hasGmail) {
      try {
        const gmailResult = await sendWithGmail(
          gmailUser!,
          gmailPassword!,
          emailFromName,
          recipientEmail,
          template,
        );
        providerUsed = 'gmail';
        messageId = gmailResult.messageId;
      } catch (error) {
        deliveryErrors.push(`Gmail: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!providerUsed && hasResend) {
      try {
        const resendResult = await sendWithResend(
          resendApiKey!,
          resendFromEmail,
          emailFromName,
          recipientEmail,
          template,
        );
        providerUsed = 'resend';
        messageId = String(resendResult?.id || '');
      } catch (error) {
        deliveryErrors.push(`Resend: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!providerUsed) {
      return jsonResponse(req, 500, {
        success: false,
        error: 'All configured email providers failed',
        details: deliveryErrors.join(' | '),
      });
    }

    console.log(`Email sent: type=${type}, recipient=${recipientEmail}, provider=${providerUsed}`);

    return jsonResponse(req, 200, {
      success: true,
      message: 'Email sent successfully',
      provider: providerUsed,
      messageId,
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error('Unexpected error in send-notification:', error);
    return jsonResponse(req, 500, {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
