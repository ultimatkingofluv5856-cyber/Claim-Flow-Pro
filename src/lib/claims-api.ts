import { supabase } from '@/integrations/supabase/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { rateLimiters } from '@/lib/security-rate-limiting';
import { publishManagerApprovalEvent, publishAdminApprovalEvent, publishRejectionEvent } from '@/lib/event-bus';

export interface ProjectCodeOption {
  code: string;
  label: string;
  project: string;
  allowsAllCategories: boolean;
  expenseCategories: string[];
}

const DEFAULT_APP_URL = 'https://github-upload-ready-full-20260329.vercel.app';
const EMAIL_RETRY_DELAYS_MS = [0, 800, 1800];
const RUPEE_SYMBOL = '\u20B9';

interface ClaimExpenseReviewInput {
  expenseId?: string;
  approvedAmount?: number;
  remarks?: string;
}

interface AdminClaimReviewInput {
  remarks?: string;
  items: ClaimExpenseReviewInput[];
}

interface StoredReviewMetadataItem {
  expenseId: string;
  approvedAmount: number;
  deductionAmount: number;
  remarks: string;
}

interface StoredReviewMetadata {
  approvedTotal: number;
  deductionTotal: number;
  items: StoredReviewMetadataItem[];
}

interface LegacyAdminReviewRecovery {
  approvedTotal: number;
  deductionTotal: number;
  remarks: string;
  items: StoredReviewMetadataItem[];
}

const REVIEW_METADATA_MARKER = '[claimflow-review]';
const AUDIT_REVIEW_METADATA_MARKER = '[claimflow-review-audit]';

function parseMoney(value: unknown): number {
  const parsed = parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampMoney(value: number, min = 0): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value * 100) / 100);
}

function getDisplayClaimNo(claimNumber: unknown, claimId: unknown) {
  const normalizedClaimNumber = String(claimNumber || '').trim();
  return normalizedClaimNumber || String(claimId || '').trim();
}

function replaceClaimReference(description: unknown, internalClaimId: unknown, displayClaimNo: string) {
  const normalizedDescription = String(description || '').trim();
  const normalizedClaimId = String(internalClaimId || '').trim();

  if (!normalizedDescription || !normalizedClaimId || !displayClaimNo || normalizedClaimId === displayClaimNo) {
    return normalizedDescription;
  }

  return normalizedDescription.split(normalizedClaimId).join(displayClaimNo);
}

function parseReviewMetadata(description: unknown): { remarks: string; metadata: StoredReviewMetadata | null } {
  const rawDescription = String(description || '');
  const markerIndex = rawDescription.indexOf(REVIEW_METADATA_MARKER);

  if (markerIndex === -1) {
    return {
      remarks: rawDescription.trim(),
      metadata: null,
    };
  }

  const remarks = rawDescription.slice(0, markerIndex).trim();
  const payload = rawDescription.slice(markerIndex + REVIEW_METADATA_MARKER.length).trim();

  if (!payload) {
    return { remarks, metadata: null };
  }

  try {
    const parsed = JSON.parse(payload) as Partial<StoredReviewMetadata>;
    return {
      remarks,
      metadata: {
        approvedTotal: clampMoney(parseMoney(parsed.approvedTotal)),
        deductionTotal: clampMoney(parseMoney(parsed.deductionTotal)),
        items: Array.isArray(parsed.items)
          ? parsed.items.map((item) => ({
              expenseId: String(item?.expenseId || '').trim(),
              approvedAmount: clampMoney(parseMoney(item?.approvedAmount)),
              deductionAmount: clampMoney(parseMoney(item?.deductionAmount)),
              remarks: String(item?.remarks || '').trim(),
            })).filter((item) => item.expenseId)
          : [],
      },
    };
  } catch {
    return {
      remarks: rawDescription.trim(),
      metadata: null,
    };
  }
}

function parseAuditReviewMetadata(details: unknown): { summary: string; metadata: StoredReviewMetadata | null } {
  const rawDetails = String(details || '');
  const markerIndex = rawDetails.indexOf(AUDIT_REVIEW_METADATA_MARKER);

  if (markerIndex === -1) {
    return {
      summary: rawDetails.trim(),
      metadata: null,
    };
  }

  const summary = rawDetails.slice(0, markerIndex).trim();
  const payload = rawDetails.slice(markerIndex + AUDIT_REVIEW_METADATA_MARKER.length).trim();

  if (!payload) {
    return { summary, metadata: null };
  }

  try {
    const parsed = JSON.parse(payload) as Partial<StoredReviewMetadata>;
    return {
      summary,
      metadata: {
        approvedTotal: clampMoney(parseMoney(parsed.approvedTotal)),
        deductionTotal: clampMoney(parseMoney(parsed.deductionTotal)),
        items: Array.isArray(parsed.items)
          ? parsed.items.map((item) => ({
              expenseId: String(item?.expenseId || '').trim(),
              approvedAmount: clampMoney(parseMoney(item?.approvedAmount)),
              deductionAmount: clampMoney(parseMoney(item?.deductionAmount)),
              remarks: String(item?.remarks || '').trim(),
            })).filter((item) => item.expenseId)
          : [],
      },
    };
  } catch {
    return {
      summary: rawDetails.trim(),
      metadata: null,
    };
  }
}

function buildReviewDescription(remarks: string | undefined, metadata: StoredReviewMetadata) {
  const normalizedRemarks = String(remarks || '').trim();
  const serializedMetadata = JSON.stringify(metadata);
  return normalizedRemarks
    ? `${normalizedRemarks}\n\n${REVIEW_METADATA_MARKER}${serializedMetadata}`
    : `${REVIEW_METADATA_MARKER}${serializedMetadata}`;
}

function buildAuditReviewDetails(remarks: string | undefined, metadata: StoredReviewMetadata) {
  const normalizedRemarks = String(remarks || '').trim();
  const serializedMetadata = JSON.stringify(metadata);
  const summary = normalizedRemarks
    ? `Approved total: ₹${metadata.approvedTotal} | ${normalizedRemarks}`
    : `Approved total: ₹${metadata.approvedTotal}`;
  return `${summary}\n\n${AUDIT_REVIEW_METADATA_MARKER}${serializedMetadata}`;
}

function getMetadataReviewItem(claim: any, expenseId: string) {
  const { metadata } = parseReviewMetadata(claim?.admin_description);
  if (!metadata) return null;
  return metadata.items.find((item) => item.expenseId === expenseId) || null;
}

function getClaimSubmittedTotal(claim: any) {
  return parseMoney(claim?.grand_total ?? (parseMoney(claim?.total_with_bill) + parseMoney(claim?.total_without_bill)));
}

