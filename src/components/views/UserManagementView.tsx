import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, createUser, updateUser, deleteUser, addUserAdvance } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Users, RefreshCw, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import RupeeIcon from '@/components/icons/RupeeIcon';

export default function UserManagementView() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [advanceModal, setAdvanceModal] = useState<{ email: string; name: string } | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'User', advance: '0', manager: '' });
  const canAssignManager = form.role === 'User';

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUsers();
      setUsers(data);
      setAllUsers(data);
    } catch (e) { 
      console.error('Error loading users:', e);
      setError((e as any).message || 'Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await createUser({ ...form, advance: parseFloat(form.advance) || 0 });
      toast.success('User created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'User', advance: '0', manager: '' });
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
    setProcessing(false);
  };

  const handleUpdate = async () => {
    setProcessing(true);
    try {
      await updateUser({
        originalEmail: editUser.originalEmail,
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        password: editUser.password || undefined,
        manager: editUser.manager,
      });
      toast.success('User updated');
      setEditUser(null);
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
    setProcessing(false);
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Delete user ${email}?`)) return;
    try {
      await deleteUser(email);
      toast.success('User deleted');
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleActive = async (email: string, currentActive: boolean) => {
    try {
      await supabase.from('users').update({ active: !currentActive } as any).eq('email', email);
      toast.success(`User ${!currentActive ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddAdvance = async () => {
    if (!advanceModal || !advanceAmount) return;
    setProcessing(true);
    try {
      await addUserAdvance(advanceModal.email, parseFloat(advanceAmount), user!.email);
      toast.success(`₹${advanceAmount} added to ${advanceModal.name}`);
      setAdvanceModal(null);
      setAdvanceAmount('');
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
    setProcessing(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          Error: {error}
        </div>
      )}
      <div className="glass-card">
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border">
          <h2 className="font-bold flex items-center gap-2"><Users className="h-5 w-5" /> User Management</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadUsers} className="flex-1 sm:flex-none h-10 sm:h-9">
              <RefreshCw className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="flex-1 sm:flex-none h-10 sm:h-9">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Add User</span>
            </Button>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="block md:hidden p-3 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))
          ) : users.map(u => (
            <div key={u.email} className="border border-border rounded-lg p-4 space-y-3 bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{u.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge className={u.active !== false ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'} variant="outline">
                  {u.active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{u.role}</Badge>
                {u.manager && <span className="text-muted-foreground">Manager: {u.manager}</span>}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-lg font-bold text-primary">₹{u.balance.toFixed(2)}</p>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={u.active !== false}
                    onCheckedChange={() => handleToggleActive(u.email, u.active !== false)}
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditUser({ ...u, originalEmail: u.email, password: '' })}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-success" onClick={() => setAdvanceModal({ email: u.email, name: u.name })}>
                    <RupeeIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDelete(u.email)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Manager</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Balance</th><th className="p-3 text-center">Actions</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : users.map(u => (
                <tr key={u.email} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-sm">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3 text-sm text-muted-foreground">{u.manager || '—'}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={u.active !== false}
                        onCheckedChange={() => handleToggleActive(u.email, u.active !== false)}
                      />
                      <Badge className={u.active !== false ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'} variant="outline">
                        {u.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold">₹{u.balance.toFixed(2)}</td>
                  <td className="p-3 text-center space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditUser({ ...u, originalEmail: u.email, password: '' })}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-success" onClick={() => setAdvanceModal({ email: u.email, name: u.name })}><RupeeIcon className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(u.email)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input className="h-11 sm:h-10" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Enter full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input className="h-11 sm:h-10" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="Enter email" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input className="h-11 sm:h-10" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Create password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm({ ...form, role: v, manager: v === 'User' ? form.manager : '' })}
                >
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Advance (₹)</Label>
                <Input className="h-11 sm:h-10" type="number" min="0" value={form.advance} onChange={e => setForm({ ...form, advance: e.target.value })} placeholder="0" />
              </div>
            </div>
            {canAssignManager && (
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={form.manager} onValueChange={v => setForm({ ...form, manager: v })}>
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Select Manager (Optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {allUsers.filter(u => u.role === 'Manager' || u.role === 'Admin' || u.role === 'Super Admin').map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="w-full sm:w-auto h-11 sm:h-10">Cancel</Button>
              <Button type="submit" disabled={processing} className="w-full sm:w-auto h-11 sm:h-10">
                {processing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />} Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input className="h-11 sm:h-10" value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} placeholder="Enter name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input className="h-11 sm:h-10" value={editUser.email} onChange={e => setEditUser({ ...editUser, email: e.target.value })} placeholder="Enter email" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editUser.role}
                  onValueChange={v => setEditUser({ ...editUser, role: v, manager: v === 'User' ? editUser.manager : '' })}
                >
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Password (leave blank to keep current)</Label>
                <Input className="h-11 sm:h-10" type="password" value={editUser.password} onChange={e => setEditUser({ ...editUser, password: e.target.value })} placeholder="Enter new password" />
              </div>
              {editUser.role === 'User' && (
                <div className="space-y-2">
                  <Label>Manager</Label>
                  <Select value={editUser.manager || 'none'} onValueChange={v => setEditUser({ ...editUser, manager: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {allUsers.filter(u => u.email !== editUser.originalEmail).map(u => (
                        <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setEditUser(null)} className="w-full sm:w-auto h-11 sm:h-10">Cancel</Button>
                <Button onClick={handleUpdate} disabled={processing} className="w-full sm:w-auto h-11 sm:h-10">Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Advance Modal */}
      <Dialog open={!!advanceModal} onOpenChange={() => setAdvanceModal(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Add Advance - {advanceModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input className="h-11 sm:h-10" type="number" min="1" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="Enter amount" />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAdvanceModal(null)} className="w-full sm:w-auto h-11 sm:h-10">Cancel</Button>
            <Button onClick={handleAddAdvance} disabled={processing} className="w-full sm:w-auto h-11 sm:h-10">Add Advance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
