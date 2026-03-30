const DEFAULT_COMPANY_NAME = 'Irrigation Products International Pvt Ltd';
const DEFAULT_SUBTITLE = 'Claims Management System';
const DEFAULT_SUPPORT_EMAIL = 'projects@ipi-india.com';
const DEFAULT_APP_URL = 'https://github-upload-ready-full-20260329.vercel.app';
const DEFAULT_CURRENCY = '₹';

type Attachment = string | { name?: string; url?: string };

interface BrandData {
  companyName?: string;
  companySubtitle?: string;
  supportEmail?: string;
  logoUrl?: string;
  appUrl?: string;
  loginUrl?: string;
  userGuideUrl?: string;
  currency?: string;
}

interface KeyValueItem {
  label: string;
  value: string;
  html?: boolean;
}

/* --- PREMIUM UI STYLES --- */
const shellStyles = 'width: 100%; max-width: 940px; margin: 0 auto; padding: 12px; background: #e2e8f0;';
const cardStyles = 'width: 100%; background: #ffffff; border: 1px solid #dbe4ee; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 28px -20px rgba(15, 23, 42, 0.28), 0 4px 14px -12px rgba(15, 23, 42, 0.16);';
const heroStyles = 'padding: 26px 28px; background: linear-gradient(145deg, #0f172a 0%, #0b3a5b 52%, #0f766e 100%); color: #ffffff; text-align: center;';
const bodyStyles = 'padding: 24px 28px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.55; font-size: 14px;';
const footerStyles = 'padding: 18px 28px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; color: #64748b; background: #f8fafc; text-align: center;';

const buttonSecondary = 'display: inline-block; padding: 13px 26px; margin: 0 10px 10px 0; border-radius: 999px; font-weight: 600; text-decoration: none; color: #334155; font-size: 14px; background: #f1f5f9; border: 1px solid #cbd5e1;';
const buttonDanger = 'display: inline-block; padding: 13px 26px; margin: 0 10px 10px 0; border-radius: 999px; font-weight: 600; text-decoration: none; color: #ffffff; font-size: 14px; background: #ef4444;';
const buttonSuccess = 'display: inline-block; padding: 13px 26px; margin: 0 10px 10px 0; border-radius: 999px; font-weight: 600; text-decoration: none; color: #ffffff; font-size: 14px; background: #0ea5e9;';

const tableStyles = 'width: 100%; border-collapse: collapse; margin: 18px 0 6px; font-size: 12px;';
const thStyles = 'background: #f8fafc; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; text-align: left; font-weight: 600; color: #475569; white-space: nowrap;';
const tdStyles = 'padding: 11px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: top; word-break: break-word;';
const softCardStyles = 'padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 16px 0; border-left: 4px solid #0ea5e9;';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeText(value: unknown) {
  return escapeHtml(value);
}

function currencySymbol(value?: string) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '₹' || raw === '&#8377;' || raw === 'INR' || raw.toUpperCase() === 'RS') {
    return DEFAULT_CURRENCY;
  }
  return DEFAULT_CURRENCY;
}

function absoluteUrl(url?: string, baseUrl = DEFAULT_APP_URL) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('cid:')) return value;
  const base = String(baseUrl || DEFAULT_APP_URL).trim().replace(/\/+$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

function fmtAmount(value?: number, currency = DEFAULT_CURRENCY) {
  const symbol = currencySymbol(currency);
  const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value || 0));
  return `${symbol}${amount}`;
}

function fmtDate(value?: string) {
  if (!value) return '';
  return escapeHtml(new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }));
}

function safeLink(url?: string) {
  return escapeHtml((url || '').trim());
}

function brand(data: BrandData) {
  const appUrl = data.appUrl || DEFAULT_APP_URL;
  return {
    companyName: data.companyName || DEFAULT_COMPANY_NAME,
    companySubtitle: data.companySubtitle || DEFAULT_SUBTITLE,
    supportEmail: data.supportEmail || DEFAULT_SUPPORT_EMAIL,
    logoUrl: absoluteUrl(data.logoUrl || '/ipi-logo.jpg', appUrl),
    appUrl,
    loginUrl: data.loginUrl || appUrl,
    userGuideUrl: data.userGuideUrl || appUrl,
    currency: currencySymbol(data.currency || DEFAULT_CURRENCY),
  };
}