function parseLegacyApprovedTotal(details: unknown) {
  const rawDetails = String(details || '').trim();
  if (!rawDetails) return null;

  const match = rawDetails.match(/approved total:\s*[^0-9-]*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (!match) return null;

  return clampMoney(parseMoney(match[1].replace(/,/g, '')));
}

function getDerivedAdminApprovalStatus(claim: any) {
  const explicitStatus = String(claim?.admin_approval_status || '').trim();
  if (explicitStatus) return explicitStatus;

  const claimStatus = String(claim?.status || '').toLowerCase();
  const hasAdminAction = Boolean(claim?.admin_email || claim?.admin_approval_date || claim?.admin_description);
  if (hasAdminAction && (claimStatus === 'pending manager approval' || claimStatus === 'approved')) {
    return 'Verified';
  }

  return '';
}

function hasPersistedExpenseReview(expense: any) {
  const originalTotal = getExpenseOriginalTotal(expense);
  const approvedAmount = parseMoney(expense?.approved_amount);
  const deductionAmount = parseMoney(expense?.deduction_amount);
  const remarks = String(expense?.approval_remarks || '').trim();

  if (remarks) return true;
  if (deductionAmount > 0) return true;
  if (originalTotal <= 0) return approvedAmount !== 0 || deductionAmount !== 0;

  return approvedAmount > 0 || Math.abs(approvedAmount - originalTotal) < 0.005;
}

function getExpenseReviewState(expense: any) {
  const originalTotal = getExpenseOriginalTotal(expense);

  if (!hasPersistedExpenseReview(expense)) {
    return {
      approvedAmount: originalTotal,
      deductionAmount: 0,
      hasPersistedReview: false,
    };
  }

  const approvedAmount = clampMoney(Math.min(parseMoney(expense?.approved_amount ?? originalTotal), originalTotal));
  const deductionAmount = clampMoney(Math.max(parseMoney(expense?.deduction_amount ?? Math.max(0, originalTotal - approvedAmount)), 0));

  return {
    approvedAmount,
    deductionAmount,
    hasPersistedReview: true,
  };
}

function getClaimAdminReviewSnapshot(claim: any) {
  const expenses = Array.isArray(claim?.expense_items) ? claim.expense_items : [];
  const { metadata } = parseReviewMetadata(claim?.admin_description);
  const lineItemTotals = expenses.reduce((acc, expense) => {
    const review = getExpenseReviewState(expense);
    acc.approvedTotal += review.approvedAmount;
    acc.deductionTotal += review.deductionAmount;
    if (review.hasPersistedReview) acc.persistedItemCount += 1;
    return acc;
  }, { approvedTotal: 0, deductionTotal: 0, persistedItemCount: 0 });

  const claimLevelApproved = clampMoney(parseMoney(claim?.admin_approved_total ?? claim?.reviewed_total));
  const claimLevelDeduction = clampMoney(parseMoney(claim?.admin_deduction_total));
  const status = getDerivedAdminApprovalStatus(claim);
  const hasClaimLevelReview = claimLevelApproved > 0 || claimLevelDeduction > 0;
  const hasPersistedLineItems = lineItemTotals.persistedItemCount > 0;
  const hasMetadataReview = Boolean(metadata && (metadata.items.length > 0 || metadata.approvedTotal > 0 || metadata.deductionTotal > 0));
  const hasAdminReview = Boolean(status) || hasClaimLevelReview || hasPersistedLineItems;

  return {
    status,
    hasAdminReview: hasAdminReview || hasMetadataReview,
    hasPersistedLineItems,
    approvedTotal: hasPersistedLineItems
      ? clampMoney(lineItemTotals.approvedTotal)
      : hasClaimLevelReview
        ? claimLevelApproved
        : hasMetadataReview
          ? metadata!.approvedTotal
          : hasAdminReview
          ? getClaimSubmittedTotal(claim)
          : 0,
    deductionTotal: hasPersistedLineItems
      ? clampMoney(lineItemTotals.deductionTotal)
      : hasClaimLevelReview
        ? claimLevelDeduction
        : hasMetadataReview
          ? metadata!.deductionTotal
        : 0,
  };
}

function applyLegacyAdminReviewRecovery(
  claim: any,
  adminReview: ReturnType<typeof getClaimAdminReviewSnapshot>,
  recovery?: LegacyAdminReviewRecovery | null
) {
  if (!recovery) return adminReview;

  const { metadata } = parseReviewMetadata(claim?.admin_description);
  const hasClaimLevelReview = clampMoney(parseMoney(claim?.admin_approved_total ?? claim?.reviewed_total)) > 0
    || clampMoney(parseMoney(claim?.admin_deduction_total)) > 0;

  if (metadata || hasClaimLevelReview || adminReview.hasPersistedLineItems) {
    return adminReview;
  }

  return {
    ...adminReview,
    hasAdminReview: true,
    approvedTotal: recovery.approvedTotal,
    deductionTotal: recovery.deductionTotal,
    usedLegacyRecovery: true,
  };
}

function getLegacySingleExpenseReview(
  claim: any,
  expenses: any[],
  adminReview: ReturnType<typeof getClaimAdminReviewSnapshot> & { usedLegacyRecovery?: boolean }
) {
  if (!adminReview.usedLegacyRecovery || expenses.length !== 1) return null;

  const originalAmount = getExpenseOriginalTotal(expenses[0]);
  const approvedAmount = clampMoney(Math.min(adminReview.approvedTotal, originalAmount));
  const deductionAmount = clampMoney(Math.max(0, originalAmount - approvedAmount));

  return {
    approvedAmount,
    deductionAmount,
  };
}

function getLegacyRecoveryItem(
  recovery: LegacyAdminReviewRecovery | null | undefined,
  expenseId: string
) {
  if (!recovery) return null;
  return recovery.items.find((item) => item.expenseId === expenseId) || null;
}

async function getLegacyAdminReviewRecoveryMap(claims: Array<{ claimId: string; submittedTotal: number }>) {
  const normalizedClaims = claims
    .map((claim) => ({
      claimId: String(claim.claimId || '').trim(),
      submittedTotal: clampMoney(parseMoney(claim.submittedTotal)),
    }))
    .filter((claim) => claim.claimId);

  if (normalizedClaims.length === 0) {
    return new Map<string, LegacyAdminReviewRecovery>();
  }

  const claimIds = normalizedClaims.map((claim) => claim.claimId);
  const submittedTotals = new Map(normalizedClaims.map((claim) => [claim.claimId, claim.submittedTotal]));
  const { data } = await supabase
    .from('audit_logs' as any)
    .select('target_id, details, created_at, action')
    .in('action', ['claim_admin_verified', 'claim_admin_reviewed'])
    .in('target_id', claimIds)
    .order('created_at', { ascending: false });

  const recoveryMap = new Map<string, LegacyAdminReviewRecovery>();
  for (const row of (data || []) as any[]) {
    const claimId = String(row?.target_id || '').trim();
    if (!claimId || recoveryMap.has(claimId)) continue;

    const parsedAuditReview = parseAuditReviewMetadata(row?.details);
    const approvedTotal = parsedAuditReview.metadata?.approvedTotal ?? parseLegacyApprovedTotal(row?.details);
    if (approvedTotal == null) continue;

    const submittedTotal = submittedTotals.get(claimId) ?? approvedTotal;
    recoveryMap.set(claimId, {
      approvedTotal,
      deductionTotal: parsedAuditReview.metadata?.deductionTotal ?? clampMoney(Math.max(0, submittedTotal - approvedTotal)),
      remarks: parsedAuditReview.summary,
      items: parsedAuditReview.metadata?.items || [],
    });
  }

  return recoveryMap;
}

function getClaimTotal(claim: any) {
  const adminStatus = getDerivedAdminApprovalStatus(claim).toLowerCase();
  if (adminStatus === 'verified' || adminStatus === 'approved') {
    return clampMoney(getClaimAdminReviewSnapshot(claim).approvedTotal);
  }
  return getClaimSubmittedTotal(claim);
}

function getResolvedClaimAmount(
  claim: any,
  adminReview: ReturnType<typeof getClaimAdminReviewSnapshot> & { usedLegacyRecovery?: boolean }
) {
  const adminStatus = String(adminReview.status || '').toLowerCase();
  if (adminStatus === 'verified' || adminStatus === 'approved') {
    return clampMoney(adminReview.approvedTotal);
  }

  return getClaimTotal(claim);
}

function getExpenseOriginalTotal(expense: any) {
  return parseMoney(expense?.amount_with_bill) + parseMoney(expense?.amount_without_bill);
}

function getExpenseReviewTotals(expenses: any[] = []) {
  return expenses.reduce((acc, expense) => {
    const { approvedAmount, deductionAmount } = getExpenseReviewState(expense);
    acc.approvedTotal += approvedAmount;
    acc.deductionTotal += deductionAmount;
    return acc;
  }, { approvedTotal: 0, deductionTotal: 0 });
}

async function persistExpenseReviewUpdates(expenses: any[]) {
  await Promise.all(expenses.map(async (expense) => {
    const { error } = await supabase.from('expense_items').update({
      approved_amount: expense.approved_amount,
      deduction_amount: expense.deduction_amount,
      approval_remarks: expense.approval_remarks,
    } as any).eq('id', expense.id);

    if (error) throw error;
  }));
}

function mapExpenseReviewItems(expenses: any[], reviewItems: ClaimExpenseReviewInput[]) {
  let totalApproved = 0;
  let totalDeducted = 0;

  const updatedExpenses = expenses.map((expense, index) => {
    const input = reviewItems.find((item) => item.expenseId && item.expenseId === expense.id) || reviewItems[index] || {};
    const originalTotal = getExpenseOriginalTotal(expense);
    const approvedAmount = clampMoney(Math.min(parseMoney(input.approvedAmount ?? originalTotal), originalTotal));
    const deductionAmount = clampMoney(Math.max(0, originalTotal - approvedAmount));

    totalApproved += approvedAmount;
    totalDeducted += deductionAmount;

    return {
      ...expense,
      approved_amount: approvedAmount,
      deduction_amount: deductionAmount,
      approval_remarks: String(input.remarks || '').trim() || null,
    };
  });

  return {
    updatedExpenses,
    totalApproved: clampMoney(totalApproved),
    totalDeducted: clampMoney(totalDeducted),
  };
}

function normalizeCategoryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

// ============= ADMIN CHECK =============
export async function checkAdminExists(): Promise<boolean> {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .or('role.eq.Admin,role.eq.Super Admin');
  
  if (error) return true; // Assume admin exists on error for security
  return (count || 0) > 0;
}

export async function createFirstAdmin(data: { name: string; email: string; password: string }): Promise<{ ok: boolean; message?: string }> {
  // First verify no admin exists
  const adminExists = await checkAdminExists();
  if (adminExists) {
    return { ok: false, message: 'An admin account already exists. Please contact your administrator.' };
  }

  const email = data.email.trim().toLowerCase();
  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.ok) {
    return { ok: false, message: passwordValidation.message };
  }
  
  // Check if email already exists
  const { data: existing } = await supabase.from('users').select('email').eq('email', email).single();
  if (existing) {
    return { ok: false, message: 'This email is already registered.' };
  }

  // Create the admin user
  const { error } = await supabase.from('users').insert({
    email,
    password_hash: hashPassword(data.password),
    name: data.name.trim(),
    role: 'Admin',
    advance_amount: 0,
    active: true,
  });

  if (error) {
    return { ok: false, message: 'Failed to create admin account. Please try again.' };
  }

  await logAudit('first_admin_created', email, 'user', email, 'First admin account created');
  return { ok: true, message: 'Admin account created successfully.' };
}

// ============= EMAIL NOTIFICATIONS =============
async function sendEmailNotification(type: string, recipientEmail: string, data?: any) {
  const describeEmailError = (error: unknown) => {
    const details: string[] = [];
    const err = error as Record<string, unknown> | null;

    if (err && typeof err.name === 'string') details.push(`Name: ${err.name}`);
    if (err && typeof err.message === 'string') details.push(`Message: ${err.message}`);
    if (err && typeof err.status === 'number') details.push(`Status: ${err.status}`);

    const context = err?.context as Record<string, unknown> | undefined;
    if (context && typeof context.status === 'number') details.push(`Context Status: ${context.status}`);
    if (context && typeof context.statusText === 'string') details.push(`Context Status Text: ${context.statusText}`);

    return details.join(' | ') || String(error || 'Unknown error');
  };

  try {
    const normalizedRecipientEmail = String(recipientEmail || '').trim().toLowerCase();
    if (!normalizedRecipientEmail) return;
    const settings = await getCompanySettings();
    if (settings?.email_notifications_enabled === false) return;
    const appUrl = getAppUrl(settings?.website);
    const payload = {
      type,
      recipientEmail: normalizedRecipientEmail,
      data: {
        ...data,
        companyName: settings?.company_name || 'Irrigation Products International Pvt Ltd',
        companySubtitle: settings?.company_subtitle || 'Claims Management System',
        supportEmail: settings?.support_email || 'projects@ipi-india.com',
        logoUrl: settings?.logo_url || '/ipi-logo.jpg',
        appUrl,
        loginUrl: appUrl,
        currency: settings?.currency_symbol || data?.currency || '₹',
      },
    };

    let lastError: unknown = null;
    for (const delayMs of EMAIL_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const { error } = await supabase.functions.invoke('send-notification', {
        body: payload,
      });

      if (!error) {
        await logAudit('email_sent', normalizedRecipientEmail, 'email', normalizedRecipientEmail, `Template: ${type}`);
        return;
      }

      lastError = error;
      console.warn('Email notification failed attempt:', {
        type,
        recipientEmail: normalizedRecipientEmail,
        delayMs,
        error: describeEmailError(error),
      });
    }

    await logAudit(
      'email_failed',
      normalizedRecipientEmail,
      'email',
      normalizedRecipientEmail,
      `Template: ${type} | Error: ${describeEmailError(lastError)}`
    );
    return;
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        type,
        recipientEmail: normalizedRecipientEmail,
        data: {
          ...data,
          companyName: settings?.company_name || 'Irrigation Products International Pvt Ltd',
          companySubtitle: settings?.company_subtitle || 'Claims Management System',
          supportEmail: settings?.support_email || 'projects@ipi-india.com',
          logoUrl: settings?.logo_url || '/ipi-logo.jpg',
          appUrl,
          loginUrl: appUrl,
          currency: settings?.currency_symbol || data?.currency || '₹',
        },
      },
    });
    if (error) console.warn('Email notification failed:', error);
  } catch (e) {
    console.warn('Email notification error:', e);
    try {
      const normalizedRecipientEmail = String(recipientEmail || '').trim().toLowerCase();
      if (normalizedRecipientEmail) {
        await logAudit(
          'email_failed',
          normalizedRecipientEmail,
          'email',
          normalizedRecipientEmail,
          `Template: ${type} | Error: ${describeEmailError(e)}`
        );
      }
    } catch (auditError) {
      console.warn('Email failure audit log failed:', auditError);
    }
  }
}

function queueEmailNotifications(tasks: Array<Promise<unknown>>) {
  if (tasks.length === 0) return;
  void Promise.allSettled(tasks);
}

function normalizeAppUrl(url?: string | null) {
  return (url || '').trim().replace(/\/+$/, '');
}

function buildClaimReviewLink(appUrl: string, claimId: string, role: 'manager' | 'admin', email?: string) {
  const baseUrl = normalizeAppUrl(appUrl);
  if (!baseUrl) return '';
  const params = new URLSearchParams({
    claimId,
    role,
  });
  if (email) params.set('email', email.trim().toLowerCase());
  return `${baseUrl}/claim-action?${params.toString()}`;
}

function buildClaimActionLink(appUrl: string, claimId: string, action: 'approve' | 'reject', role: 'manager' | 'admin', email?: string) {
  const baseUrl = normalizeAppUrl(appUrl);
  if (!baseUrl) return '';
  const params = new URLSearchParams({
    claimId,
    role,
    action,
  });
  if (email) params.set('email', email.trim().toLowerCase());
  return `${baseUrl}/claim-action?${params.toString()}`;
}

