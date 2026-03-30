import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getClaimsHistory, getCompanySettings, getAllUsers } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, RefreshCw, Eye, Printer, Download, Filter } from 'lucide-react';
import { amountToWords } from '@/lib/amount-to-words';

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatInputDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

function buildVoucherNo(selectedClaims: any[]) {
  const prefix = `PV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  return `${prefix}-${String(selectedClaims.length).padStart(2, '0')}`;
}

export default function PaymentVoucherView() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userDirectory, setUserDirectory] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ userEmail: '', startDate: '', endDate: '' });

  const loadClaims = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [all, settings, allUsers] = await Promise.all([
        getClaimsHistory(user.email, user.role),
        getCompanySettings(),
        getAllUsers(),
      ]);
      setClaims(all.filter(c => c.status.toLowerCase() === 'approved'));
      setCompanySettings(settings);
      setUsers(allUsers || []);
      setUserDirectory(
        Object.fromEntries((allUsers || []).map((entry: any) => [String(entry.email || '').trim().toLowerCase(), entry.name]))
      );
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadClaims(); }, [user]);

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (filters.userEmail && claim.userEmail !== filters.userEmail) return false;
      if (filters.startDate && formatInputDate(claim.date) < filters.startDate) return false;
      if (filters.endDate && formatInputDate(claim.date) > filters.endDate) return false;
      return true;
    });
  }, [claims, filters]);

  const selectedClaims = useMemo(
    () => filteredClaims.filter((claim) => selectedIds.has(claim.claimIdInternal)),
    [filteredClaims, selectedIds]
  );

  const selectedTotals = useMemo(() => ({
    totalWithBill: selectedClaims.reduce((sum, claim) => sum + (claim.totalWithBill || 0), 0),
    totalWithoutBill: selectedClaims.reduce((sum, claim) => sum + (claim.totalWithoutBill || 0), 0),
    totalAmount: selectedClaims.reduce((sum, claim) => sum + (claim.amount || 0), 0),
  }), [selectedClaims]);

  const toggleSelect = (claimId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filteredClaims.length === 0) return;
    const allSelected = filteredClaims.every((claim) => selectedIds.has(claim.claimIdInternal));
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredClaims.forEach((claim) => {
        if (allSelected) next.delete(claim.claimIdInternal);
        else next.add(claim.claimIdInternal);
      });
      return next;
    });
  };

  const openVoucher = (claimsForVoucher: any[]) => {
    if (claimsForVoucher.length === 0) return;
    setVoucher({
      voucherNo: buildVoucherNo(claimsForVoucher),
      date: new Date().toISOString(),
      claims: claimsForVoucher,
      claimIds: claimsForVoucher.map((claim) => claim.claimId),
      paidTo: claimsForVoucher.length === 1 ? claimsForVoucher[0].submittedBy : 'Multiple Users',
      periodFrom: claimsForVoucher.reduce((min, claim) => !min || claim.date < min ? claim.date : min, ''),
      periodTo: claimsForVoucher.reduce((max, claim) => !max || claim.date > max ? claim.date : max, ''),
      totalWithBill: claimsForVoucher.reduce((sum, claim) => sum + (claim.totalWithBill || 0), 0),
      totalWithoutBill: claimsForVoucher.reduce((sum, claim) => sum + (claim.totalWithoutBill || 0), 0),
      amount: claimsForVoucher.reduce((sum, claim) => sum + (claim.amount || 0), 0),
    });
  };

  const getVoucherMarkup = () => {
    const content = document.getElementById('voucher-content');
    if (!content) return '';
    const clone = content.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('img').forEach((img) => {
      img.setAttribute('style', 'display:block;height:48px;width:48px;object-fit:contain;margin:0 auto 8px;');
    });
    return clone.innerHTML;
  };

  const printVoucher = () => {
    const markup = getVoucherMarkup();
    if (!markup) return;
    const w = window.open('', '', 'width=1100,height=750');
    if (!w) return;
    w.document.write(`<html><head><title>Payment Voucher</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; }
      .text-right { text-align: right; }
      h2 { color: #2563eb; }
      .voucher-logo { display:block; height:48px; width:48px; object-fit:contain; margin:0 auto 8px; }
      @media print { body { padding: 10px; } }
    </style></head><body>${markup}</body></html>`);
    w.document.close();
    w.print();
  };

  const exportVoucherHTML = () => {
    if (!voucher) return;
    const markup = getVoucherMarkup();
    if (!markup) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Voucher ${voucher.voucherNo}</title>
<style>body{font-family:Arial;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}th{background:#f5f5f5}.text-right{text-align:right}h2{color:#2563eb}.voucher-logo{display:block;height:48px;width:48px;object-fit:contain;margin:0 auto 8px}</style>
</head><body>${markup}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-${voucher.voucherNo}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allFilteredSelected = filteredClaims.length > 0 && filteredClaims.every((claim) => selectedIds.has(claim.claimIdInternal));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      <div className="glass-card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">User</Label>
            <Select value={filters.userEmail} onValueChange={(value) => setFilters(prev => ({ ...prev, userEmail: value === 'all' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((entry) => (
                  <SelectItem key={entry.email} value={entry.email}>{entry.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From Date</Label>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">To Date</Label>
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setFilters({ userEmail: '', startDate: '', endDate: '' })}>Reset</Button>
            <Button size="sm" onClick={loadClaims}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>
        </div>
      </div>

      {selectedClaims.length > 0 && (
        <div className="glass-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-primary">
          <div className="text-sm">
            <strong>{selectedClaims.length}</strong> claims selected.
            <span className="ml-2 text-muted-foreground">Total: ₹{selectedTotals.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openVoucher(selectedClaims)}>
              <Receipt className="h-4 w-4 mr-1" /> Create Combined Voucher
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="font-bold flex items-center gap-2"><Receipt className="h-5 w-5" /> Payment Vouchers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="p-3 text-left">Claim ID</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Site</th>
                <th className="p-3 text-right">With Bill</th>
                <th className="p-3 text-right">Without Bill</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
              ) : filteredClaims.length === 0 ? (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No approved claims</td></tr>
              ) : filteredClaims.map((claim) => (
                <tr key={claim.claimIdInternal} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3">
                    <Checkbox checked={selectedIds.has(claim.claimIdInternal)} onCheckedChange={() => toggleSelect(claim.claimIdInternal)} />
                  </td>
                  <td className="p-3 font-mono text-xs">{claim.claimId}</td>
                  <td className="p-3">{formatDate(claim.date)}</td>
                  <td className="p-3">{claim.site}</td>
                  <td className="p-3 text-right">₹{(claim.totalWithBill ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-right">₹{(claim.totalWithoutBill ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-right font-medium">₹{claim.amount.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => openVoucher([claim])}><Eye className="h-4 w-4 mr-1" /> Voucher</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!voucher} onOpenChange={() => setVoucher(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Payment Voucher - {voucher?.voucherNo}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportVoucherHTML}><Download className="h-4 w-4 mr-1" /> Export</Button>
                <Button variant="outline" size="sm" onClick={printVoucher}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {voucher && (
            <div id="voucher-content">
              <div className="border-2 border-border rounded-lg p-6">
                <div className="text-center mb-4">
                  <img
                    src={companySettings?.logo_url || '/ipi-logo.jpg'}
                    alt="Logo"
                    width="48"
                    height="48"
                    className="mx-auto mb-2 block object-contain"
                    style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                  />
                  <h2 className="text-xl font-bold text-primary">{companySettings?.company_name || 'Company'}</h2>
                  {companySettings?.company_subtitle && (
                    <p className="text-sm text-muted-foreground">{companySettings.company_subtitle}</p>
                  )}
                  <h3 className="text-lg font-semibold mt-2 border-y border-border py-1">PAYMENT VOUCHER</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div><strong>Voucher No:</strong> {voucher.voucherNo}</div>
                  <div><strong>Generated On:</strong> {formatDate(voucher.date)}</div>
                  <div><strong>Paid To:</strong> {voucher.paidTo}</div>
                  <div><strong>Claim Count:</strong> {voucher.claims.length}</div>
                  <div><strong>Period:</strong> {formatDate(voucher.periodFrom)} to {formatDate(voucher.periodTo)}</div>
                  <div><strong>Claim IDs:</strong> {voucher.claimIds.join(', ')}</div>
                </div>

                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left border">Claim ID</th>
                      <th className="p-2 text-left border">Expense Date</th>
                      <th className="p-2 text-left border">Category</th>
                      <th className="p-2 text-left border">Description</th>
                      <th className="p-2 text-left border">Site</th>
                      <th className="p-2 text-right border">With Bill</th>
                      <th className="p-2 text-right border">Without Bill</th>
                      <th className="p-2 text-right border">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucher.claims.map((claim: any) => (
                      claim.expenses?.length > 0 ? (
                        <>
                          {claim.expenses.map((expense: any, index: number) => (
                            <tr key={`${claim.claimIdInternal}-${index}`}>
                              <td className="p-2 border">{claim.claimId}</td>
                              <td className="p-2 border">{formatDate(expense.claimDate || claim.date)}</td>
                              <td className="p-2 border">{expense.category}</td>
                              <td className="p-2 border">{expense.description}</td>
                              <td className="p-2 border">{claim.site}</td>
                              <td className="p-2 text-right border">₹{(expense.amountWithBill ?? 0).toFixed(2)}</td>
                              <td className="p-2 text-right border">₹{(expense.amountWithoutBill ?? 0).toFixed(2)}</td>
                              <td className="p-2 text-right border font-medium">₹{(expense.amount ?? 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr key={`${claim.claimIdInternal}-subtotal`} className="bg-muted/30 font-semibold">
                            <td colSpan={5} className="p-2 border text-right">Subtotal - {claim.claimId}</td>
                            <td className="p-2 text-right border">₹{(claim.totalWithBill ?? 0).toFixed(2)}</td>
                            <td className="p-2 text-right border">₹{(claim.totalWithoutBill ?? 0).toFixed(2)}</td>
                            <td className="p-2 text-right border">₹{(claim.amount ?? 0).toFixed(2)}</td>
                          </tr>
                        </>
                      ) : (
                        <tr key={claim.claimIdInternal}>
                          <td className="p-2 border">{claim.claimId}</td>
                          <td className="p-2 border">{formatDate(claim.date)}</td>
                          <td className="p-2 border">-</td>
                          <td className="p-2 border">-</td>
                          <td className="p-2 border">{claim.site}</td>
                          <td className="p-2 text-right border">₹{(claim.totalWithBill ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right border">₹{(claim.totalWithoutBill ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right border font-medium">₹{(claim.amount ?? 0).toFixed(2)}</td>
                        </tr>
                      )
                    ))}
                    <tr className="font-bold bg-muted/50">
                      <td colSpan={5} className="p-2 border text-right">GRAND TOTAL</td>
                      <td className="p-2 text-right border">₹{(voucher.totalWithBill ?? 0).toFixed(2)}</td>
                      <td className="p-2 text-right border">₹{(voucher.totalWithoutBill ?? 0).toFixed(2)}</td>
                      <td className="p-2 text-right border">₹{(voucher.amount ?? 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-3 p-3 bg-muted/20 rounded text-sm">
                  <strong>Amount in Words:</strong> {amountToWords(voucher.amount || 0)}
                </div>

                <div className="grid grid-cols-3 gap-8 mt-10 text-center text-sm">
                  <div>
                    <div className="border-t border-foreground pt-2 mt-8">Prepared By</div>
                    <p className="text-xs text-muted-foreground mt-1">Admin</p>
                  </div>
                  <div>
                    <div className="border-t border-foreground pt-2 mt-8">Checked By</div>
                    <p className="text-xs text-muted-foreground mt-1">Accounts</p>
                  </div>
                  <div>
                    <div className="border-t border-foreground pt-2 mt-8">Approved By</div>
                    <p className="text-xs text-muted-foreground mt-1">Super Admin</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