function sectionTitle(title: string, subtitle?: string) {
  return `
    <div style="margin: 0 0 18px 0; text-align: center;">
      <h2 style="margin: 0 0 6px; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">${safeText(title)}</h2>
      ${subtitle ? `<p style="margin: 0; color: #64748b; font-size: 14px;">${safeText(subtitle)}</p>` : ''}
    </div>
  `;
}

function infoGrid(items: KeyValueItem[]) {
  if (!items.length) return '';

  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const item1 = items[i];
    const item2 = items[i + 1];
    rows.push(`
      <tr>
        <td style="padding: 12px 14px; width: 50%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 4px;">${safeText(item1.label)}</div>
          <div style="font-size: 14px; line-height: 1.45; color: #0f172a; font-weight: 600; word-break: break-word;">${item1.html ? item1.value : safeText(item1.value)}</div>
        </td>
        <td style="padding: 12px 14px; width: 50%; border-bottom: 1px solid #e2e8f0;">
          ${item2 ? `
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 4px;">${safeText(item2.label)}</div>
          <div style="font-size: 14px; line-height: 1.45; color: #0f172a; font-weight: 600; word-break: break-word;">${item2.html ? item2.value : safeText(item2.value)}</div>
          ` : ''}
        </td>
      </tr>
    `);
  }

  return `
    <div style="margin: 18px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        ${rows.join('')}
      </table>
    </div>
  `;
}

function statusPill(label: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info') {
  const palette = {
    info: 'background: #e0f2fe; color: #0369a1;',
    success: 'background: #dcfce7; color: #15803d;',
    warning: 'background: #fef3c7; color: #b45309;',
    danger: 'background: #fee2e2; color: #b91c1c;',
  };
  return `<span style="display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; ${palette[tone]}">${safeText(label)}</span>`;
}

function renderButtons(buttons: Array<{ href?: string; label: string; tone?: 'success' | 'danger' | 'neutral' }>) {
  const items = buttons
    .filter((button) => button.href)
    .map((button) => {
      const style = button.tone === 'success' ? buttonSuccess : button.tone === 'danger' ? buttonDanger : buttonSecondary;
      return `<a href="${button.href}" style="${style}">${safeText(button.label)}</a>`;
    })
    .join('');
  return items ? `<div style="margin: 32px 0 16px; text-align: center;">${items}</div>` : '';
}

function renderAttachments(attachments?: Attachment[]) {
  if (!attachments || attachments.length === 0) return '';
  const rows = attachments.map((attachment) => {
    if (typeof attachment === 'string') {
      return `<li style="margin: 8px 0; color: #334155;">${safeText(attachment)}</li>`;
    }
    if (attachment.url) {
      const label = attachment.name || 'Open document';
      return `<li style="margin: 10px 0;"><a href="${safeLink(attachment.url)}" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">Document: ${safeText(label)}</a></li>`;
    }
    return `<li style="margin: 8px 0;">${safeText(attachment.name || '')}</li>`;
  }).join('');

  return `
    <div style="${softCardStyles}; border-left-color: #cbd5e1;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #0f172a; font-size: 15px;">Attached Documents</p>
      <ul style="margin: 0; padding-left: 20px;">${rows}</ul>
    </div>
  `;
}