function getAppUrl(url?: string | null) {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return normalizeAppUrl(url || browserOrigin) || DEFAULT_APP_URL;
}

function mapAttachmentEmailData(fileIds?: string[]) {
  return (fileIds || []).map((fileId) => {
    const parts = fileId.split('/');
    const name = parts[parts.length - 1] || fileId;
    const { data } = supabase.storage.from('claim-attachments').getPublicUrl(fileId);
    return {
      name,
      url: data?.publicUrl || '',
    };
  });
}

function isSchemaCacheColumnError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('schema cache') || message.includes('could not find the') || message.includes('column');
}

async function getAdminApproverEmails(excludeEmails: string[] = []) {
  const { data } = await supabase
    .from('users')
    .select('email')
    .in('role', ['Admin', 'Super Admin'])
    .eq('active', true);

  const excluded = new Set(
    excludeEmails
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  return [...new Set((data || [])
    .map((user: any) => String(user.email || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => !excluded.has(email)))];
}

async function getSuperAdminApproverEmails() {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'Super Admin')
    .eq('active', true);

  return [...new Set((data || [])
    .map((user: any) => String(user.email || '').trim().toLowerCase())
    .filter(Boolean))];
}

async function getFinalApproverEmails(managerEmail?: string | null, excludeEmails: string[] = []) {
  const normalizedManagerEmail = String(managerEmail || '').trim().toLowerCase();
  const superAdminEmails = await getSuperAdminApproverEmails();
  const excluded = new Set(
    excludeEmails
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  return [...new Set(
    [normalizedManagerEmail, ...superAdminEmails]
      .filter(Boolean)
      .filter((email) => !excluded.has(email))
  )];
}

async function hasExistingApprovedSettlement(claimId: string) {
  const { data: existingSettlement } = await supabase
    .from('transactions')
    .select('id')
    .eq('reference_id', claimId)
    .eq('type', 'claim_approved')
    .maybeSingle();

  return Boolean(existingSettlement);
}

async function createApprovedSettlementTransaction(claimId: string, displayClaimNo: string, userEmail: string, approverEmail: string, approvedAmount: number) {
  const currentBalance = await getCurrentBalance(userEmail);
  const { error } = await supabase.from('transactions').insert({
    user_email: userEmail,
    admin_email: approverEmail,
    type: 'claim_approved',
    reference_id: claimId,
    credit: approvedAmount,
    debit: 0,
    balance_after: currentBalance + approvedAmount,
    description: `Claim ${displayClaimNo} approved - settlement`,
  });

  if (error) throw error;
}

async function getActiveUserByEmail(email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Approver email is required.');

  const { data: user } = await supabase
    .from('users')
    .select('email, role, active')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!user || (user as any).active === false) {
    throw new Error('Approver account is not active.');
  }

  return {
    email: String((user as any).email || '').trim().toLowerCase(),
    role: String((user as any).role || '').trim(),
  };
}

function isAdminRole(role: string) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'super admin';
}

function isManagerFinalRole(role: string) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'manager' || normalizedRole === 'super admin';
}

async function assertAdminReviewPermission(claimId: string, approverEmail: string) {
  const approver = await getActiveUserByEmail(approverEmail);

  if (!isAdminRole(approver.role)) {
    throw new Error('Only admin or super admin can review this claim.');
  }

  const { data: claim } = await supabase
    .from('claims')
    .select('claim_id, status')
    .eq('claim_id', claimId)
    .single();

  if (!claim) throw new Error('Claim not found.');

  if (String((claim as any).status || '').trim().toLowerCase() !== 'pending admin approval') {
    throw new Error('This claim is not pending admin review.');
  }

  return approver;
}

async function assertManagerFinalPermission(claimId: string, approverEmail: string) {
  const approver = await getActiveUserByEmail(approverEmail);

  if (!isManagerFinalRole(approver.role)) {
    throw new Error('Only the assigned manager or a super admin can finalize this claim.');
  }

  const { data: claim } = await supabase
    .from('claims')
    .select('claim_id, status, manager_email')
    .eq('claim_id', claimId)
    .single();

  if (!claim) throw new Error('Claim not found.');

  if (String((claim as any).status || '').trim().toLowerCase() !== 'pending manager approval') {
    throw new Error('This claim is not pending final approval.');
  }

  const managerEmail = String((claim as any).manager_email || '').trim().toLowerCase();
  const approverRole = String(approver.role || '').trim().toLowerCase();

  if (approverRole === 'manager' && managerEmail !== approver.email) {
    throw new Error('This claim is assigned to a different manager.');
  }

  return approver;
}


// ============= DROPDOWN DATA =============
export async function getDropdownOptions() {
  const { data, error } = await supabase.from('app_lists').select('*').eq('active', true);
  if (error || !data) {
    return { projects: [], categories: [], projectCodes: [] as ProjectCodeOption[], byProject: {} as Record<string, ProjectCodeOption[]> };
  }

  const categories = [...new Set(
    (data as any[]).filter(r => String(r.type || '').toLowerCase() === 'category')
      .map(r => String(r.value || '').trim()).filter(Boolean)
  )].sort();

  const projects = (data as any[])
    .filter(r => String(r.type || '').toLowerCase() === 'project')
    .map(r => ({ name: String(r.value || '').trim(), code: String(r.project_code || '').trim() }))
    .filter(p => p.name);

  const projectCodes = (data as any[])
    .filter(r => String(r.type || '').toLowerCase() === 'projectcode')
    .map((r) => ({
      code: String(r.project_code || '').trim(),
      label: String(r.value || '').trim(),
      project: String(r.project || '').trim(),
      allowsAllCategories: Boolean(r.allows_all_categories ?? true),
      expenseCategories: normalizeCategoryList(r.expense_categories),
    }))
    .filter((c) => c.code);

  const byProject: Record<string, ProjectCodeOption[]> = {};
  projectCodes.forEach(pc => {
    const key = pc.project || '';
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(pc);
  });

  Object.values(byProject).forEach((items) => {
    items.sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
  });

  return { projects, categories, projectCodes, byProject };
}

// ============= COMPANY SETTINGS =============
export async function getCompanySettings() {
  const { data } = await supabase.from('company_settings').select('*').limit(1).single();
  return data as any;
}

