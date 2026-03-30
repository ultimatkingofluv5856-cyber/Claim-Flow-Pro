import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Shield } from 'lucide-react';

export default function AuditLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } catch (e) { 
      console.error('Error loading audit logs:', e);
      setError((e as any).message || 'Failed to load audit logs');
    }
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l =>
    !search || l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.performed_by.toLowerCase().includes(search.toLowerCase()) ||
    (l.target_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const actionColor = (action: string) => {
    if (action.includes('approved')) return 'text-green-600 bg-green-50';
    if (action.includes('rejected')) return 'text-red-600 bg-red-50';
    if (action.includes('submitted')) return 'text-blue-600 bg-blue-50';
    if (action.includes('created') || action.includes('added')) return 'text-purple-600 bg-purple-50';
    if (action.includes('deleted')) return 'text-red-600 bg-red-50';
    return 'text-muted-foreground bg-muted';
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse p-4">
      <div className="h-12 rounded-2xl bg-muted" />
      {[1,2,3,4].map(i => <div key={i} className="h-10 rounded bg-muted" />)}
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          Error: {error}
        </div>
      )}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Audit Trail</h2>
          <div className="flex gap-2">
            <Input placeholder="Search logs..." className="w-60" value={search} onChange={e => setSearch(e.target.value)} />
            <Button variant="outline" size="sm" onClick={loadLogs}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Performed By</th>
                <th className="p-3 text-left">Target</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit logs found</td></tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-xs whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{log.performed_by}</td>
                    <td className="p-3 text-xs">
                      <span className="text-muted-foreground">{log.target_type}</span>
                      {log.target_id && <span className="ml-1 font-mono text-foreground">{log.target_id}</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.details || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