function wrapEmail(title: string, body: string, data: BrandData) {
  const info = brand(data);
  const logo = info.logoUrl ? `<img src="${safeLink(info.logoUrl)}" alt="${safeText(info.companyName)}" style="max-height: 48px; margin: 0 auto 16px; display: block; border-radius: 8px;" />` : '';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0; padding:0; background:#f1f5f9; -webkit-font-smoothing: antialiased;">
        <div style="${shellStyles}">
          <div style="${cardStyles}">
            <div style="${heroStyles}">
              ${logo}
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; font-weight: 600;">${safeText(info.companySubtitle)}</div>
              <div style="font-size: 20px; font-weight: 700; margin-top: 8px;">${safeText(info.companyName)}</div>
            </div>
            <div style="${bodyStyles}">
              ${sectionTitle(title)}
              ${body}
            </div>
            <div style="${footerStyles}">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Need Help?</p>
              <p style="margin: 0 0 12px 0;">Contact support at <a href="mailto:${safeText(info.supportEmail)}" style="color: #0ea5e9; text-decoration: none;">${safeText(info.supportEmail)}</a></p>
              <p style="margin: 0; opacity: 0.7;">This is an automated notification from your Claims Management System.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function welcomeUserTemplate(data: {
  employeeName?: string;
  name?: string;
  email?: string;
  role?: string;
  tempPassword?: string;
  loginUrl?: string;
  userGuideUrl?: string;
} & BrandData): { subject: string; html: string } {
  const info = brand(data);
  const userName = data.employeeName || data.name || 'User';
  const loginLink = safeLink(data.loginUrl || info.loginUrl);
  const guideLink = safeLink(data.userGuideUrl || info.userGuideUrl);

  const body = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeText(userName)}</strong>,</p>
    <p>Your account has been configured in the Claims Management System. You have been assigned the role of ${statusPill(data.role || 'User', 'info')}.</p>

    ${infoGrid([
      { label: 'Login Email', value: data.email || '' },
      { label: 'Temporary Password', value: data.tempPassword || '' },
    ])}

    <div style="${softCardStyles}; border-left-color: #10b981;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #0f172a;">Getting Started</p>
      <ol style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.8;">
        <li>Click the button below to access the system.</li>
        <li>Sign in using your temporary password.</li>
        <li><strong>Important:</strong> Change your password immediately upon logging in.</li>
      </ol>
    </div>

    ${renderButtons([
      { href: loginLink, label: 'Sign In Now', tone: 'success' },
      { href: guideLink, label: 'Read User Guide', tone: 'neutral' },
    ])}
  `;

  return {
    subject: `Welcome to ${info.companyName}`,
    html: wrapEmail('Welcome Aboard', body, info),
  };
}

export function claimSubmittedUserTemplate(data: {
  claim_id?: string;
  claim_number: string;
  generated_on?: string;
  submitted_by?: string;
  submission_date?: string;
  project_site?: string;
  primary_project_code?: string;
  status?: string;
  items: Array<any>;
  total_amount: number;
  total_with_bill?: number;
  total_without_bill?: number;
  attachments?: Attachment[];
  employee_name?: string;
} & BrandData): { subject: string; html: string } {
  const info = brand(data);
  const rows = data.items.map((item) => `
    <tr>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.category)}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${safeText(item.claimDate || '')}</div>
      </td>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.projectCode || 'General')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.description)}</div>
      </td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.amountWithBill ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.amountWithoutBill ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; font-weight: 600;">${fmtAmount(item.totalAmount ?? item.amount, info.currency)}</td>
    </tr>
  `).join('');

  const body = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeText(data.employee_name || data.submitted_by || 'User')}</strong>,</p>
    <p>Your claim has been successfully registered and moved into the review workflow.</p>

    ${infoGrid([
      { label: 'Claim Number', value: data.claim_number },
      { label: 'Current Status', value: statusPill(data.status || 'Pending Review', 'warning'), html: true },
      { label: 'Submission Date', value: fmtDate(data.submission_date) },
      { label: 'Project Site', value: data.project_site || 'N/A' },
      { label: 'Submitted By', value: data.employee_name || data.submitted_by || 'N/A' },
      { label: 'Primary Project', value: data.primary_project_code || 'N/A' },
      { label: 'With Bill Total', value: fmtAmount(data.total_with_bill ?? 0, info.currency) },
      { label: 'Without Bill Total', value: fmtAmount(data.total_without_bill ?? 0, info.currency) },
    ])}

    <div style="${softCardStyles}; border-left-color: #0f766e;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">Claim Summary</p>
      <p style="margin: 0; color: #475569;">
        Submitted total: <strong>${fmtAmount(data.total_amount, info.currency)}</strong>,
        with bills: <strong>${fmtAmount(data.total_with_bill ?? 0, info.currency)}</strong>,
        without bills: <strong>${fmtAmount(data.total_without_bill ?? 0, info.currency)}</strong>.
      </p>
    </div>

    <div style="margin: 32px 0 16px;">
      <h3 style="margin: 0; font-size: 16px; color: #0f172a;">Line Items</h3>
    </div>
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <table style="${tableStyles}; margin: 0;">
        <thead>
          <tr>
            <th style="${thStyles}; width: 22%;">Category</th>
            <th style="${thStyles}; width: 34%;">Project & Description</th>
            <th style="${thStyles}; width: 14%; text-align: right;">With Bill</th>
            <th style="${thStyles}; width: 14%; text-align: right;">Without Bill</th>
            <th style="${thStyles}; width: 16%; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
          <tr>
            <td colspan="4" style="${tdStyles}; text-align: right; font-weight: 600; padding: 16px;">Total Claim Amount</td>
            <td style="${tdStyles}; text-align: right; font-weight: 700; color: #0ea5e9; font-size: 16px; padding: 16px;">${fmtAmount(data.total_amount, info.currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${renderAttachments(data.attachments)}
  `;

  return {
    subject: `Claim Submitted: ${data.claim_number}`,
    html: wrapEmail('Claim Successfully Submitted', body, info),
  };
}