export async function updateCompanySettings(settings: any) {
  const { data: existing } = await supabase.from('company_settings').select('id').limit(1).single();
  if (existing) {
    const { error } = await supabase.from('company_settings').update({ ...settings, updated_at: new Date().toISOString() } as any).eq('id', (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('company_settings').insert({ ...settings } as any);
    if (error) throw error;
  }
}

// ============= DASHBOARD =============
export async function getDashboardSummary(userEmail: string, userRole: string) {
  const role = userRole.toLowerCase();

  const { data: claims } = await supabase.from('claims').select('*, expense_items(*)');
  const { data: txs } = await supabase.from('transactions').select('reference_id, user_email').eq('type', 'claim_submitted');

  const claimOwnerMap: Record<string, string> = {};
  txs?.forEach((t: any) => { if (t.reference_id) claimOwnerMap[t.reference_id] = String(t.user_email || '').toLowerCase(); });

  const processedClaims = (claims || []).map((c: any) => ({
    id: c.claim_id,
    amount: getClaimTotal(c),
    status: String(c.status || '').toLowerCase(),
    managerStatus: String(c.manager_approval_status || '').toLowerCase(),
    managerEmail: String(c.manager_email || '').toLowerCase(),
    userEmail: c.user_email?.toLowerCase() || claimOwnerMap[c.claim_id] || '',
  }));

  if (['admin', 'super admin', 'manager'].includes(role)) {
    let total = 0, totalAmount = 0, pending = 0, pendingManager = 0, pendingAdmin = 0;
    const myEmail = userEmail.toLowerCase();

    for (const c of processedClaims) {
      let include = role === 'admin' || role === 'super admin';
      if (role === 'manager') {
        include = c.managerEmail === myEmail || c.userEmail === myEmail;
      }
      if (!include) continue;

      total++;
      if (c.status.includes('approved') && !c.status.includes('pending') && !c.status.includes('reject')) {
        totalAmount += c.amount;
      }
      if (c.status.includes('pending')) pending++;
      if (c.status === 'pending manager approval') {
        if (role === 'manager') { if (c.managerEmail === myEmail) pendingManager++; }
        else pendingManager++;
      }
      if (c.status === 'pending admin approval') pendingAdmin++;
    }

    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

    return { role: userRole, totalClaims: total, totalUsers: userCount || 0, totalAmount, pendingClaims: pending, pendingManagerClaims: pendingManager, pendingAdminClaims: pendingAdmin };
  } else {
    let myClaims = 0, myAmount = 0;
    const myEmail = userEmail.toLowerCase();
    for (const c of processedClaims) {
      if (c.userEmail === myEmail) {
        myClaims++;
        if (c.status.includes('approved') && !c.status.includes('pending') && !c.status.includes('reject')) {
          myAmount += c.amount;
        }
      }
    }
    const myBalance = await getCurrentBalance(myEmail);
    return { role: 'User', myClaims, myAmount, myBalance };
  }
}

// ============= BALANCE =============
export async function getCurrentBalance(email: string): Promise<number> {
  const { data: txs } = await supabase
    .from('transactions')
    .select('type, reference_id, credit, debit, balance_after')
    .eq('user_email', email)
    .order('created_at', { ascending: true });

  if (txs && txs.length > 0) {
    const seenClaimTx = new Set<string>();
    let balance = 0;

    for (const tx of txs as any[]) {
      const type = String(tx.type || '');
      const referenceId = String(tx.reference_id || '');
      const transactionKey = referenceId ? `${type}:${referenceId}` : '';

      if (transactionKey && type.startsWith('claim_')) {
        if (seenClaimTx.has(transactionKey)) continue;
        seenClaimTx.add(transactionKey);
      }

      balance += parseMoney(tx.credit) - parseMoney(tx.debit);
    }

    return clampMoney(balance);
  }

  const { data: user } = await supabase.from('users').select('advance_amount').eq('email', email).maybeSingle();
  if (user) return parseFloat((user as any).advance_amount) || 0;
  return 0;
}

// ============= CLAIMS =============
export async function submitClaim(claim: {
  site: string;
  expenses: Array<{ category: string; projectCode: string; claimDate: string; description: string; amountWithBill: number; amountWithoutBill: number }>;
  fileIds?: string[];
}, userEmail: string, userName: string) {
  // Phase 5: Check rate limit for claim submissions
  const limitCheck = await rateLimiters.claimSubmission.checkLimit(userEmail);
  if (!limitCheck.allowed) {
    throw new Error(`Rate limit exceeded. You can submit up to 10 claims per hour. Try again in ${Math.ceil(limitCheck.retryAfterSeconds)} seconds.`);
  }
  
  const claimID = 'C-' + Date.now();
  
  // Generate claim_number in format CLM-0001, CLM-0002, etc.
  const { data: existingClaims } = await supabase.from('claims').select('claim_number', { count: 'exact' }).order('created_at', { ascending: false }).limit(1);
  let nextSequence = 1;
  if (existingClaims && existingClaims.length > 0) {
    const lastClaimNumber = (existingClaims[0] as any)?.claim_number;
    if (lastClaimNumber) {
      const match = lastClaimNumber.match(/\d+/);
      if (match) {
        nextSequence = parseInt(match[0]) + 1;
      }
    }
  }
  const claimNumber = `CLM-${String(nextSequence).padStart(4, '0')}`;
  
  let totalWithBill = 0, totalWithoutBill = 0;

  const expenseItems = claim.expenses.map(e => {
    totalWithBill += (e.amountWithBill || 0);
    totalWithoutBill += (e.amountWithoutBill || 0);
    return {
      claim_id: claimID,
      category: e.category,
      project_code: e.projectCode || '',
      expense_date: e.claimDate || null,
      description: e.description,
      amount_with_bill: e.amountWithBill || 0,
      amount_without_bill: e.amountWithoutBill || 0,
    };
  });

  // Get manager
  const { data: userRecord } = await supabase.from('users').select('manager_email').eq('email', userEmail).single();
  const managerEmail = String((userRecord as any)?.manager_email || '').trim().toLowerCase() || null;

  const grandTotal = totalWithBill + totalWithoutBill;

  const companySettings = await getCompanySettings();
  const status = 'Pending Admin Approval';
  const managerApprovalStatus = 'Pending';

  // Get current balance
  const currentBalance = await getCurrentBalance(userEmail);
  const newBalance = currentBalance - grandTotal;

  const { error: cErr } = await supabase.from('claims').insert({
    claim_id: claimID,
    claim_number: claimNumber,
    user_email: userEmail,
    submitted_by: userName,
    site_name: claim.site,
    status,
    manager_email: managerEmail,
    manager_approval_status: managerApprovalStatus,
    total_with_bill: totalWithBill,
    total_without_bill: totalWithoutBill,
    drive_file_ids: claim.fileIds || [],
  });
  if (cErr) throw new Error('Claim insert failed: ' + cErr.message);

  const { error: eErr } = await supabase.from('expense_items').insert(expenseItems);
  if (eErr) throw new Error('Expense items insert failed: ' + eErr.message);

  const { error: tErr } = await supabase.from('transactions').insert({
    user_email: userEmail,
    admin_email: userEmail,
    type: 'claim_submitted',
    reference_id: claimID,
    credit: 0,
    debit: grandTotal,
    balance_after: newBalance,
    description: `Claim submission: ${claimNumber}`,
  });
  if (tErr) throw new Error('Transaction insert failed: ' + tErr.message);

  const attachmentsForEmail = mapAttachmentEmailData(claim.fileIds);
  const primaryProjectCode = claim.expenses.find((expense) => expense.projectCode)?.projectCode || '';
  const expenseItemsForEmail = claim.expenses.map((expense) => ({
    category: expense.category,
    projectCode: expense.projectCode,
    claimDate: expense.claimDate,
    description: expense.description,
    amountWithBill: expense.amountWithBill || 0,
    amountWithoutBill: expense.amountWithoutBill || 0,
    amount: (expense.amountWithBill || 0) + (expense.amountWithoutBill || 0),
    totalAmount: (expense.amountWithBill || 0) + (expense.amountWithoutBill || 0),
  }));
  const appUrl = getAppUrl(companySettings?.website);
  const adminReviewLink = `${appUrl}/admin-approval`;
  const requireManager = companySettings?.require_manager_approval ?? true;

  const adminApprovers = await getAdminApproverEmails(managerEmail ? [managerEmail] : []);
  await logAudit('claim_submitted', userEmail, 'claim', claimID, `Amount: ${RUPEE_SYMBOL}${grandTotal}`);
  queueEmailNotifications([
    ...adminApprovers.map((email) =>
      createNotification(email, 'New Claim for Admin Review', `${userName} submitted claim ${claimNumber} (${RUPEE_SYMBOL}${grandTotal.toLocaleString('en-IN')})`, 'info', claimID)
    ),
    createNotification(userEmail, 'Claim Submitted', `Your claim ${claimNumber} has been submitted successfully and is waiting for admin review.`, 'success', claimID),
  ]);

  queueEmailNotifications([
    sendEmailNotification('claim_submitted_user', userEmail, {
    claim_id: claimID,
    claim_number: claimNumber,
    generated_on: new Date().toISOString(),
    submitted_by: userName,
    submission_date: new Date().toISOString(),
    project_site: claim.site,
    primary_project_code: primaryProjectCode,
    status: 'Pending Admin Approval',
    total_amount: grandTotal,
    total_with_bill: totalWithBill,
    total_without_bill: totalWithoutBill,
    employee_name: userName,
    currency: RUPEE_SYMBOL,
    items: expenseItemsForEmail,
    attachments: attachmentsForEmail,
    }),

    ...adminApprovers.map((email) =>
      sendEmailNotification('claim_submitted_admin', email, {
      claim_id: claimID,
      claim_number: claimNumber,
      employee_name: userName,
      employee_email: userEmail,
      project_site: claim.site,
      primary_project_code: primaryProjectCode,
      submission_date: new Date().toISOString(),
      admin_status: 'Pending Review',
      total_amount: grandTotal,
      total_with_bill: totalWithBill,
      total_without_bill: totalWithoutBill,
      currency: RUPEE_SYMBOL,
      items: expenseItemsForEmail,
      attachments: attachmentsForEmail,
      review_link: adminReviewLink,
      })
    ),
  ]);

  return { ok: true, id: claimNumber, message: `Claim ${claimNumber} submitted. Status: Pending Admin Approval` };

  // Notifications & audit
  await logAudit('claim_submitted', userEmail, 'claim', claimID, `Amount: ₹${grandTotal}`);
  if (status === 'Approved') {
    // Auto-approved: create credit transaction
    const bal = await getCurrentBalance(userEmail);
    await supabase.from('transactions').insert({
      user_email: userEmail,
      admin_email: 'system',
      type: 'claim_approved',
      reference_id: claimID,
      credit: grandTotal,
      debit: 0,
      balance_after: bal + grandTotal,
      description: `Claim ${claimNumber} auto-approved (below threshold)`,
    });
    await createNotification(userEmail, 'Claim Auto-Approved', `Your claim ${claimNumber} (${RUPEE_SYMBOL}${grandTotal.toLocaleString('en-IN')}) was auto-approved.`, 'success', claimID);
  } else {
    if (status === 'Pending Manager Approval' && managerEmail) {
      await createNotification(managerEmail, 'New Claim for Approval', `${userName} submitted claim ${claimNumber} (${RUPEE_SYMBOL}${grandTotal.toLocaleString('en-IN')})`, 'info', claimID);
    }
    if (status === 'Pending Admin Approval') {
      const adminApprovers = await getAdminApproverEmails();
      await Promise.all(adminApprovers.map((email) =>
        createNotification(email, 'New Claim for Approval', `${userName} submitted claim ${claimNumber} (${RUPEE_SYMBOL}${grandTotal.toLocaleString('en-IN')})`, 'info', claimID)
      ));
    }
    await createNotification(userEmail, 'Claim Submitted', `Your claim ${claimNumber} has been submitted successfully.`, 'success', claimID);
  }

  await sendEmailNotification('claim_submitted_user', userEmail, { 
    claim_id: claimID,
    claim_number: claimNumber, 
    generated_on: new Date().toISOString(),
    submitted_by: userName,
    submission_date: new Date().toISOString(),
    project_site: claim.site,
    primary_project_code: primaryProjectCode,
    status,
    total_amount: grandTotal, 
    total_with_bill: totalWithBill,
    total_without_bill: totalWithoutBill,
    employee_name: userName,
    currency: '₹',
    items: expenseItemsForEmail,
    attachments: attachmentsForEmail,
  });
  if (status === 'Pending Manager Approval' && managerEmail) {
    await sendEmailNotification('claim_submitted_manager', managerEmail, { 
      claim_id: claimID,
      claim_number: claimNumber,
      employee_name: userName,
      employee_email: userEmail,
      project_site: claim.site,
      primary_project_code: primaryProjectCode,
      submission_date: new Date().toISOString(),
      manager_status: 'Pending',
      admin_status: 'Pending',
      total_amount: grandTotal,
      total_with_bill: totalWithBill,
      total_without_bill: totalWithoutBill,
      currency: '₹',
      items: expenseItemsForEmail,
      attachments: attachmentsForEmail,
      review_link: buildClaimReviewLink(appUrl, claimID, 'manager')
    });
    const superAdminApprovers = await getSuperAdminApproverEmails();
    await Promise.all(superAdminApprovers.map((email) =>
      sendEmailNotification('claim_submitted_manager', email, {
        claim_id: claimID,
        claim_number: claimNumber,
        employee_name: userName,
        employee_email: userEmail,
        project_site: claim.site,
        primary_project_code: primaryProjectCode,
        submission_date: new Date().toISOString(),
        manager_status: 'Pending',
        admin_status: 'Pending',
        total_amount: grandTotal,
        total_with_bill: totalWithBill,
        total_without_bill: totalWithoutBill,
        currency: '₹',
        items: expenseItemsForEmail,
        attachments: attachmentsForEmail,
        review_link: buildClaimReviewLink(appUrl, claimID, 'manager'),
      })
    ));
  } else if (status === 'Pending Admin Approval') {
    const adminApprovers = await getAdminApproverEmails();
    await Promise.all(adminApprovers.map((email) =>
      sendEmailNotification('claim_submitted_manager', email, {
        claim_id: claimID,
        claim_number: claimNumber,
        employee_name: userName,
        employee_email: userEmail,
        project_site: claim.site,
        primary_project_code: primaryProjectCode,
        submission_date: new Date().toISOString(),
        manager_status: requireManager ? 'Not Required / Skipped' : 'Not Required',
        admin_status: 'Pending',
        total_amount: grandTotal,
        total_with_bill: totalWithBill,
        total_without_bill: totalWithoutBill,
        currency: '₹',
        items: expenseItemsForEmail,
        attachments: attachmentsForEmail,
        review_link: buildClaimReviewLink(appUrl, claimID, 'admin'),
      })
    ));
  }

  return { ok: true, id: claimNumber, message: `Claim ${claimNumber} submitted. Status: ${status}` };
}

// ============= APPROVALS =============
export async function getPendingManagerClaims(userEmail: string, userRole: string) {
  const { data: claims } = await supabase.from('claims').select('*, expense_items(*)')
    .eq('status', 'Pending Manager Approval')
    .order('created_at', { ascending: false });

  if (!claims) return [];
  const myEmail = userEmail.toLowerCase();
  const role = userRole.toLowerCase();
  const visibleClaims = (claims as any[]).filter(c => {
    if (role === 'admin' || role === 'super admin') return true;
    if (role === 'manager') return String(c.manager_email || '').toLowerCase() === myEmail;
    return false;
  });
  const recoveryMap = await getLegacyAdminReviewRecoveryMap(
    visibleClaims.map((claim) => ({
      claimId: claim.claim_id,
      submittedTotal: getClaimSubmittedTotal(claim),
    }))
  );

  return visibleClaims.map(c => {
    const adminReview = applyLegacyAdminReviewRecovery(
      c,
      getClaimAdminReviewSnapshot(c),
      recoveryMap.get(String(c.claim_id || '').trim()) || null
    );
    return {
    claimId: c.claim_number || c.claim_id,
    claimIdInternal: c.claim_id,
    date: c.created_at,
    submittedBy: c.submitted_by,
    userEmail: c.user_email,
    site: c.site_name,
    totalWithBill: parseFloat(c.total_with_bill || 0),
    totalWithoutBill: parseFloat(c.total_without_bill || 0),
    amount: getResolvedClaimAmount(c, adminReview),
    adminApprovedTotal: adminReview.approvedTotal,
    adminDeductionTotal: adminReview.deductionTotal,
    managerEmail: c.manager_email,
    status: c.status,
    adminApprovalStatus: adminReview.status,
  };
  });
}

export async function getPendingAdminClaims() {
  const { data: claims } = await supabase.from('claims').select('*').order('created_at', { ascending: false });
  if (!claims) return [];

  return (claims as any[]).filter(c => {
    const status = String(c.status || '').toLowerCase();
    return status === 'pending admin approval';
  }).map(c => ({
    claimId: c.claim_number || c.claim_id,
    claimIdInternal: c.claim_id,
    date: c.created_at,
    submittedBy: c.submitted_by,
    userEmail: c.user_email,
    site: c.site_name,
    totalWithBill: parseFloat(c.total_with_bill || 0),
    totalWithoutBill: parseFloat(c.total_without_bill || 0),
    amount: getClaimTotal(c),
    status: c.status,
  }));
}

export async function approveClaimAsManager(claimId: string, approverEmail: string, descriptionOrReview?: string | AdminClaimReviewInput) {
  const approver = await assertManagerFinalPermission(claimId, approverEmail);
  
  // Phase 5: Check rate limit for approvals
  const limitCheck = await rateLimiters.approval.checkLimit(approverEmail);
  if (!limitCheck.allowed) {
    throw new Error(`Rate limit exceeded for approvals. Please try again in ${Math.ceil(limitCheck.retryAfterSeconds)} seconds.`);
  }
  
  const { data: claim } = await supabase.from('claims').select('*, expense_items(*)').eq('claim_id', claimId).single();
  if (!claim) throw new Error('Claim not found');
  const claimData = claim as any;
  const description = typeof descriptionOrReview === 'string' ? descriptionOrReview : undefined;
  const reviewInput = typeof descriptionOrReview === 'object' && descriptionOrReview ? descriptionOrReview : undefined;
  const expenseItems = (claimData.expense_items || []) as any[];
  const reviewedItems = mapExpenseReviewItems(
    expenseItems,
    reviewInput?.items?.length
      ? reviewInput.items
      : expenseItems.map((expense) => ({
          expenseId: expense.id,
          approvedAmount: expense.approved_amount ?? getExpenseOriginalTotal(expense),
          remarks: expense.approval_remarks || '',
        }))
  );
  const approvedAmount = reviewedItems.totalApproved;
  const originalAmount = clampMoney(expenseItems.reduce((sum, expense) => sum + getExpenseOriginalTotal(expense), 0));
  const deductionTotal = clampMoney(Math.max(0, originalAmount - approvedAmount));

  if (await hasExistingApprovedSettlement(claimId)) {
    const alreadyApprovedUpdates: any = {
      status: 'Approved',
      manager_approval_status: 'Approved',
      manager_approval_date: new Date().toISOString(),
    };
    await supabase.from('claims').update(alreadyApprovedUpdates).eq('claim_id', claimId);
    await logAudit('claim_manager_approved_duplicate', approver.email, 'claim', claimId, 'Skipped duplicate settlement transaction');
    return;
  }

  const updates: any = {
    status: 'Approved',
    manager_approval_status: 'Approved',
    manager_approval_date: new Date().toISOString(),
    manager_description: reviewInput?.remarks || description || null,
  };
  const legacyUpdates: any = {
    status: 'Approved',
    manager_approval_status: 'Approved',
    manager_approval_date: new Date().toISOString(),
  };
  const { error } = await supabase.from('claims').update(updates).eq('claim_id', claimId);
  if (error) {
    if (!isSchemaCacheColumnError(error)) throw error;
    const { error: legacyError } = await supabase.from('claims').update(legacyUpdates).eq('claim_id', claimId);
    if (legacyError) throw legacyError;
  }

  try {
    await persistExpenseReviewUpdates(reviewedItems.updatedExpenses);
  } catch (expenseError) {
    if (!isSchemaCacheColumnError(expenseError)) throw expenseError;
  }
  const displayClaimNo = getDisplayClaimNo(claimData.claim_number, claimId);
  await createApprovedSettlementTransaction(claimId, displayClaimNo, claimData.user_email, approver.email, approvedAmount);

  await logAudit(
    'claim_manager_approved',
    approver.email,
    'claim',
    claimId,
    reviewInput?.remarks ? `Approved total: ${RUPEE_SYMBOL}${approvedAmount} | ${reviewInput.remarks}` : description || undefined
  );
  
  queueEmailNotifications([
    (async () => {
      try {
    await publishManagerApprovalEvent(claimId, approver.email, {
      claimAmount: originalAmount,
      claimId: claimId,
      employeeEmail: claimData.user_email,
      deductions: deductionTotal,
      expenses: (claimData.expense_items || []).map((e: any) => ({
        category: e.category,
        amount: getExpenseOriginalTotal(e)
      }))
    });
      } catch (eventError) {
        console.error('Failed to publish manager approval event:', eventError);
      }
    })(),
  
    createNotification(claimData.user_email, 'Claim Fully Approved', `Your claim ${displayClaimNo} has been approved by manager. ${RUPEE_SYMBOL}${approvedAmount.toLocaleString('en-IN')} settled.`, 'success', claimId),
    sendEmailNotification('claim_approved', claimData.user_email, {
    claim_no: claimData.claim_number || claimId,
    total: approvedAmount,
    approved_by: approver.email,
    employee_name: claimData.user_name || claimData.submitted_by || 'there',
    project_site: claimData.site_name,
    original_total: originalAmount,
    deduction_total: deductionTotal,
    remarks: reviewInput?.remarks || description || '',
    items: reviewedItems.updatedExpenses.map((expense: any) => ({
      category: expense.category,
      projectCode: expense.project_code,
      claimDate: expense.expense_date,
      description: expense.description,
      amount: getExpenseOriginalTotal(expense),
      totalAmount: getExpenseOriginalTotal(expense),
      approvedAmount: parseMoney(expense.approved_amount),
      deductionAmount: parseMoney(expense.deduction_amount),
      remarks: expense.approval_remarks || '',
    })),
    currency: RUPEE_SYMBOL,
    status: 'Fully Approved',
    }),
  ]);
  return;
  /*
  
  const updates: any = {
    status: 'Pending Admin Approval',
    manager_approval_status: 'Approved',
    manager_approval_date: new Date().toISOString(),
  };
  const { error } = await supabase.from('claims').update(updates).eq('claim_id', claimId);
  if (error) throw error;

  await logAudit('claim_manager_approved', approverEmail, 'claim', claimId, description || undefined);
  if (claim) {
    const adminApprovers = await getAdminApproverEmails();
    const appUrl = getAppUrl();
    await createNotification(claimData.user_email, 'Claim Approved by Manager', `Your claim ${claimData.claim_number || claimId} has been approved by the manager and forwarded to admin.`, 'success', claimId);
    await Promise.all(adminApprovers.map((email) =>
      createNotification(email, 'Claim Awaiting Admin Approval', `${claimData.submitted_by} claim ${claimData.claim_number || claimId} is pending admin approval.`, 'info', claimId)
    ));
    await sendEmailNotification('claim_approved', claimData.user_email, {
      claim_no: claimData.claim_number || claimId,
      total: claimData.grand_total || claimData.amount || 0,
      approved_by: approverEmail,
      employee_name: claimData.user_name || claimData.submitted_by || 'there',
      currency: '₹',
      status: 'Pending Admin Approval'
    });
    queueEmailNotifications(adminApprovers.map((email) =>
      sendEmailNotification('claim_submitted_manager', email, {
        claim_id: claimId,
        claim_number: claimData.claim_number || claimId,
        employee_name: claimData.submitted_by,
        employee_email: claimData.user_email,
        project_site: claimData.site_name,
        primary_project_code: '',
        submission_date: claimData.created_at,
        manager_status: 'Approved',
        admin_status: 'Pending',
        total_amount: parseFloat(claimData.grand_total || 0),
        currency: '₹',
        items: [],
        attachments: mapAttachmentEmailData(claimData.drive_file_ids || []),
        approve_link: buildClaimActionLink(appUrl, claimId, 'approve', 'admin', email),
        reject_link: buildClaimActionLink(appUrl, claimId, 'reject', 'admin', email),
      })
    ));
  }
  */
}

export async function approveClaimAsAdmin(claimId: string, approverEmail: string, descriptionOrReview?: string | AdminClaimReviewInput) {
  const approver = await assertAdminReviewPermission(claimId, approverEmail);
  
  // Phase 5: Check rate limit for approvals
  const limitCheck = await rateLimiters.approval.checkLimit(approverEmail);
  if (!limitCheck.allowed) {
    throw new Error(`Rate limit exceeded for approvals. Please try again in ${Math.ceil(limitCheck.retryAfterSeconds)} seconds.`);
  }
  
  const { data: claim } = await supabase.from('claims').select('*').eq('claim_id', claimId).single();
  if (!claim) throw new Error('Claim not found');

  const c = claim as any;
  const description = typeof descriptionOrReview === 'string' ? descriptionOrReview : undefined;
  const reviewInput = typeof descriptionOrReview === 'object' && descriptionOrReview ? descriptionOrReview : undefined;
  const adminRemarks = typeof descriptionOrReview === 'string' ? descriptionOrReview : reviewInput?.remarks;
  const { data: detailedClaim } = await supabase.from('claims').select('*, expense_items(*)').eq('claim_id', claimId).single();
  const claimData = (detailedClaim || c) as any;
  const expenseItems = (claimData.expense_items || []) as any[];
  const companySettings = await getCompanySettings();
  const appUrl = getAppUrl(companySettings?.website);
  const reviewedItems = mapExpenseReviewItems(
    expenseItems,
    reviewInput?.items?.length
      ? reviewInput.items
      : expenseItems.map((expense) => ({ expenseId: expense.id, approvedAmount: getExpenseOriginalTotal(expense), remarks: '' }))
  );
  const managerEmail = String(claimData.manager_email || '').trim().toLowerCase();
  const displayClaimNo = getDisplayClaimNo(claimData.claim_number, claimId);
  const excludeFinalApprovers = String(approver.role || '').trim().toLowerCase() === 'super admin'
    ? []
    : [approver.email];
  const finalApproverEmails = await getFinalApproverEmails(managerEmail, excludeFinalApprovers);
  const requireManagerFinalApproval = companySettings?.require_manager_approval ?? true;
  const shouldFinalizeDirectly = !requireManagerFinalApproval || finalApproverEmails.length === 0;

  const updates: any = {
    status: shouldFinalizeDirectly ? 'Approved' : 'Pending Manager Approval',
    admin_approval_status: shouldFinalizeDirectly ? 'Approved' : 'Verified',
    admin_email: approver.email,
    admin_approval_date: new Date().toISOString(),
    admin_description: buildReviewDescription(adminRemarks, {
      approvedTotal: reviewedItems.totalApproved,
      deductionTotal: reviewedItems.totalDeducted,
      items: reviewedItems.updatedExpenses.map((expense) => ({
        expenseId: String(expense.id || ''),
        approvedAmount: clampMoney(parseMoney(expense.approved_amount)),
        deductionAmount: clampMoney(parseMoney(expense.deduction_amount)),
        remarks: String(expense.approval_remarks || '').trim(),
      })).filter((item) => item.expenseId),
    }),
    admin_approved_total: reviewedItems.totalApproved,
    admin_deduction_total: reviewedItems.totalDeducted,
    manager_approval_status: shouldFinalizeDirectly ? (managerEmail ? 'Skipped' : 'Not Required') : 'Pending',
    manager_approval_date: shouldFinalizeDirectly ? new Date().toISOString() : null,
  };
  const legacyUpdates: any = {
    status: shouldFinalizeDirectly ? 'Approved' : 'Pending Manager Approval',
    admin_email: approver.email,
    admin_approval_date: new Date().toISOString(),
    manager_approval_status: shouldFinalizeDirectly ? (managerEmail ? 'Skipped' : 'Not Required') : 'Pending',
    manager_approval_date: shouldFinalizeDirectly ? new Date().toISOString() : null,
  };
  const minimalLegacyUpdates: any = {
    status: shouldFinalizeDirectly ? 'Approved' : 'Pending Manager Approval',
    admin_email: approver.email,
    admin_approval_date: new Date().toISOString(),
  };
  const { error } = await supabase.from('claims').update(updates).eq('claim_id', claimId);
  let usedLegacyFallback = false;
  if (error) {
    if (!isSchemaCacheColumnError(error)) throw error;
    usedLegacyFallback = true;
    const { error: legacyError } = await supabase.from('claims').update(legacyUpdates).eq('claim_id', claimId);
    if (legacyError) {
      if (!isSchemaCacheColumnError(legacyError)) throw legacyError;
      const { error: minimalLegacyError } = await supabase.from('claims').update(minimalLegacyUpdates).eq('claim_id', claimId);
      if (minimalLegacyError) throw minimalLegacyError;
    }
  }

  if (reviewedItems.updatedExpenses.length > 0) {
    try {
      await persistExpenseReviewUpdates(reviewedItems.updatedExpenses);
    } catch (expenseError) {
      if (!usedLegacyFallback || !isSchemaCacheColumnError(expenseError)) throw expenseError;
    }
  }

  await logAudit('claim_admin_verified', approverEmail, 'claim', claimId, buildAuditReviewDetails(adminRemarks, {
    approvedTotal: reviewedItems.totalApproved,
    deductionTotal: reviewedItems.totalDeducted,
    items: reviewedItems.updatedExpenses.map((expense) => ({
      expenseId: String(expense.id || ''),
      approvedAmount: clampMoney(parseMoney(expense.approved_amount)),
      deductionAmount: clampMoney(parseMoney(expense.deduction_amount)),
      remarks: String(expense.approval_remarks || '').trim(),
    })).filter((item) => item.expenseId),
  }));

  const originalAmount = clampMoney(expenseItems.reduce((sum, expense) => sum + getExpenseOriginalTotal(expense), 0));
  if (shouldFinalizeDirectly) {
    if (!(await hasExistingApprovedSettlement(claimId))) {
      await createApprovedSettlementTransaction(claimId, displayClaimNo, claimData.user_email, approver.email, reviewedItems.totalApproved);
    }
    
    queueEmailNotifications([
      (async () => {
        try {
      await publishAdminApprovalEvent(claimId, approver.email, {
        claimAmount: originalAmount,
        claimId: claimId,
        employeeEmail: claimData.user_email,
        approvedAmount: reviewedItems.totalApproved,
        deductions: reviewedItems.totalDeducted,
        transactionId: claimId // In real scenario, this would be the transaction ID
      });
        } catch (eventError) {
          console.error('Failed to publish admin approval event:', eventError);
        }
      })(),

      createNotification(claimData.user_email, 'Claim Fully Approved', `Your claim ${displayClaimNo} has been approved. ${RUPEE_SYMBOL}${reviewedItems.totalApproved.toLocaleString('en-IN')} settled.`, 'success', claimId),
      sendEmailNotification('claim_approved', claimData.user_email, {
      claim_no: claimData.claim_number || claimId,
      total: reviewedItems.totalApproved,
      approved_by: approver.email,
      employee_name: claimData.user_name || claimData.submitted_by || 'there',
      project_site: claimData.site_name,
      original_total: originalAmount,
      deduction_total: reviewedItems.totalDeducted,
      remarks: adminRemarks || '',
      items: reviewedItems.updatedExpenses.map((expense: any) => ({
        category: expense.category,
        projectCode: expense.project_code,
        claimDate: expense.expense_date,
        description: expense.description,
        amount: getExpenseOriginalTotal(expense),
        totalAmount: getExpenseOriginalTotal(expense),
        approvedAmount: parseMoney(expense.approved_amount),
        deductionAmount: parseMoney(expense.deduction_amount),
        remarks: expense.approval_remarks || '',
      })),
      currency: RUPEE_SYMBOL,
      status: 'Fully Approved',
      }),
    ]);
    return;
  }

  queueEmailNotifications([
    createNotification(claimData.user_email, 'Claim Verified by Admin', `Your claim ${displayClaimNo} has been verified and sent for final approval.`, 'success', claimId),
    ...finalApproverEmails.map((email) =>
      createNotification(email, 'Claim Final Approval Required', `${claimData.submitted_by} claim ${displayClaimNo} is ready for final approval.`, 'info', claimId)
    ),
  ]);
  queueEmailNotifications([
    ...finalApproverEmails.map((email) => sendEmailNotification('claim_submitted_manager', email, {
    claim_id: claimId,
    claim_number: claimData.claim_number || claimId,
    employee_name: claimData.submitted_by,
    employee_email: claimData.user_email,
    project_site: claimData.site_name,
    primary_project_code: '',
    submission_date: claimData.created_at,
    manager_status: 'Pending Final Approval',
    admin_status: 'Verified',
    admin_remarks: adminRemarks || '',
    total_amount: reviewedItems.totalApproved,
    original_amount: originalAmount,
    deduction_total: reviewedItems.totalDeducted,
    currency: RUPEE_SYMBOL,
    items: reviewedItems.updatedExpenses.map((expense: any) => ({
      category: expense.category,
      projectCode: expense.project_code,
      claimDate: expense.expense_date,
      description: expense.description,
      amountWithBill: parseMoney(expense.amount_with_bill),
      amountWithoutBill: parseMoney(expense.amount_without_bill),
      amount: getExpenseOriginalTotal(expense),
      totalAmount: getExpenseOriginalTotal(expense),
      approvedAmount: parseMoney(expense.approved_amount),
      deductionAmount: parseMoney(expense.deduction_amount),
      remarks: expense.approval_remarks || '',
    })),
    attachments: mapAttachmentEmailData(claimData.drive_file_ids || []),
    approve_link: buildClaimActionLink(appUrl, claimId, 'approve', 'manager', email),
    reject_link: buildClaimActionLink(appUrl, claimId, 'reject', 'manager', email),
    review_link: buildClaimReviewLink(appUrl, claimId, 'manager', email),
    })),
  ]);
  return;
  /*

  const amount = parseFloat(c.grand_total || (c.total_with_bill + c.total_without_bill) || 0);

  const updates: any = {
    status: 'Approved',
    admin_email: approverEmail,
    admin_approval_date: new Date().toISOString(),
  };
  const { error } = await supabase.from('claims').update(updates).eq('claim_id', claimId);
  if (error) throw error;

  // Create settlement/credit transaction for the approved claim
  const currentBalance = await getCurrentBalance(c.user_email);
  await supabase.from('transactions').insert({
    user_email: c.user_email,
    admin_email: approverEmail,
    type: 'claim_approved',
    reference_id: claimId,
    credit: amount,
    debit: 0,
    balance_after: currentBalance + amount,
    description: `Claim ${claimId} approved - settlement`,
  });

  await logAudit('claim_admin_approved', approverEmail, 'claim', claimId, description ? `Amount: ₹${amount} | ${description}` : `Amount: ₹${amount}`);
  await createNotification(c.user_email, 'Claim Fully Approved', `Your claim ${claimId} has been approved by admin. ₹${amount.toLocaleString('en-IN')} settled.`, 'success', claimId);
    await sendEmailNotification('claim_approved', c.user_email, { 
    claim_no: c.claim_number || claimId, 
    total: amount, 
    approved_by: approverEmail,
    employee_name: c.user_name || 'there',
    currency: '₹',
    status: 'Fully Approved'
  });
  */
}

export async function rejectClaim(claimId: string, reason: string, rejectorEmail: string, rejectorRole: string) {
  const normalizedRejectorRole = String(rejectorRole || '').trim().toLowerCase();
  const rejector = normalizedRejectorRole === 'manager'
    ? await assertManagerFinalPermission(claimId, rejectorEmail)
    : await assertAdminReviewPermission(claimId, rejectorEmail);
  const updates: any = { status: 'Rejected', rejection_reason: reason };
  if (normalizedRejectorRole === 'manager') {
    updates.manager_approval_status = 'Rejected';
  } else {
    updates.admin_email = rejector.email;
    updates.admin_approval_date = new Date().toISOString();
    updates.admin_approval_status = 'Rejected';
  }

  const { error } = await supabase.from('claims').update(updates).eq('claim_id', claimId);
  if (error) {
    if (!isSchemaCacheColumnError(error)) throw error;
    const legacyUpdates: any = { status: 'Rejected', rejection_reason: reason };
    if (normalizedRejectorRole === 'manager') {
      legacyUpdates.manager_approval_status = 'Rejected';
    } else {
      legacyUpdates.admin_email = rejector.email;
      legacyUpdates.admin_approval_date = new Date().toISOString();
    }
    const { error: legacyError } = await supabase.from('claims').update(legacyUpdates).eq('claim_id', claimId);
    if (legacyError) throw legacyError;
  }

  // Refund transaction
  const { data: claim } = await supabase
    .from('claims')
    .select('user_email, claim_number, grand_total, total_with_bill, total_without_bill, site_name, created_at, submitted_by, user_name, drive_file_ids, admin_description, admin_approved_total, admin_deduction_total, expense_items(*)')
    .eq('claim_id', claimId)
    .single();
  if (claim) {
    const claimData = claim as any;
    const displayClaimNo = getDisplayClaimNo(claimData.claim_number, claimId);
    const originalTotal = parseFloat(claimData.grand_total || ((claimData.total_with_bill || 0) + (claimData.total_without_bill || 0)) || 0);
    const adminReview = getClaimAdminReviewSnapshot(claimData);
    const reviewedTotal = adminReview.hasAdminReview ? clampMoney(adminReview.approvedTotal) : originalTotal;
    const deductionTotal = adminReview.hasAdminReview ? clampMoney(adminReview.deductionTotal) : 0;
    const { data: existingRefund } = await supabase.from('transactions').select('id').eq('reference_id', claimId).eq('type', 'claim_rejected_refund').maybeSingle();
    const currentBalance = await getCurrentBalance(claimData.user_email);
    if (!existingRefund) {
      await supabase.from('transactions').insert({
        user_email: claimData.user_email,
        admin_email: rejector.email,
        type: 'claim_rejected_refund',
        reference_id: claimId,
        credit: originalTotal,
        debit: 0,
        balance_after: currentBalance + originalTotal,
        description: `Claim ${displayClaimNo} rejected - refund`,
      });
    }

    await logAudit('claim_rejected', rejector.email, 'claim', claimId, `Reason: ${reason}`);
    
    queueEmailNotifications([
      (async () => {
        try {
      await publishRejectionEvent(claimId, rejector.email, rejectorRole, reason, {
        employeeEmail: claimData.user_email,
        claimAmount: originalTotal
      });
        } catch (eventError) {
          console.error('Failed to publish rejection event:', eventError);
        }
      })(),
    
      createNotification(claimData.user_email, 'Claim Rejected', `Your claim ${displayClaimNo} was rejected. Reason: ${reason}`, 'error', claimId),
      sendEmailNotification('claim_rejected', claimData.user_email, {
      claim_no: displayClaimNo,
      total: originalTotal,
      original_total: originalTotal,
      reviewed_total: reviewedTotal,
      deduction_total: deductionTotal,
      rejected_by: rejector.email,
      rejected_stage: normalizedRejectorRole === 'manager' ? 'Final Approval' : 'Admin Review',
      employee_name: claimData.user_name || claimData.submitted_by || 'there',
      project_site: claimData.site_name,
      submission_date: claimData.created_at,
      items: (claimData.expense_items || []).map((expense: any) => {
        const review = getExpenseReviewState(expense);
        return {
          category: expense.category,
          projectCode: expense.project_code,
          claimDate: expense.expense_date,
          description: expense.description,
          amount: getExpenseOriginalTotal(expense),
          totalAmount: getExpenseOriginalTotal(expense),
          approvedAmount: review.approvedAmount,
          deductionAmount: review.deductionAmount,
          remarks: expense.approval_remarks || '',
        };
      }),
      attachments: mapAttachmentEmailData(claimData.drive_file_ids || []),
      reason,
      currency: '₹',
      }),
    ]);
  }
}

// ============= CLAIM HISTORY =============
export async function getClaimsHistory(userEmail: string, userRole: string, filters?: { userEmail?: string; startDate?: string; endDate?: string }) {
  const role = userRole.toLowerCase();
  let query = supabase.from('claims').select('*, expense_items(*)');

  if (role === 'admin' || role === 'super admin') {
    if (filters?.userEmail) query = query.eq('user_email', filters.userEmail);
  } else if (role === 'manager') {
    // Get managed users
    const { data: managed } = await supabase.from('users').select('email').eq('manager_email', userEmail);
    const emails = [userEmail, ...(managed || []).map((u: any) => u.email)];
    query = query.in('user_email', emails);
  } else {
    query = query.eq('user_email', userEmail);
  }

  if (filters?.startDate) query = query.gte('created_at', new Date(filters.startDate).toISOString());
  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }

  query = query.order('created_at', { ascending: false });
  const result = await query;
  const claims = (result.data || []) as any[];
  const recoveryMap = await getLegacyAdminReviewRecoveryMap(
    claims.map((claim) => ({
      claimId: claim.claim_id,
      submittedTotal: getClaimSubmittedTotal(claim),
    }))
  );

  return claims.map((c: any) => {
    const reviewTotals = getExpenseReviewTotals(c.expense_items || []);
    const legacyRecovery = recoveryMap.get(String(c.claim_id || '').trim()) || null;
    const adminReview = applyLegacyAdminReviewRecovery(
      c,
      getClaimAdminReviewSnapshot(c),
      legacyRecovery
    );
    const parsedReviewDescription = parseReviewMetadata(c.admin_description);
    const legacySingleExpenseReview = getLegacySingleExpenseReview(c, c.expense_items || [], adminReview);
    return {
    reviewTotals,
    claimId: c.claim_number || c.claim_id,
    claimIdInternal: c.claim_id,
    date: c.created_at,
    submittedBy: c.submitted_by,
    userEmail: c.user_email,
    site: c.site_name,
    amount: getResolvedClaimAmount(c, adminReview),
    totalWithBill: parseFloat(c.total_with_bill || 0),
    totalWithoutBill: parseFloat(c.total_without_bill || 0),
    status: c.status,
    rejectionReason: c.rejection_reason,
    fileIds: c.drive_file_ids || [],
    adminApprovalStatus: adminReview.status,
    adminApprovalDate: c.admin_approval_date,
    adminApprovedTotal: adminReview.approvedTotal,
    adminDeductionTotal: adminReview.deductionTotal,
    adminDescription: parsedReviewDescription.remarks || legacyRecovery?.remarks || '',
    expenses: (c.expense_items || []).map((e: any) => {
      const metadataReview = getMetadataReviewItem(c, e.id);
      const legacyRecoveryItem = getLegacyRecoveryItem(legacyRecovery, String(e.id || ''));
      const review = getExpenseReviewState(e);
      const hasRecoveredLineItemReview = Boolean(metadataReview || legacyRecoveryItem || legacySingleExpenseReview || review.hasPersistedReview);
      const approvedAmount = metadataReview
        ? metadataReview.approvedAmount
        : legacyRecoveryItem
          ? legacyRecoveryItem.approvedAmount
        : legacySingleExpenseReview
          ? legacySingleExpenseReview.approvedAmount
          : adminReview.hasAdminReview
            ? null
            : review.approvedAmount;
      const deductionAmount = metadataReview
        ? metadataReview.deductionAmount
        : legacyRecoveryItem
          ? legacyRecoveryItem.deductionAmount
        : legacySingleExpenseReview
          ? legacySingleExpenseReview.deductionAmount
          : adminReview.hasAdminReview
            ? null
            : review.deductionAmount;
      const hasPersistedReview = hasRecoveredLineItemReview;
      return {
        expenseId: e.id,
        category: e.category,
        projectCode: e.project_code,
        claimDate: e.expense_date,
        description: e.description,
        amountWithBill: parseFloat(e.amount_with_bill || 0),
        amountWithoutBill: parseFloat(e.amount_without_bill || 0),
        amount: getExpenseOriginalTotal(e),
        approvedAmount,
        deductionAmount,
        adminApprovedAmount: hasPersistedReview ? approvedAmount : null,
        adminDeductionAmount: hasPersistedReview ? deductionAmount : null,
        hasPersistedReview,
        approvalRemarks: metadataReview ? metadataReview.remarks : legacyRecoveryItem ? legacyRecoveryItem.remarks : e.approval_remarks,
      };
    }),
  };
  });
}

export async function getClaimById(claimId: string) {
  const { data } = await supabase.from('claims').select('*, expense_items(*)').eq('claim_id', claimId).single();
  if (!data) return null;
  const c = data as any;
  const recoveryMap = await getLegacyAdminReviewRecoveryMap([
    {
      claimId: c.claim_id,
      submittedTotal: getClaimSubmittedTotal(c),
    },
  ]);
  const legacyRecovery = recoveryMap.get(String(c.claim_id || '').trim()) || null;
  const adminReview = applyLegacyAdminReviewRecovery(
    c,
    getClaimAdminReviewSnapshot(c),
    legacyRecovery
  );
  const parsedReviewDescription = parseReviewMetadata(c.admin_description);
  const legacySingleExpenseReview = getLegacySingleExpenseReview(c, c.expense_items || [], adminReview);
  return {
    claimId: c.claim_number || c.claim_id,
    claimIdInternal: c.claim_id,
    date: c.created_at,
    submittedBy: c.submitted_by,
    userEmail: c.user_email,
    site: c.site_name,
    amount: getResolvedClaimAmount(c, adminReview),
    totalWithBill: parseFloat(c.total_with_bill || 0),
    totalWithoutBill: parseFloat(c.total_without_bill || 0),
    status: c.status,
    fileIds: c.drive_file_ids || [],
    managerEmail: c.manager_email,
    managerApprovalStatus: c.manager_approval_status,
    managerApprovalDate: c.manager_approval_date,
    adminEmail: c.admin_email,
    adminApprovalDate: c.admin_approval_date,
    adminApprovalStatus: adminReview.status,
    adminApprovedTotal: adminReview.approvedTotal,
    adminDeductionTotal: adminReview.deductionTotal,
    adminDescription: parsedReviewDescription.remarks || legacyRecovery?.remarks || '',
    rejectionReason: c.rejection_reason,
    expenses: (c.expense_items || []).map((e: any) => {
      const metadataReview = getMetadataReviewItem(c, e.id);
      const legacyRecoveryItem = getLegacyRecoveryItem(legacyRecovery, String(e.id || ''));
      const review = getExpenseReviewState(e);
      const hasRecoveredLineItemReview = Boolean(metadataReview || legacyRecoveryItem || legacySingleExpenseReview || review.hasPersistedReview);
      const approvedAmount = metadataReview
        ? metadataReview.approvedAmount
        : legacyRecoveryItem
          ? legacyRecoveryItem.approvedAmount
        : legacySingleExpenseReview
          ? legacySingleExpenseReview.approvedAmount
          : adminReview.hasAdminReview
            ? null
            : review.approvedAmount;
      const deductionAmount = metadataReview
        ? metadataReview.deductionAmount
        : legacyRecoveryItem
          ? legacyRecoveryItem.deductionAmount
        : legacySingleExpenseReview
          ? legacySingleExpenseReview.deductionAmount
          : adminReview.hasAdminReview
            ? null
            : review.deductionAmount;
      const hasPersistedReview = hasRecoveredLineItemReview;
      return {
        expenseId: e.id,
        category: e.category,
        projectCode: e.project_code,
        claimDate: e.expense_date,
        description: e.description,
        amountWithBill: parseFloat(e.amount_with_bill || 0),
        amountWithoutBill: parseFloat(e.amount_without_bill || 0),
        amount: getExpenseOriginalTotal(e),
        approvedAmount,
        deductionAmount,
        adminApprovedAmount: hasPersistedReview ? approvedAmount : null,
        adminDeductionAmount: hasPersistedReview ? deductionAmount : null,
        hasPersistedReview,
        approvalRemarks: metadataReview ? metadataReview.remarks : legacyRecoveryItem ? legacyRecoveryItem.remarks : e.approval_remarks,
      };
    }),
  };
}

// Helper function - remove after debugging

// ============= TRANSACTIONS =============
export async function getTransactions(userEmail: string, userRole: string, filters?: { userEmail?: string; startDate?: string; endDate?: string; type?: string }) {
  const role = userRole.toLowerCase();
  let query = supabase.from('transactions').select('*');

  if (role === 'admin' || role === 'super admin') {
    if (filters?.userEmail) query = query.eq('user_email', filters.userEmail);
  } else if (role === 'manager') {
    const { data: managed } = await supabase.from('users').select('email').eq('manager_email', userEmail);
    const emails = [userEmail, ...(managed || []).map((u: any) => u.email)];
    if (filters?.userEmail && emails.includes(filters.userEmail)) {
      query = query.eq('user_email', filters.userEmail);
    } else if (!filters?.userEmail) {
      query = query.in('user_email', emails);
    } else {
      return [];
    }
  } else {
    query = query.eq('user_email', userEmail);
  }

  if (filters?.startDate) query = query.gte('created_at', new Date(filters.startDate).toISOString());
  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }
  if (filters?.type) query = query.eq('type', filters.type);

  query = query.order('created_at', { ascending: false });
  const result = await query;
  const transactions = (result.data || []) as any[];
  const claimReferenceIds = [...new Set(
    transactions
      .map((transaction) => String(transaction.reference_id || '').trim())
      .filter(Boolean)
  )];

  let claimNumberById = new Map<string, string>();
  if (claimReferenceIds.length > 0) {
    const { data: claims } = await supabase
      .from('claims')
      .select('claim_id, claim_number')
      .in('claim_id', claimReferenceIds);

    claimNumberById = new Map(
      (claims || []).map((claim: any) => [
        String(claim.claim_id || '').trim(),
        getDisplayClaimNo(claim.claim_number, claim.claim_id),
      ])
    );
  }

  return transactions.map((t: any) => {
    const internalClaimId = String(t.reference_id || '').trim();
    const displayClaimNo = claimNumberById.get(internalClaimId) || internalClaimId;

    return {
      email: t.user_email,
      type: t.type,
      credit: parseFloat(t.credit || 0),
      debit: parseFloat(t.debit || 0),
      description: replaceClaimReference(t.description, internalClaimId, displayClaimNo),
      claimId: displayClaimNo || '',
      claimIdInternal: internalClaimId,
      admin: t.admin_email || '',
      balanceAfter: parseFloat(t.balance_after || 0),
      createdAt: t.created_at,
    };
  });
}

