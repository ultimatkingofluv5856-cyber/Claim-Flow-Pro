import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactions, getUsersDirectory } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, RefreshCw, Filter, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { exportTransactionsCSV } from '@/lib/export-utils';

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    'initial_advance': 'px-2 py-1 rounded-md text-sm font-medium',
    'manual_advance': 'px-2 py-1 rounded-md text-sm font-medium',
    'claim_submitted': 'px-2 py-1 rounded-md text-sm font-medium',
    'claim_approved_credit': 'px-2 py-1 rounded-md text-sm font-medium',
    'claim_rejected_refund': 'px-2 py-1 rounded-md text-sm font-medium',
  };
  
  const colorStyles: Record<string, React.CSSProperties> = {
    'initial_advance': { backgroundColor: '#fef3c7', color: '#92400e' },
    'manual_advance': { backgroundColor: '#fef3c7', color: '#92400e' },
    'claim_submitted': { backgroundColor: '#fef3c7', color: '#92400e' },
    'claim_approved_credit': { backgroundColor: '#dcfce7', color: '#166534' },
    'claim_rejected_refund': { backgroundColor: '#fee2e2', color: '#991b1b' },
  };
  
  return <Badge className={colors[type] || 'px-2 py-1 rounded-md text-sm font-medium'} style={colorStyles[type] || { backgroundColor: '#f3f4f6', color: '#374151' }}>{type.replace(/_/g, ' ')}</Badge>;
}

export default function TransactionsView() {
  const { user, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ userEmail: '', startDate: '', endDate: '', type: '' });
  const canViewUserColumn = isAdmin || user?.role === 'Manager';
  const visibleUsers = user?.role === 'Manager'
    ? users.filter((u) => u.email === user.email || u.manager_email === user.email)
    : users;
  const userNameByEmail = Object.fromEntries(
    users.map((u) => [String(u.email || '').trim().toLowerCase(), u.name || u.email])
  );

  const loadTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTransactions(user.email, user.role, {
        userEmail: filters.userEmail || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        type: filters.type || undefined,
      } as any);
      setTransactions(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadTransactions(); }, [user]);
  useEffect(() => {
    if (canViewUserColumn) getUsersDirectory().then(setUsers);
  }, [canViewUserColumn]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      <div className="glass-card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {canViewUserColumn && (
            <div>
              <Label className="text-xs">User</Label>
              <Select value={filters.userEmail} onValueChange={v => setFilters({ ...filters, userEmail: v === 'all' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {visibleUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={filters.type} onValueChange={v => setFilters({ ...filters, type: v })}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="initial_advance">Initial Advance</SelectItem>
                <SelectItem value="manual_advance">Manual Advance</SelectItem>
                <SelectItem value="claim_submitted">Claim Submitted</SelectItem>
                <SelectItem value="claim_rejected_refund">Claim Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={loadTransactions}><Filter className="h-4 w-4 mr-1" /> Apply</Button>
            <Button size="sm" variant="outline" onClick={() => { setFilters({ userEmail: '', startDate: '', endDate: '', type: '' }); }}>Reset</Button>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="font-bold flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> Transaction History</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportTransactionsCSV(transactions)} disabled={transactions.length === 0}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            <Button variant="outline" size="sm" onClick={loadTransactions}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50"><th className="p-3 text-left">Date</th>{canViewUserColumn && <th className="p-3 text-left">User</th>}<th className="p-3 text-left">Type</th><th className="p-3 text-left">Description</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Balance</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canViewUserColumn ? 7 : 6} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={canViewUserColumn ? 7 : 6} className="text-center p-8 text-muted-foreground">No transactions</td></tr>
              ) : transactions.map((t, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 text-xs">{formatDate(t.createdAt)}</td>
                  {canViewUserColumn && <td className="p-3">{userNameByEmail[String(t.email || '').trim().toLowerCase()] || t.email}</td>}
                  <td className="p-3">{typeBadge(t.type)}</td>
                  <td className="p-3">{t.description}</td>
                  <td className="p-3 text-right text-success font-medium">{t.credit > 0 ? `₹${t.credit.toFixed(2)}` : ''}</td>
                  <td className="p-3 text-right text-destructive font-medium">{t.debit > 0 ? `₹${t.debit.toFixed(2)}` : ''}</td>
                  <td className="p-3 text-right font-bold">₹{t.balanceAfter.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