export function claimSubmittedAdminTemplate(data: any): { subject: string; html: string } {
  const info = brand(data);
  const rows = data.items.map((item: any) => `
    <tr>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.category)}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${safeText(item.claimDate || '')}</div>
      </td>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.projectCode || 'General')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.description)}</div>
      </td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.amountWithBill ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.amountWithoutBill ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; font-weight: 600;">${fmtAmount(item.totalAmount ?? item.amount, info.currency)}</td>
    </tr>
  `).join('');

  const body = `
    <p style="margin-top: 0; font-size: 16px;">A new claim requires your administrative review.</p>

    ${infoGrid([
      { label: 'Claim Number', value: data.claim_number },
      { label: 'Employee Name', value: data.employee_name },
      { label: 'Employee Email', value: data.employee_email || 'N/A' },
      { label: 'Project Site', value: data.project_site || 'N/A' },
      { label: 'Submission Date', value: fmtDate(data.submission_date) },
      { label: 'Primary Project', value: data.primary_project_code || 'N/A' },
      { label: 'With Bill Total', value: fmtAmount(data.total_with_bill ?? 0, info.currency) },
      { label: 'Without Bill Total', value: fmtAmount(data.total_without_bill ?? 0, info.currency) },
      { label: 'Total Amount', value: fmtAmount(data.total_amount, info.currency) },
    ])}

    <div style="${softCardStyles}">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">Required Action</p>
      <p style="margin: 0; color: #475569;">Please verify the line items, check the attached bills, review with-bill versus without-bill amounts, enter any required deductions, and forward the claim for final approval.</p>
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 24px;">
      <table style="${tableStyles}; margin: 0;">
        <thead>
          <tr>
            <th style="${thStyles}">Category</th>
            <th style="${thStyles}">Project & Description</th>
            <th style="${thStyles}; text-align: right;">With Bill</th>
            <th style="${thStyles}; text-align: right;">Without Bill</th>
            <th style="${thStyles}; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
          <tr>
            <td colspan="4" style="${tdStyles}; text-align: right; font-weight: 600;">Total Claim Amount</td>
            <td style="${tdStyles}; text-align: right; font-weight: 700; color: #0ea5e9;">${fmtAmount(data.total_amount, info.currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${renderAttachments(data.attachments)}
    ${renderButtons([
      { href: safeLink(data.review_link), label: 'Review Claim Now', tone: 'success' },
    ])}
  `;
  return {
    subject: `Action Required: Review Claim ${data.claim_number}`,
    html: wrapEmail('Admin Review Requested', body, info),
  };
}

