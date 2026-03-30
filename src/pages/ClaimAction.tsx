import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { approveClaimAsManager, getClaimById, rejectClaim } from '@/lib/claims-api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Paperclip } from 'lucide-react';
import AttachmentPreview from '@/components/views/AttachmentPreview';

export default function ClaimAction() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const claimId = searchParams.get('claimId') || '';
  const role = (searchParams.get('role') || '').toLowerCase();
  const action = (searchParams.get('action') || '').toLowerCase();
  const emailFromLink = (searchParams.get('email') || '').trim().toLowerCase();
  const loginRedirect = `/?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  const mode = useMemo(() => ({
    isApprove: action !== 'reject',
    isReject: action === 'reject',
    isManager: role === 'manager',
    isAdmin: role === 'admin',
  }), [action, role]);

  const isAuthorizedReviewer = useMemo(() => {
    if (!user) return false;
    if (mode.isManager) return user.role === 'Manager' || user.role === 'Super Admin';
    if (mode.isAdmin) return user.role === 'Admin' || user.role === 'Super Admin';
    return false;
  }, [mode.isAdmin, mode.isManager, user]);

  const effectiveApproverEmail = useMemo(() => {
    if (user?.email) return user.email.toLowerCase();
    if (emailFromLink) return emailFromLink;
    if (mode.isManager) return String(claim?.managerEmail || '').trim().toLowerCase();
    return '';
  }, [claim?.managerEmail, emailFromLink, mode.isManager, user?.email]);

  const normalizeClaimForReview = (data: any) => {
    const hasAdminReview = Boolean(String(data?.adminApprovalStatus || '').trim());
    const hasAdminLineItemBreakdown = (data?.expenses || []).some((expense: any) =>
      expense?.adminApprovedAmount != null || expense?.adminDeductionAmount != null
    );

    return {
      ...data,
      hasAdminLineItemBreakdown,
      expenses: (data?.expenses || []).map((expense: any) => {
        const originalAmount = Number(expense.amount ?? 0);
        const adminApprovedAmount = expense.adminApprovedAmount != null ? Number(expense.adminApprovedAmount) : null;
        const adminDeductionAmount = expense.adminDeductionAmount != null ? Number(expense.adminDeductionAmount) : null;
        const approvedAmount = expense.approvedAmount != null
          ? Number(expense.approvedAmount)
          : (hasAdminReview && !hasAdminLineItemBreakdown ? null : originalAmount);
        const deductionAmount = approvedAmount == null
          ? null
          : Number(expense.deductionAmount ?? Math.max(0, originalAmount - approvedAmount));

        return {
          ...expense,
          adminApprovedAmount,
          adminDeductionAmount,
          approvedAmount,
          deductionAmount,
        };
      }),
    };
  };

  const canAccessClaim = (data: any) => {
    if (!user || !data) return false;

    if (mode.isManager) {
      if (user.role === 'Super Admin') return true;
      return String(data.managerEmail || '').trim().toLowerCase() === user.email.toLowerCase();
    }

    if (mode.isAdmin) {
      return user.role === 'Admin' || user.role === 'Super Admin';
    }

    return false;
  };

  useEffect(() => {
    async function loadClaim() {
      if (!claimId) {
        setMessage('Missing claim id.');
        setLoading(false);
        return;
      }
      if (!mode.isManager && !mode.isAdmin) {
        setMessage('Invalid review link.');
        setLoading(false);
        return;
      }
      const data = await getClaimById(claimId);
      if (!data) {
        setMessage('Claim not found.');
        setLoading(false);
        return;
      }
      setClaim(normalizeClaimForReview(data));

      if (user && !isAuthorizedReviewer) {
        setMessage('This signed-in account is not allowed to review this claim from this link.');
        setLoading(false);
        return;
      }
      if (user && !canAccessClaim(data)) {
        setMessage('This signed-in account cannot open this claim.');
        setLoading(false);
        return;
      }
      if (!user && mode.isAdmin) {
        setMessage('Sign in with your approver account to review this claim.');
        setLoading(false);
        return;
      }
      setMessage('');
      setLoading(false);
    }

    void loadClaim();
  }, [claimId, isAuthorizedReviewer, mode.isAdmin, mode.isManager, user]);

  const updateClaimReviewItem = (expenseId: string, field: 'approvedAmount' | 'remarks', value: string) => {
    setClaim((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        expenses: (prev.expenses || []).map((expense: any) => {
          if (expense.expenseId !== expenseId) return expense;
          const original = Number(expense.amount ?? 0);
          const nextApproved = field === 'approvedAmount'
            ? (value === '' ? null : Math.max(0, Math.min(parseFloat(value || '0') || 0, original)))
            : (expense.approvedAmount ?? null);
          return {
            ...expense,
            approvedAmount: nextApproved,
            deductionAmount: nextApproved == null ? null : Math.max(0, original - nextApproved),
            approvalRemarks: field === 'remarks' ? value : expense.approvalRemarks,
          };
        }),
      };
    });
  };

  const claimReviewTotals = (claim?.expenses || []).reduce((acc: any, expense: any) => {
    const original = Number(expense.amount ?? 0);
    const approved = expense.approvedAmount != null ? Number(expense.approvedAmount) : 0;
    const deduction = expense.approvedAmount != null ? Math.max(0, original - approved) : 0;
    return {
      original: acc.original + original,
      approved: acc.approved + approved,
      deduction: acc.deduction + deduction,
    };
  }, { original: 0, approved: 0, deduction: 0 });

  const claimAdminTotals = {
    approved: Number(claim?.adminApprovedTotal ?? 0),
    deduction: Number(claim?.adminDeductionTotal ?? 0),
  };
  const hasEnteredFinalBreakdown = (claim?.expenses || []).some((expense: any) => expense.approvedAmount != null);
  const requiresManualAdminSplit = Boolean(mode.isManager && claim?.adminApprovalStatus && !claim?.hasAdminLineItemBreakdown);
  const isFinalSplitComplete = !requiresManualAdminSplit || (claim?.expenses || []).every((expense: any) => expense.approvedAmount != null);
  const canUseDirectManagerLink = mode.isManager && !user && !!effectiveApproverEmail;
  const canProcessApprove = !processing && mode.isManager && isFinalSplitComplete && (canUseDirectManagerLink || (!!user && isAuthorizedReviewer));

  const processApprove = async () => {
    if (!claimId || !effectiveApproverEmail || !mode.isManager) return;
    setProcessing(true);
    try {
      await approveClaimAsManager(claimId, effectiveApproverEmail, {
        remarks: 'Approved from authenticated review',
        items: (claim?.expenses || []).map((expense: any) => ({
          expenseId: expense.expenseId,
          approvedAmount: expense.approvedAmount ?? expense.amount ?? 0,
          remarks: expense.approvalRemarks || '',
        })),
      });
      setMessage('Claim approved successfully.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to approve claim.');
    }
    setProcessing(false);
  };

  const processReject = async () => {
    if (!claimId || !effectiveApproverEmail || !mode.isManager || !rejectReason.trim()) return;
    setProcessing(true);
    try {
      await rejectClaim(claimId, rejectReason.trim(), effectiveApproverEmail, 'Manager');
      setMessage('Claim rejected successfully.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to reject claim.');
    }
    setProcessing(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-6xl">
        <CardHeader className="space-y-1">
          <CardTitle>{mode.isReject ? 'Reject Claim' : mode.isManager ? 'Final Claim Review' : 'Claim Review'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Claim</p>
                  <p className="mt-1 text-sm font-semibold">{claim?.claimId || claimId}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold">{claim?.status || '-'}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Submitted By</p>
                  <p className="mt-1 text-sm font-semibold">{claim?.submittedBy || '-'}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Site</p>
                  <p className="mt-1 text-sm font-semibold">{claim?.site || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Total With Bill</p>
                  <p className="mt-1 text-sm font-semibold">Rs. {(claim?.totalWithBill ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Total Without Bill</p>
                  <p className="mt-1 text-sm font-semibold">Rs. {(claim?.totalWithoutBill ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5 col-span-2 xl:col-span-1">
                  <p className="text-xs text-muted-foreground">Admin Approved Total</p>
                  <p className="mt-1 text-sm font-semibold">Rs. {(claimAdminTotals.approved ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5 col-span-2 xl:col-span-1">
                  <p className="text-xs text-muted-foreground">Admin Deducted Total</p>
                  <p className="mt-1 text-sm font-semibold text-destructive">Rs. {(claimAdminTotals.deduction ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5 col-span-2 xl:col-span-1">
                  <p className="text-xs text-muted-foreground">Final Approved Total</p>
                  <p className="mt-1 text-lg font-bold text-primary">Rs. {(mode.isApprove && mode.isManager
                    ? (hasEnteredFinalBreakdown ? claimReviewTotals.approved : (claim?.adminApprovedTotal ?? 0))
                    : (claim?.adminApprovalStatus ? (claim?.adminApprovedTotal ?? claim?.amount ?? 0) : (claim?.amount ?? 0))).toFixed(2)}</p>
                </div>
              </div>

              {(claim?.adminApprovalStatus || claim?.adminApprovedTotal != null) && (
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Admin Review</p>
                  <p className="mt-1 text-sm font-medium">Status: {claim.adminApprovalStatus || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    Approved: Rs. {(claim.adminApprovedTotal ?? 0).toFixed(2)} | Deduction: Rs. {(claim.adminDeductionTotal ?? 0).toFixed(2)}
                  </p>
                  {claim.adminDescription && <p className="mt-1 text-sm text-muted-foreground">Remarks: {claim.adminDescription}</p>}
                </div>
              )}

              {mode.isAdmin && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  This link is now review-only for security. Sign in and complete admin verification from the in-app <strong>Admin Approval</strong> page.
                </div>
              )}

              {claim?.expenses?.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  {mode.isManager && !claim.hasAdminLineItemBreakdown && (
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Admin claim totals are available, but the item-level admin breakdown was not stored in the database for this claim. Enter the line-item split before final approval.
                    </div>
                  )}
                  <div className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">Line Items</div>
                  <table className="min-w-[1280px] w-full border-collapse text-[11px] sm:text-xs">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">#</th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Category</th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Project</th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Date</th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Description</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">With Bill</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Without Bill</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Original</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Admin Approved</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Admin Deducted</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Final Approved</th>
                        <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Final Deducted</th>
                        <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                    {claim.expenses.map((expense: any, index: number) => {
                      const original = Number(expense.amount ?? 0);
                      const approved = expense.approvedAmount != null ? Number(expense.approvedAmount) : null;
                      const deduction = approved != null ? Math.max(0, original - approved) : null;
                      return (
                          <tr key={expense.expenseId || index} className="align-top odd:bg-card even:bg-muted/20">
                            <td className="border-b border-border px-2 py-1.5 font-medium text-muted-foreground">{index + 1}</td>
                            <td className="border-b border-border px-2 py-1.5 font-medium">{expense.category}</td>
                            <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{expense.projectCode || '-'}</td>
                            <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{expense.claimDate ? new Date(expense.claimDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                            <td className="border-b border-border px-2 py-1.5 min-w-[220px]">{expense.description}</td>
                            <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap">Rs. {Number(expense.amountWithBill ?? 0).toFixed(2)}</td>
                            <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap">Rs. {Number(expense.amountWithoutBill ?? 0).toFixed(2)}</td>
                            <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap font-medium">Rs. {original.toFixed(2)}</td>
                            <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap text-success">
                              {expense.adminApprovedAmount != null ? `Rs. ${Number(expense.adminApprovedAmount).toFixed(2)}` : '-'}
                            </td>
                          <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap text-destructive">
                            {expense.adminDeductionAmount != null ? `Rs. ${Number(expense.adminDeductionAmount).toFixed(2)}` : '-'}
                          </td>
                            <td className="border-b border-border px-2 py-1.5 text-right">
                              {mode.isApprove && mode.isManager ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={expense.approvedAmount ?? ''}
                                  onChange={(e) => updateClaimReviewItem(expense.expenseId, 'approvedAmount', e.target.value)}
                                  placeholder={requiresManualAdminSplit ? 'Enter' : '0.00'}
                                  className="ml-auto h-7 w-24 text-right text-[11px]"
                                />
                              ) : (
                                <span className="whitespace-nowrap text-success">Rs. {approved.toFixed(2)}</span>
                              )}
                            </td>
                          <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap text-destructive">{deduction != null ? `Rs. ${deduction.toFixed(2)}` : '-'}</td>
                            <td className="border-b border-border px-2 py-1.5 min-w-[220px]">
                              {mode.isApprove && mode.isManager ? (
                                <Textarea
                                  value={expense.approvalRemarks || ''}
                                  onChange={(e) => updateClaimReviewItem(expense.expenseId, 'remarks', e.target.value)}
                                  rows={2}
                                  className="min-h-[52px] text-[11px]"
                                />
                              ) : (
                                expense.approvalRemarks || '-'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {claim.adminApprovalStatus && (
                    <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      Entered final total: Rs. {claimReviewTotals.approved.toFixed(2)} | Admin reviewed total: Rs. {claimAdminTotals.approved.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {claim?.fileIds?.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Paperclip className="h-4 w-4" /> Attachments ({claim.fileIds.length})
                  </h4>
                  <AttachmentPreview fileIds={claim.fileIds} claimId={claim.claimIdInternal || claim.claimId} compact />
                </div>
              )}

              {mode.isManager && !message && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Rejection Reason</label>
                  <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="min-h-[88px]" placeholder="Enter rejection reason" />
                </div>
              )}

              {message ? (
                <div className="rounded border border-border bg-muted/40 p-4 text-sm">{message}</div>
              ) : (
                <div className="flex gap-2">
                  {mode.isManager && (
                    <Button onClick={() => void processApprove()} disabled={!canProcessApprove}>
                      {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {processing ? 'Processing Approval...' : 'Final Approve'}
                    </Button>
                  )}
                  {mode.isManager && (
                    <Button
                      variant="destructive"
                      onClick={() => void processReject()}
                      disabled={processing || !mode.isManager || !effectiveApproverEmail || !rejectReason.trim()}
                    >
                      {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Reject Claim
                    </Button>
                  )}
                </div>
              )}

              {!user && mode.isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={loginRedirect}>Sign in to approve</a>
                  </Button>
                  <Button asChild variant="destructive">
                    <a href={loginRedirect}>Sign in to reject</a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={loginRedirect}>Sign in to review</a>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