// ============= USER MANAGEMENT =============
export async function getAllUsers() {
  const { data, error } = await supabase.from('users').select('*').order('name');
  if (error) throw error;
  
  const users = [];
  for (const u of (data || []) as any[]) {
    const balance = await getCurrentBalance(u.email);
    users.push({
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
      advance: parseFloat(u.advance_amount) || 0,
      balance,
      manager: u.manager_email || '',
      active: u.active,
    });
  }
  return users;
}

export async function createUser(newUser: { email: string; password: string; name: string; role: string; advance: number; manager: string }) {
  const email = newUser.email.trim().toLowerCase();
  const role = (newUser.role || 'User').trim();
  const passwordValidation = validatePasswordStrength(newUser.password);

  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message || 'Password does not meet security requirements.');
  }

  // Check if user exists using maybeSingle to avoid 406 errors
  const { data: existing } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
  if (existing) throw new Error('Email already exists.');

  const normalizedManager = newUser.manager?.trim().toLowerCase();
  const managerEmail = role === 'User' && normalizedManager && normalizedManager !== 'none' ? normalizedManager : null;
  if (managerEmail) {
    const { data: mgr } = await supabase.from('users').select('email').eq('email', managerEmail).maybeSingle();
    if (!mgr) throw new Error('Manager email not found.');
  }

  const { error } = await supabase.from('users').insert({
    email,
    password_hash: hashPassword(newUser.password),
    name: newUser.name.trim(),
    role,
    advance_amount: newUser.advance || 0,
    manager_email: managerEmail,
    active: true,
  });
  if (error) throw error;

  // Create initial advance transaction if > 0
  if (newUser.advance > 0) {
    await supabase.from('transactions').insert({
      user_email: email,
      admin_email: email,
      type: 'initial_advance',
      credit: newUser.advance,
      debit: 0,
      balance_after: newUser.advance,
      description: 'Initial advance balance',
    });
  }

  const settings = await getCompanySettings();
  await logAudit('user_created', email, 'user', email, `Role: ${newUser.role}, Advance: ₹${newUser.advance}`);
  await sendEmailNotification('user_created', email, {
    employeeName: newUser.name,
    name: newUser.name,
    role: newUser.role,
    advance: newUser.advance,
    email,
    tempPassword: newUser.password,
    loginUrl: DEFAULT_APP_URL,
    userGuideUrl: '',
  });
  return { ok: true, message: `User ${newUser.name} created successfully.` };
}