export function claimSubmittedManagerTemplate(data: any): { subject: string; html: string } {
  const info = brand(data);
  const rows = data.items.map((item: any) => `
    <tr>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.category)}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.projectCode || 'General')} | ${safeText(item.claimDate || '')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.description)}</div>
      </td>
      <td style="${tdStyles}; text-align: right; color: #64748b;">${fmtAmount(item.totalAmount ?? item.amount, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; color: #b91c1c;">${fmtAmount(item.deductionAmount ?? item.deduction_amount ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; font-weight: 600; color: #0f172a;">${fmtAmount(item.approvedAmount ?? item.totalAmount ?? item.amount, info.currency)}</td>
    </tr>
  `).join('');

  const body = `
    <p style="margin-top: 0; font-size: 16px;">A claim has passed Admin verification and is awaiting your final approval.</p>

    ${infoGrid([
      { label: 'Claim Number', value: data.claim_number },
      { label: 'Submitted By', value: data.employee_name },
      { label: 'Submission Date', value: fmtDate(data.submission_date) },
      { label: 'Project Site', value: data.project_site || 'N/A' },
      { label: 'Admin Status', value: statusPill(data.admin_status || 'Verified', 'success'), html: true },
      { label: 'Original Total', value: fmtAmount(data.original_amount ?? data.total_amount, info.currency) },
      { label: 'Deducted Total', value: fmtAmount(data.deduction_total ?? 0, info.currency) },
      { label: 'Final Amount', value: fmtAmount(data.total_amount, info.currency) },
    ])}

    ${(data.deduction_total != null && data.deduction_total > 0) ? `
      <div style="${softCardStyles}; border-left-color: #f59e0b; background: #fffbeb;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #b45309;">Admin Modification Note</p>
        <p style="margin: 0; color: #92400e;">The admin applied a total deduction of <strong>${fmtAmount(data.deduction_total, info.currency)}</strong> to the original claim.</p>
        ${data.admin_remarks ? `<p style="margin: 8px 0 0; color: #92400e;"><em>"${safeText(data.admin_remarks)}"</em></p>` : ''}
      </div>
    ` : ''}

    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 24px;">
      <table style="${tableStyles}; margin: 0;">
        <thead>
          <tr>
            <th style="${thStyles}">Details</th>
            <th style="${thStyles}; text-align: right;">Original</th>
            <th style="${thStyles}; text-align: right;">Deducted</th>
            <th style="${thStyles}; text-align: right;">Approved</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
          <tr>
            <td colspan="3" style="${tdStyles}; text-align: right; font-weight: 600; padding: 16px;">Final Total</td>
            <td style="${tdStyles}; text-align: right; font-weight: 700; color: #0ea5e9; font-size: 16px; padding: 16px;">${fmtAmount(data.total_amount, info.currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="${softCardStyles}; border-left-color: #0ea5e9;">
      <p style="margin: 0 0 6px 0; font-weight: 600; color: #0f172a;">Approval Actions</p>
      <p style="margin: 0; color: #475569;">Use the quick links below to approve or reject the claim directly from this email, or open the full review screen for a detailed check.</p>
    </div>

    ${renderAttachments(data.attachments)}
    ${renderButtons([
      { href: safeLink(data.approve_link), label: 'Approve Claim', tone: 'success' },
      { href: safeLink(data.reject_link), label: 'Reject Claim', tone: 'danger' },
      { href: safeLink(data.review_link), label: 'Open Full Review', tone: 'neutral' },
    ])}
  `;
  return {
    subject: `Final Approval Required: ${data.claim_number}`,
    html: wrapEmail('Final Approval Required', body, info),
  };
}

