import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserBalanceSummary } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, RefreshCw, Search, Download } from 'lucide-react';
import { exportBalancesCSV } from '@/lib/export-utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserBalanceView() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try { setData(await getUserBalanceSummary(user.email, user.role)); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = data.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="font-bold flex items-center gap-2"><Scale className="h-5 w-5" /> User Balance Summary</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportBalancesCSV(filtered)} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-right">Initial Advance</th>
                <th className="p-3 text-right">Total Claims</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 text-right">Approved</th>
                <th className="p-3 text-right">Rejected</th>
                <th className="p-3 text-right">Current Balance</th>
              </tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No users found</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.email} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email} • {u.role}</div></td>
                    <td className="p-3 text-right">₹{u.initialAdvance.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{u.totalClaimAmount.toFixed(2)}</td>
                    <td className="p-3 text-right text-warning">₹{u.pendingClaims.toFixed(2)}</td>
                    <td className="p-3 text-right text-success">₹{u.approvedClaims.toFixed(2)}</td>
                    <td className="p-3 text-right text-destructive">₹{(u.rejectedClaims ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold">₹{u.currentBalance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