export async function updateUser(payload: { originalEmail: string; name?: string; email?: string; role?: string; password?: string; manager?: string }) {
  const oldEmail = payload.originalEmail.trim().toLowerCase();
  const updates: any = {};
  const nextRole = (payload.role || '').trim();
  if (payload.name) updates.name = payload.name;
  if (payload.role) updates.role = nextRole;
  if (payload.password) {
    const passwordValidation = validatePasswordStrength(payload.password);
    if (!passwordValidation.ok) {
      throw new Error(passwordValidation.message || 'Password does not meet security requirements.');
    }
    updates.password_hash = hashPassword(payload.password);
  }
  if (payload.manager !== undefined) {
    const normalizedManager = payload.manager?.trim().toLowerCase();
    updates.manager_email = nextRole === 'User' && normalizedManager && normalizedManager !== 'none' ? normalizedManager : null;
  }
  if (payload.email && payload.email.toLowerCase() !== oldEmail) updates.email = payload.email.toLowerCase();

  const { error } = await supabase.from('users').update(updates).eq('email', oldEmail);
  if (error) throw error;
  await logAudit('user_updated', oldEmail, 'user', oldEmail, JSON.stringify(updates));
}

export async function deleteUser(email: string) {
  const { error } = await supabase.from('users').delete().eq('email', email.toLowerCase());
  if (error) throw error;
  await logAudit('user_deleted', email, 'user', email);
}