export function claimApprovedTemplate(data: any): { subject: string; html: string } {
  const info = brand(data);
  const rows = (data.items || []).map((item: any) => `
    <tr>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.category || '-')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.description || '-')}</div>
      </td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.totalAmount ?? item.amount, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; color: #b91c1c;">${fmtAmount(item.deductionAmount ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; font-weight: 600; color: #0f172a;">${fmtAmount(item.approvedAmount ?? item.totalAmount ?? item.amount, info.currency)}</td>
    </tr>
  `).join('');

  const body = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeText(data.employee_name || 'User')}</strong>,</p>
    <p>Good news. Your claim has been fully approved.</p>

    ${infoGrid([
      { label: 'Claim Number', value: data.claim_no },
      { label: 'Status', value: statusPill('Approved', 'success'), html: true },
      { label: 'Approved By', value: data.approved_by },
      { label: 'Approved Total', value: fmtAmount(data.total, info.currency) },
      { label: 'Project Site', value: data.project_site || 'N/A' },
      { label: 'Original Total', value: fmtAmount(data.original_total ?? data.total, info.currency) },
      { label: 'Deducted Total', value: fmtAmount(data.deduction_total ?? 0, info.currency) },
      { label: 'Net Settled', value: fmtAmount(data.total, info.currency) },
    ])}

    ${(data.original_total != null || data.deduction_total != null) ? `
      <div style="${softCardStyles}; border-left-color: #0ea5e9;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">Claim Summary</p>
        <p style="margin: 0; color: #475569;">
          Original claim: <strong>${fmtAmount(data.original_total ?? data.total, info.currency)}</strong>,
          deduction: <strong>${fmtAmount(data.deduction_total ?? 0, info.currency)}</strong>,
          approved: <strong>${fmtAmount(data.total, info.currency)}</strong>.
        </p>
      </div>
    ` : ''}

    ${rows ? `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 24px;">
        <table style="${tableStyles}; margin: 0;">
          <thead>
            <tr>
              <th style="${thStyles}">Details</th>
              <th style="${thStyles}; text-align: right;">Original</th>
              <th style="${thStyles}; text-align: right;">Deducted</th>
              <th style="${thStyles}; text-align: right;">Approved</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
            <tr>
              <td style="${tdStyles}; text-align: right; font-weight: 600;" colspan="3">Final Settled Total</td>
              <td style="${tdStyles}; text-align: right; font-weight: 700; color: #0ea5e9; font-size: 16px;">${fmtAmount(data.total, info.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : ''}

    ${data.remarks ? `
      <div style="${softCardStyles}; border-left-color: #10b981;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #064e3b;">Approver Remarks</p>
        <p style="margin: 0; color: #0f172a; font-style: italic;">"${safeText(data.remarks)}"</p>
      </div>
    ` : ''}
  `;
  return {
    subject: `Claim Approved: ${data.claim_no}`,
    html: wrapEmail('Claim Approved', body, info),
  };
}

