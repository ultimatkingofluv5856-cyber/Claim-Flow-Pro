import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingManagerClaims, getPendingAdminClaims, approveClaimAsManager, approveClaimAsAdmin, rejectClaim, getClaimById } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveOverlay } from '@/components/ui/responsive-overlay';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X, Eye, RefreshCw, UserCheck, ShieldCheck, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import AttachmentPreview from '@/components/views/AttachmentPreview';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function formatDate(date: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ApprovalViewProps {
  type: 'manager' | 'admin';
}

export default function ApprovalView({ type }: ApprovalViewProps) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ claimId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState<{ claimId: string } | null>(null);
  const [approveDescription, setApproveDescription] = useState('');
  const [managerReviewMode, setManagerReviewMode] = useState(false);
  const [managerReviewClaimId, setManagerReviewClaimId] = useState('');
  const [managerReviewLoading, setManagerReviewLoading] = useState(false);
  const [adminReviewModal, setAdminReviewModal] = useState<{ claimId: string } | null>(null);
  const [adminReviewDraft, setAdminReviewDraft] = useState<any>(null);
  const [adminReviewLoading, setAdminReviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [viewClaim, setViewClaim] = useState<any>(null);

  const resolveDisplayClaimId = (claimIdentifier?: string | null) => {
    const normalized = String(claimIdentifier || '').trim();
    if (!normalized) return '';
    return claims.find((claim) => claim.claimIdInternal === normalized || claim.claimId === normalized)?.claimId || normalized;
  };

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

  const loadClaims = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = type === 'manager'
        ? await getPendingManagerClaims(user.email, user.role)
        : await getPendingAdminClaims();
      setClaims(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadClaims(); }, [user, type]);

  const openAdminReview = async (claimId: string) => {
    setAdminReviewModal({ claimId });
    setAdminReviewLoading(true);
    setAdminReviewDraft(null);
    try {
      const data = await getClaimById(claimId);
      if (!data) throw new Error('Claim not found');
      setAdminReviewDraft({
        ...data,
        remarks: data.adminDescription || '',
        items: (data.expenses || []).map((expense: any) => ({
          expenseId: expense.expenseId,
          category: expense.category,
          projectCode: expense.projectCode,
          claimDate: expense.claimDate,
          description: expense.description,
          amountWithBill: expense.amountWithBill ?? 0,
          amountWithoutBill: expense.amountWithoutBill ?? 0,
          originalAmount: expense.amount ?? 0,
          approvedAmount: data.adminApprovalStatus === 'Verified' ? (expense.approvedAmount ?? expense.amount ?? 0) : (expense.amount ?? 0),
          deductionAmount: data.adminApprovalStatus === 'Verified' ? (expense.deductionAmount ?? 0) : 0,
          remarks: expense.approvalRemarks || '',
        })),
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load claim');
      setAdminReviewModal(null);
    }
    setAdminReviewLoading(false);
  };

  const openManagerReview = async (claimId: string) => {
    setManagerReviewMode(true);
    setManagerReviewClaimId(claimId);
    setApproveDescription('');
    setViewClaim(null);
    setManagerReviewLoading(true);
    try {
      const data = await getClaimById(claimId);
      if (!data) throw new Error('Claim not found');
      setViewClaim(normalizeClaimForReview(data));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load claim');
      setManagerReviewMode(false);
      setManagerReviewClaimId('');
    }
    setManagerReviewLoading(false);
  };

  const updateAdminReviewItem = (expenseId: string, field: 'approvedAmount' | 'remarks', value: string) => {
    setAdminReviewDraft((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item: any) => {
          if (item.expenseId !== expenseId) return item;
          const nextApproved = field === 'approvedAmount' ? Math.max(0, parseFloat(value || '0') || 0) : item.approvedAmount;
          const original = Number(item.originalAmount || 0);
          return {
            ...item,
            approvedAmount: nextApproved,
            deductionAmount: Math.max(0, original - nextApproved),
            remarks: field === 'remarks' ? value : item.remarks,
          };
        }),
      };
    });
  };

  const updateManagerReviewItem = (expenseId: string, field: 'approvedAmount' | 'remarks', value: string) => {
    setViewClaim((prev: any) => {
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

  const handleApprove = async () => {
    if (!approveModal) return;
    setProcessing(true);
    try {
      await approveClaimAsManager(approveModal.claimId, user!.email, approveDescription);
      toast.success('Claim approved');
      setApproveModal(null);
      setApproveDescription('');
      loadClaims();
    } catch (e: any) {
      toast.error(e.message);
    }
    setProcessing(false);
  };

  const handleManagerFinalApprove = async () => {
    if (!viewClaim) return;
    setProcessing(true);
    try {
      await approveClaimAsManager(viewClaim.claimIdInternal || viewClaim.claimId, user!.email, {
        remarks: approveDescription,
        items: (viewClaim.expenses || []).map((expense: any) => ({
          expenseId: expense.expenseId,
          approvedAmount: expense.approvedAmount ?? expense.amount ?? 0,
          remarks: expense.approvalRemarks || '',
        })),
      });
      toast.success('Claim approved');
      setViewClaim(null);
      setApproveDescription('');
      setManagerReviewMode(false);
      setManagerReviewClaimId('');
      loadClaims();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve claim');
    }
    setProcessing(false);
  };

  const handleAdminSubmit = async () => {
    if (!adminReviewModal || !adminReviewDraft) return;
    setProcessing(true);
    try {
      await approveClaimAsAdmin(adminReviewModal.claimId, user!.email, {
        remarks: adminReviewDraft.remarks || '',
        items: (adminReviewDraft.items || []).map((item: any) => ({
          expenseId: item.expenseId,
          approvedAmount: item.approvedAmount,
          remarks: item.remarks,
        })),
      });
      toast.success('Claim verified and sent for final approval');
      setAdminReviewModal(null);
      setAdminReviewDraft(null);
      loadClaims();
    } catch (e: any) {
      toast.error(e.message || 'Failed to verify claim');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    setProcessing(true);
    try {
      await rejectClaim(rejectModal!.claimId, rejectReason, user!.email, type === 'manager' ? 'Manager' : 'Admin');
      toast.success('Claim rejected');
      setRejectModal(null);
      setRejectReason('');
      loadClaims();
    } catch (e: any) {
      toast.error(e.message);
    }
    setProcessing(false);
  };

  const reviewTotals = (adminReviewDraft?.items || []).reduce((acc: any, item: any) => {
    const original = Number(item.originalAmount || 0);
    const approved = Number(item.approvedAmount || 0);
    const deduction = Math.max(0, original - approved);
    return {
      original: acc.original + original,
      approved: acc.approved + approved,
      deduction: acc.deduction + deduction,
    };
  }, { original: 0, approved: 0, deduction: 0 });

  const managerReviewTotals = (viewClaim?.expenses || []).reduce((acc: any, expense: any) => {
    const original = Number(expense.amount ?? 0);
    const approved = expense.approvedAmount != null ? Number(expense.approvedAmount) : 0;
    const deduction = expense.approvedAmount != null ? Math.max(0, original - approved) : 0;
    return {
      original: acc.original + original,
      approved: acc.approved + approved,
      deduction: acc.deduction + deduction,
    };
  }, { original: 0, approved: 0, deduction: 0 });

  const managerAdminTotals = {
    approved: Number(viewClaim?.adminApprovedTotal ?? 0),
    deduction: Number(viewClaim?.adminDeductionTotal ?? 0),
  };
  const hasManagerEnteredFinalBreakdown = (viewClaim?.expenses || []).some((expense: any) => expense.approvedAmount != null);
  const requiresManualAdminSplit = Boolean(managerReviewMode && viewClaim?.adminApprovalStatus && !viewClaim?.hasAdminLineItemBreakdown);
  const isFinalSplitComplete = !requiresManualAdminSplit || (viewClaim?.expenses || []).every((expense: any) => expense.approvedAmount != null);
  const canSubmitFinalApproval = !processing && isFinalSplitComplete;

  const handleView = async (claimId: string) => {
    setManagerReviewMode(false);
    setManagerReviewClaimId('');
    const data = await getClaimById(claimId);
    setViewClaim(data ? normalizeClaimForReview(data) : data);
  };

  const Icon = type === 'manager' ? UserCheck : ShieldCheck;
  const title = type === 'manager' ? 'Manager Approval' : 'Admin Approval';
  const statusBadge = <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-bold"><Icon className="h-5 w-5" /> {title}</h2>
          <Button variant="outline" size="sm" onClick={loadClaims}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
        </div>
        {type === 'admin' && (
          <div className="border-b border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Open each claim from <span className="font-semibold text-foreground">Admin Approval</span>, review the line items one by one, enter approved amounts and remarks, then send the claim for final approval.
          </div>
        )}

        <div className="block space-y-3 p-3 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <Skeleton className="mb-3 h-5 w-1/2" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          ) : claims.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No pending claims</div>
          ) : claims.map((claim) => (
            <div key={claim.claimId} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{claim.claimId}</p>
                  <p className="mt-2 text-2xl font-bold text-primary">Rs. {claim.amount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">{claim.site}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(claim.date)}</p>
                  <p className="text-xs text-muted-foreground">Submitted by {claim.submittedBy}</p>
                </div>
                {statusBadge}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">With Bill</p>
                  <p className="font-medium">Rs. {(claim.totalWithBill ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Without Bill</p>
                  <p className="font-medium">Rs. {(claim.totalWithoutBill ?? 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleView(claim.claimIdInternal || claim.claimId)}>
                  <Eye className="mr-1 h-4 w-4" /> Details
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-success" onClick={() => (type === 'admin' ? void openAdminReview(claim.claimIdInternal || claim.claimId) : void openManagerReview(claim.claimIdInternal || claim.claimId))} disabled={processing || managerReviewLoading}>
                  <Check className="mr-1 h-4 w-4" /> Review
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={() => setRejectModal({ claimId: claim.claimIdInternal || claim.claimId })}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left">Claim ID</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Site</th>
                <th className="p-3 text-right">With Bill</th>
                <th className="p-3 text-right">Without Bill</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="p-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : claims.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No pending claims</td></tr>
              ) : claims.map((claim) => (
                <tr key={claim.claimId} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{claim.claimId}</td>
                  <td className="p-3">{formatDate(claim.date)}</td>
                  <td className="p-3">{claim.submittedBy}</td>
                  <td className="p-3">{claim.site}</td>
                  <td className="p-3 text-right">Rs. {(claim.totalWithBill ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-right">Rs. {(claim.totalWithoutBill ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-right text-base font-bold">Rs. {claim.amount.toFixed(2)}</td>
                  <td className="space-x-1 p-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleView(claim.claimIdInternal || claim.claimId)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-success" onClick={() => (type === 'admin' ? void openAdminReview(claim.claimIdInternal || claim.claimId) : void openManagerReview(claim.claimIdInternal || claim.claimId))} disabled={processing || managerReviewLoading}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRejectModal({ claimId: claim.claimIdInternal || claim.claimId })}><X className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ResponsiveOverlay
        open={!!adminReviewModal}
        onOpenChange={(open) => {
          if (!open) {
            setAdminReviewModal(null);
            setAdminReviewDraft(null);
          }
        }}
        title={`Admin Review - ${adminReviewDraft?.claimId || resolveDisplayClaimId(adminReviewModal?.claimId)}`}
        desktopClassName="max-w-[96rem]"
        mobileClassName="max-h-[94svh]"
        bodyClassName="max-h-[82vh] overflow-y-auto"
        footer={adminReviewModal ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setAdminReviewModal(null)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleAdminSubmit} disabled={processing || adminReviewLoading || !adminReviewDraft}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Send for Final Approval
            </Button>
          </div>
        ) : undefined}
      >
        {adminReviewLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : adminReviewDraft ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,0.9fr)]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Original Total</p>
                  <p className="mt-1 text-sm font-semibold">Rs. {reviewTotals.original.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Approved Total</p>
                  <p className="mt-1 text-sm font-semibold text-success">Rs. {reviewTotals.approved.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Deduction Total</p>
                  <p className="mt-1 text-sm font-semibold text-destructive">Rs. {reviewTotals.deduction.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="mt-1 text-sm font-medium">{adminReviewDraft.managerEmail || '-'}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Admin Remarks</Label>
                <Textarea
                  placeholder="Add notes for the final approver..."
                  value={adminReviewDraft.remarks || ''}
                  onChange={e => setAdminReviewDraft((prev: any) => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  className="min-h-[72px]"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-[980px] w-full border-collapse text-[11px] sm:text-xs">
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
                      <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Approved</th>
                      <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Deduction</th>
                      <th className="border-b border-border px-2 py-1.5 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminReviewDraft.items || []).map((item: any, index: number) => (
                      <tr key={item.expenseId} className="align-top odd:bg-card even:bg-muted/20">
                        <td className="border-b border-border px-2 py-1.5 font-medium text-muted-foreground">{index + 1}</td>
                        <td className="border-b border-border px-2 py-1.5 font-medium">{item.category}</td>
                        <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{item.projectCode || '-'}</td>
                        <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{item.claimDate ? formatDate(item.claimDate) : '-'}</td>
                        <td className="border-b border-border px-2 py-1.5 min-w-[220px]">{item.description}</td>
                        <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap">Rs. {Number(item.amountWithBill || 0).toFixed(2)}</td>
                        <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap">Rs. {Number(item.amountWithoutBill || 0).toFixed(2)}</td>
                        <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap font-medium">Rs. {Number(item.originalAmount || 0).toFixed(2)}</td>
                        <td className="border-b border-border px-2 py-1.5 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.approvedAmount ?? ''}
                            onChange={e => updateAdminReviewItem(item.expenseId, 'approvedAmount', e.target.value)}
                            className="ml-auto h-7 w-24 text-right text-[11px]"
                          />
                        </td>
                        <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap text-destructive">Rs. {Number(item.deductionAmount || 0).toFixed(2)}</td>
                        <td className="border-b border-border px-2 py-1.5 min-w-[220px]">
                          <Textarea
                            placeholder="Optional remarks"
                            value={item.remarks || ''}
                            onChange={e => updateAdminReviewItem(item.expenseId, 'remarks', e.target.value)}
                            rows={2}
                            className="min-h-[52px] text-[11px]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="self-start rounded-lg border border-border bg-card p-2.5 lg:sticky lg:top-0 lg:space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Attachments</p>
                  <p className="text-xs text-muted-foreground">{(adminReviewDraft.fileIds || []).length} file(s) available</p>
                </div>
                <Badge variant="outline" className="shrink-0">Click to preview</Badge>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <AttachmentPreview
                  fileIds={adminReviewDraft.fileIds || []}
                  claimId={adminReviewDraft.claimIdInternal || adminReviewDraft.claimId}
                  compact
                />
              </div>
              <div className="rounded-md bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Open an attachment in preview, then come back to the line items and adjust the approval amount if needed.
              </div>
            </aside>
          </div>
        ) : null}
      </ResponsiveOverlay>

      <ResponsiveOverlay
        open={!!approveModal}
        onOpenChange={(open) => {
          if (!open) {
            setApproveModal(null);
            setApproveDescription('');
          }
        }}
        title={`Approve Claim - ${resolveDisplayClaimId(approveModal?.claimId)}`}
        footer={approveModal ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setApproveModal(null)}>Cancel</Button>
            <Button className="gradient-success text-success-foreground" onClick={handleApprove} disabled={processing}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Approve
            </Button>
          </div>
        ) : undefined}
      >
        <div className="space-y-3">
          <div>
            <Label>Notes / Description (optional)</Label>
            <Textarea
              placeholder="Add any notes about this approval..."
              value={approveDescription}
              onChange={e => setApproveDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        open={!!rejectModal}
        onOpenChange={(open) => {
          if (!open) {
            setRejectModal(null);
            setRejectReason('');
          }
        }}
        title={`Reject Claim - ${resolveDisplayClaimId(rejectModal?.claimId)}`}
        footer={rejectModal ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />} Reject
            </Button>
          </div>
        ) : undefined}
      >
        <div>
          <Label>Reason for Rejection *</Label>
          <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={5} />
        </div>
      </ResponsiveOverlay>

      <ResponsiveOverlay
        open={managerReviewMode || !!viewClaim}
        onOpenChange={(open) => {
          if (!open) {
            setViewClaim(null);
            setManagerReviewMode(false);
            setManagerReviewClaimId('');
            setApproveDescription('');
          }
        }}
        title={`${managerReviewMode ? 'Final Review' : 'Claim Details'} - ${viewClaim?.claimId || resolveDisplayClaimId(managerReviewClaimId)}`}
        desktopClassName={managerReviewMode ? 'max-w-[96rem]' : 'max-w-3xl'}
        mobileClassName="max-h-[94svh]"
        bodyClassName="max-h-[82vh] overflow-y-auto"
        footer={viewClaim && managerReviewMode && type === 'manager' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => { setViewClaim(null); setManagerReviewMode(false); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setRejectModal({ claimId: viewClaim.claimIdInternal || viewClaim.claimId }); setViewClaim(null); setManagerReviewMode(false); }} disabled={processing}>
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button className="gradient-success text-success-foreground" onClick={handleManagerFinalApprove} disabled={!canSubmitFinalApproval}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Final Approve
            </Button>
          </div>
        ) : viewClaim ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setViewClaim(null)}>Close</Button>
          </div>
        ) : undefined}
      >
        {managerReviewLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : viewClaim ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground">Submitted By</p>
                <p className="mt-1 text-sm font-medium">{viewClaim.submittedBy}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground">Site</p>
                <p className="mt-1 text-sm font-medium">{viewClaim.site}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground">With Bill / Without Bill</p>
                <p className="mt-1 text-sm font-medium">Rs. {(viewClaim.totalWithBill ?? 0).toFixed(2)} / Rs. {(viewClaim.totalWithoutBill ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground">Admin Approved Total</p>
                <p className="mt-1 text-sm font-semibold">Rs. {(managerReviewMode ? managerAdminTotals.approved : (viewClaim.adminApprovedTotal ?? 0)).toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground">Admin Deducted Total</p>
                <p className="mt-1 text-sm font-semibold text-destructive">Rs. {(managerReviewMode ? managerAdminTotals.deduction : (viewClaim.adminDeductionTotal ?? 0)).toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5 col-span-2 xl:col-span-1">
                <p className="text-xs text-muted-foreground">Final Approved Total</p>
                <p className="mt-1 text-lg font-bold text-primary">Rs. {(managerReviewMode
                  ? (hasManagerEnteredFinalBreakdown ? managerReviewTotals.approved : (viewClaim.adminApprovedTotal ?? 0))
                  : (viewClaim.adminApprovalStatus ? (viewClaim.adminApprovedTotal ?? viewClaim.amount ?? 0) : (viewClaim.amount ?? 0))).toFixed(2)}</p>
              </div>
              {(viewClaim.adminApprovedTotal != null || viewClaim.adminApprovalStatus) && (
                <div className="col-span-2 rounded-md border border-border bg-muted/20 p-2.5 xl:col-span-6">
                  <p className="text-xs text-muted-foreground">Admin Review</p>
                  <p className="mt-1 text-sm font-medium">Status: {viewClaim.adminApprovalStatus || '-'}</p>
                  <p className="text-sm text-muted-foreground">Approved: Rs. {(viewClaim.adminApprovedTotal ?? 0).toFixed(2)} | Deduction: Rs. {(viewClaim.adminDeductionTotal ?? 0).toFixed(2)}</p>
                  {viewClaim.adminDescription && <p className="mt-1 text-sm text-muted-foreground">Remarks: {viewClaim.adminDescription}</p>}
                </div>
              )}
            </div>

            {managerReviewMode && type === 'manager' && (
              <div className="space-y-1.5">
                <Label>Final Approval Notes</Label>
                <Textarea
                  placeholder="Add a short note before final approval..."
                  value={approveDescription}
                  onChange={e => setApproveDescription(e.target.value)}
                  rows={2}
                  className="min-h-[72px]"
                />
              </div>
            )}

            {managerReviewMode && viewClaim.expenses && viewClaim.expenses.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                {!viewClaim.hasAdminLineItemBreakdown && (
                  <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Admin claim totals are available, but the item-level admin breakdown was not stored in the database for this claim. Enter the line-item split before final approval.
                  </div>
                )}
                <div className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">
                  Line Items
                </div>
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
                    {viewClaim.expenses.map((expense: any, index: number) => {
                      const original = Number(expense.amount ?? 0);
                      const approved = expense.approvedAmount != null ? Number(expense.approvedAmount) : null;
                      const deduction = approved != null ? Math.max(0, original - approved) : null;
                      return (
                        <tr key={expense.expenseId || index} className="align-top odd:bg-card even:bg-muted/20">
                          <td className="border-b border-border px-2 py-1.5 font-medium text-muted-foreground">{index + 1}</td>
                          <td className="border-b border-border px-2 py-1.5 font-medium">{expense.category}</td>
                          <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{expense.projectCode || '-'}</td>
                          <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{expense.claimDate ? formatDate(expense.claimDate) : '-'}</td>
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
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={expense.approvedAmount ?? ''}
                              onChange={e => updateManagerReviewItem(expense.expenseId, 'approvedAmount', e.target.value)}
                              placeholder={requiresManualAdminSplit ? 'Enter' : '0.00'}
                              className="ml-auto h-7 w-24 text-right text-[11px]"
                            />
                          </td>
                          <td className="border-b border-border px-2 py-1.5 text-right whitespace-nowrap text-destructive">{deduction != null ? `Rs. ${deduction.toFixed(2)}` : '-'}</td>
                          <td className="border-b border-border px-2 py-1.5 min-w-[220px]">
                            <Textarea
                              placeholder="Optional remarks"
                              value={expense.approvalRemarks || ''}
                              onChange={e => updateManagerReviewItem(expense.expenseId, 'remarks', e.target.value)}
                              rows={2}
                              className="min-h-[52px] text-[11px]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {viewClaim.adminApprovalStatus && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Entered final total: Rs. {managerReviewTotals.approved.toFixed(2)} | Admin reviewed total: Rs. {managerAdminTotals.approved.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {viewClaim.fileIds && viewClaim.fileIds.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Paperclip className="h-4 w-4" /> Attachments ({viewClaim.fileIds.length})
                </h4>
                <AttachmentPreview fileIds={viewClaim.fileIds} claimId={viewClaim.claimId} compact={managerReviewMode} />
              </div>
            )}

            {!managerReviewMode && (
              <div className="block space-y-2 sm:hidden">
              {viewClaim.expenses?.map((expense: any, i: number) => (
                <div key={i} className="space-y-1 rounded border border-border bg-card p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{expense.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span>{expense.projectCode || '-'}</span></div>
                  {expense.description && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Description</span><span className="max-w-[60%] text-right">{expense.description}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Approved</span><span className="font-medium text-success">Rs. {Number(expense.adminApprovedAmount ?? expense.approvedAmount ?? expense.amount ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Deduction</span><span className="font-medium text-destructive">Rs. {Number(expense.adminDeductionAmount ?? expense.deductionAmount ?? 0).toFixed(2)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold text-primary">Rs. {(expense.amount ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              </div>
            )}

            {!managerReviewMode && (
              <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left">Category</th>
                    <th className="border p-2 text-left">Code</th>
                    <th className="border p-2 text-left">Description</th>
                    <th className="border p-2 text-right">Approved (Rs.)</th>
                    <th className="border p-2 text-right">Deduction (Rs.)</th>
                    <th className="border p-2 text-right">Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewClaim.expenses?.map((expense: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="border p-2">{expense.category}</td>
                      <td className="border p-2">{expense.projectCode}</td>
                      <td className="border p-2">{expense.description}</td>
                      <td className="border p-2 text-right">Rs. {Number(expense.adminApprovedAmount ?? expense.approvedAmount ?? expense.amount ?? 0).toFixed(2)}</td>
                      <td className="border p-2 text-right">Rs. {Number(expense.adminDeductionAmount ?? expense.deductionAmount ?? 0).toFixed(2)}</td>
                      <td className="border p-2 text-right font-medium">Rs. {(expense.amount ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={3} className="border p-2 text-right">TOTAL</td>
                    <td className="border p-2 text-right">Rs. {Number(viewClaim.adminApprovedTotal ?? viewClaim.amount ?? 0).toFixed(2)}</td>
                    <td className="border p-2 text-right">Rs. {Number(viewClaim.adminDeductionTotal ?? 0).toFixed(2)}</td>
                    <td className="border p-2 text-right">Rs. {(viewClaim.amount ?? 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}
      </ResponsiveOverlay>
    </div>
  );
}