export async function addUserAdvance(userEmail: string, amount: number, adminEmail: string) {
  const currentBalance = await getCurrentBalance(userEmail);
  const { error } = await supabase.from('transactions').insert({
    user_email: userEmail,
    admin_email: adminEmail,
    type: 'manual_advance',
    credit: amount,
    debit: 0,
    balance_after: currentBalance + amount,
    description: 'Manual advance/credit added by admin',
  });
  if (error) throw error;
  await logAudit('advance_added', adminEmail, 'user', userEmail, `Amount: ₹${amount}`);
  await createNotification(userEmail, 'Advance Added', `₹${amount.toLocaleString('en-IN')} advance has been added to your balance by admin.`, 'success');
}

// ============= USER BALANCE SUMMARY =============
export async function getUserBalanceSummary(userEmail: string, userRole: string) {
  const role = userRole.toLowerCase();
  const { data: users } = await supabase.from('users').select('*');
  const { data: claims } = await supabase.from('claims').select('*, expense_items(*)');

  if (!users) return [];

  const filteredUsers = (users as any[]).filter(u => {
    const uEmail = u.email.toLowerCase();
    if (role === 'admin' || role === 'super admin') return true;
    if (role === 'manager') return uEmail === userEmail.toLowerCase() || u.manager_email?.toLowerCase() === userEmail.toLowerCase();
    return uEmail === userEmail.toLowerCase();
  });

  const summary = [];
  for (const u of filteredUsers) {
    const uEmail = u.email.toLowerCase();
    let total = 0, pending = 0, approved = 0, rejected = 0;
    
    (claims || []).forEach((c: any) => {
      if (c.user_email?.toLowerCase() === uEmail) {
        const amt = getClaimTotal(c);
        const status = String(c.status || '').toLowerCase();
        total += amt;
        if (status.includes('pending')) pending += amt;
        else if (status.includes('approved')) approved += amt;
        else if (status.includes('reject')) rejected += amt;
      }
    });

    const balance = await getCurrentBalance(uEmail);
    summary.push({
      name: u.name,
      email: u.email,
      role: u.role,
      initialAdvance: parseFloat(u.advance_amount || 0),
      totalClaimAmount: total,
      pendingClaims: pending,
      approvedClaims: approved,
      rejectedClaims: rejected,
      currentBalance: balance,
    });
  }
  return summary;
}