export function claimRejectedTemplate(data: any): { subject: string; html: string } {
  const info = brand(data);
  const rows = (data.items || []).map((item: any) => `
    <tr>
      <td style="${tdStyles}">
        <div style="font-weight: 600;">${safeText(item.category || '-')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.projectCode || 'General')} | ${safeText(item.claimDate || '')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${safeText(item.description || '-')}</div>
      </td>
      <td style="${tdStyles}; text-align: right;">${fmtAmount(item.totalAmount ?? item.amount, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; color: #b91c1c;">${fmtAmount(item.deductionAmount ?? 0, info.currency)}</td>
      <td style="${tdStyles}; text-align: right; font-weight: 600; color: #0f172a;">${fmtAmount(item.approvedAmount ?? item.totalAmount ?? item.amount, info.currency)}</td>
    </tr>
  `).join('');
  const body = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeText(data.employee_name || 'User')}</strong>,</p>
    <p>Your recent claim submission was rejected during the review process.</p>

    ${infoGrid([
      { label: 'Claim Number', value: data.claim_no },
      { label: 'Status', value: statusPill('Rejected', 'danger'), html: true },
      { label: 'Reviewed By', value: data.rejected_by },
      { label: 'Rejected At Stage', value: data.rejected_stage || 'Review' },
      { label: 'Project Site', value: data.project_site || 'N/A' },
      { label: 'Submission Date', value: fmtDate(data.submission_date) },
      { label: 'Original Total', value: fmtAmount(data.original_total ?? data.total, info.currency) },
      { label: 'Reviewed Total', value: fmtAmount(data.reviewed_total ?? data.total, info.currency) },
      { label: 'Deducted Total', value: fmtAmount(data.deduction_total ?? 0, info.currency) },
    ])}

    <div style="${softCardStyles}; border-left-color: #ef4444; background: #fef2f2;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b;">Claim Summary</p>
      <p style="margin: 0; color: #7f1d1d;">
        Original submitted total: <strong>${fmtAmount(data.original_total ?? data.total, info.currency)}</strong>,
        last reviewed total: <strong>${fmtAmount(data.reviewed_total ?? data.total, info.currency)}</strong>,
        deductions noted: <strong>${fmtAmount(data.deduction_total ?? 0, info.currency)}</strong>.
      </p>
    </div>

    <div style="${softCardStyles}; border-left-color: #ef4444; background: #fef2f2;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b;">Reason for Rejection</p>
      <p style="margin: 0; color: #7f1d1d;">${safeText(data.reason)}</p>
    </div>

    ${rows ? `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 24px;">
        <table style="${tableStyles}; margin: 0;">
          <thead>
            <tr>
              <th style="${thStyles}">Details</th>
              <th style="${thStyles}; text-align: right;">Original</th>
              <th style="${thStyles}; text-align: right;">Deducted</th>
              <th style="${thStyles}; text-align: right;">Reviewed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
            <tr>
              <td colspan="3" style="${tdStyles}; text-align: right; font-weight: 600;">Rejected Claim Total</td>
              <td style="${tdStyles}; text-align: right; font-weight: 700; color: #ef4444;">${fmtAmount(data.reviewed_total ?? data.total, info.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : ''}

    ${renderAttachments(data.attachments)}
  `;
  return {
    subject: `Claim Rejected: ${data.claim_no}`,
    html: wrapEmail('Claim Rejected', body, info),
  };
}

export function userCreatedTemplate(data: any) {
  return welcomeUserTemplate(data);
}

export function passwordResetTemplate(data: any): { subject: string; html: string } {
  const info = brand(data);
  const body = `
    <p style="margin-top: 0; font-size: 16px;">Hello <strong>${safeText(data.employeeName || 'User')}</strong>,</p>
    <p>We received a request to reset the password associated with your account.</p>

    <div style="${softCardStyles}; border-left-color: #0ea5e9;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">Password Reset</p>
      <p style="margin: 0; color: #475569;">Click the button below to choose a new password. This link will expire in ${safeText(data.expiresIn || '1 hour')}.</p>
    </div>

    ${renderButtons([
      { href: safeLink(data.resetLink), label: 'Reset My Password', tone: 'success' },
    ])}

    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `;
  return {
    subject: 'Password Reset Request',
    html: wrapEmail('Reset Your Password', body, info),
  };
}

export type EmailTemplateType =
  | 'welcome_user'
  | 'claim_submitted'
  | 'claim_submitted_user'
  | 'claim_submitted_admin'
  | 'claim_submitted_manager'
  | 'claim_approved'
  | 'claim_rejected'
  | 'user_created'
  | 'password_reset';

export function getTemplate(type: EmailTemplateType, data: any): { subject: string; html: string } {
  switch (type) {
    case 'welcome_user':
      return welcomeUserTemplate(data);
    case 'claim_submitted':
    case 'claim_submitted_user':
      return claimSubmittedUserTemplate(data);
    case 'claim_submitted_admin':
      return claimSubmittedAdminTemplate(data);
    case 'claim_submitted_manager':
      return claimSubmittedManagerTemplate(data);
    case 'claim_approved':
      return claimApprovedTemplate(data);
    case 'claim_rejected':
      return claimRejectedTemplate(data);
    case 'user_created':
      return userCreatedTemplate(data);
    case 'password_reset':
      return passwordResetTemplate(data);
    default:
      throw new Error(`Unknown email template type: ${type}`);
  }
}