// ============= APP LISTS MANAGEMENT =============
export async function getAppLists() {
  const { data } = await supabase.from('app_lists').select('*').order('type').order('value');
  return (data || []) as any[];
}

export async function addAppListItem(item: {
  type: string;
  value: string;
  project_code?: string;
  project?: string;
  allows_all_categories?: boolean;
  expense_categories?: string[];
}) {
  const { error } = await supabase.from('app_lists').insert({ ...item, active: true });
  if (error) throw error;
}

export async function deleteAppListItem(id: string) {
  const { error } = await supabase.from('app_lists').delete().eq('id', id);
  if (error) throw error;
}

// ============= GET MANAGER'S ASSIGNED USERS WITH BALANCES =============
export async function getManagerAssignedUsersWithBalances(managerEmail: string) {
  const { data: managedUsers } = await supabase.from('users').select('*').eq('manager_email', managerEmail).order('name');
  
  if (!managedUsers) return [];
  
  const usersWithBalance = [];
  for (const u of (managedUsers || []) as any[]) {
    const balance = await getCurrentBalance(u.email);
    const { data: lastTx } = await supabase.from('transactions')
      .select('created_at')
      .eq('user_email', u.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    usersWithBalance.push({
      name: u.name,
      email: u.email,
      balance,
      lastTransactionDate: (lastTx as any)?.created_at || null,
    });
  }
  return usersWithBalance;
}

// ============= USERS DIRECTORY (for dropdowns) =============
export async function getUsersDirectory() {
  const { data } = await supabase.from('users').select('name, email, manager_email, role').order('name');
  return (data || []) as any[];
}

// ============= NOTIFICATIONS =============
export async function getNotifications(userEmail: string) {
  const { data } = await supabase.from('notifications' as any).select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data || []) as any[];
}

export async function markNotificationRead(id: string) {
  await supabase.from('notifications' as any).update({ is_read: true } as any).eq('id', id);
}

export async function markAllNotificationsRead(userEmail: string) {
  await supabase.from('notifications' as any).update({ is_read: true } as any).eq('user_email', userEmail).eq('is_read', false);
}

export async function createNotification(userEmail: string, title: string, message: string, type: string = 'info', referenceId?: string) {
  await supabase.from('notifications' as any).insert({
    user_email: userEmail,
    title,
    message,
    type,
    reference_id: referenceId || null,
  } as any);
}

// ============= AUDIT LOGS =============
export async function logAudit(action: string, performedBy: string, targetType: string, targetId?: string, details?: string) {
  await supabase.from('audit_logs' as any).insert({
    action,
    performed_by: performedBy,
    target_type: targetType,
    target_id: targetId || null,
    details: details || null,
  } as any);
}

export async function getAuditLogs() {
  const { data } = await supabase.from('audit_logs' as any).select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data || []) as any[];
}

// ============= DASHBOARD CHART DATA =============
export async function getDashboardChartData(userEmail: string, userRole: string) {
  const role = userRole.toLowerCase();
  let claimsQuery = supabase.from('claims').select('*');
  
  if (role === 'user') {
    claimsQuery = claimsQuery.eq('user_email', userEmail);
  } else if (role === 'manager') {
    // Manager sees own + managed users
    const { data: managed } = await supabase.from('users').select('email').eq('manager_email', userEmail);
    const emails = [userEmail, ...(managed || []).map((u: any) => u.email)];
    claimsQuery = claimsQuery.in('user_email', emails);
  }

  const { data: claims } = await claimsQuery;
  if (!claims) return { monthly: [], byCategory: [], byStatus: [] };

  // Monthly trend (last 6 months)
  const monthMap: Record<string, { month: string; withBill: number; withoutBill: number; total: number; count: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    monthMap[key] = { month: key, withBill: 0, withoutBill: 0, total: 0, count: 0 };
  }

  // By status
  const statusCount: Record<string, number> = {};
  
  for (const c of claims as any[]) {
    const d = new Date(c.created_at);
    const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    const wb = parseFloat(c.total_with_bill || 0);
    const wob = parseFloat(c.total_without_bill || 0);
    if (monthMap[key]) {
      monthMap[key].withBill += wb;
      monthMap[key].withoutBill += wob;
      monthMap[key].total += wb + wob;
      monthMap[key].count++;
    }
    const status = c.status || 'Unknown';
    statusCount[status] = (statusCount[status] || 0) + 1;
  }

  // By category from expense_items
  const { data: expenses } = await supabase.from('expense_items').select('category, amount_with_bill, amount_without_bill');
  const catMap: Record<string, number> = {};
  for (const e of (expenses || []) as any[]) {
    const cat = e.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + parseFloat(e.amount_with_bill || 0) + parseFloat(e.amount_without_bill || 0);
  }

  return {
    monthly: Object.values(monthMap),
    byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    byStatus: Object.entries(statusCount).map(([name, value]) => ({ name, value })),
  };
}
