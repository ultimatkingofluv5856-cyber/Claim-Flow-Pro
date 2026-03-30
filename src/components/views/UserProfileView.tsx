import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentBalance, getClaimsHistory, getTransactions } from '@/lib/claims-api';
import { supabase } from '@/integrations/supabase/client';
import { hashPassword, matchesStoredPassword, validatePasswordStrength } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock, FileText, Loader2, Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import ImageUpload from '@/components/ImageUpload';
import RupeeIcon from '@/components/icons/RupeeIcon';

export default function UserProfileView() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bal, claims, txs] = await Promise.all([
          getCurrentBalance(user.email),
          getClaimsHistory(user.email, user.role),
          getTransactions(user.email, user.role),
        ]);
        setBalance(bal);
        setClaimCount(claims.length);
        setTxCount(txs.length);
      } catch (e) { 
        console.error('Error loading profile:', e);
        setError((e as any).message || 'Failed to load profile');
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error('Enter current password'); return; }
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.ok) { toast.error(passwordValidation.message || 'Password does not meet security requirements'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setChanging(true);
    try {
      const { data: userData } = await supabase.from('users').select('password_hash').eq('email', user!.email).single();
      if (!userData || !matchesStoredPassword((userData as any).password_hash, currentPassword)) {
        toast.error('Current password is incorrect');
        setChanging(false);
        return;
      }

      // Update password
      const newHash = hashPassword(newPassword);
      const { error } = await supabase.from('users').update({ password_hash: newHash }).eq('email', user!.email);
      if (error) throw error;

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to change password');
    }
    setChanging(false);
  };

  if (!user) return null;

  return (
    <div className="fade-in space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          Error: {error}
        </div>
      )}
      {/* Profile Info */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> My Profile
        </h2>
        <div className="flex flex-col md:flex-row gap-6">
          <ImageUpload
            bucket="user-avatars"
            currentUrl={user.profile_picture_url || null}
            onUploaded={async (url) => {
              try {
                await supabase.from('users').update({ profile_picture_url: url || null }).eq('email', user.email);
                toast.success('Profile picture updated');
                // Reload to refresh auth context
                window.location.reload();
              } catch (e: any) {
                toast.error('Failed to update picture');
              }
            }}
            folder={user.email}
            variant="avatar"
            fallbackText={user.name?.charAt(0)?.toUpperCase() || '?'}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="font-medium text-foreground">{user.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="font-medium text-foreground">{user.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Badge variant="secondary" className="mt-1">{user.role}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <RupeeIcon className="h-4 w-4" /> Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {loading ? '...' : `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" /> Total Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{loading ? '...' : claimCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <RupeeIcon className="h-4 w-4" /> Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{loading ? '...' : txCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Change Password */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> Change Password
        </h2>
        <div className="max-w-md space-y-4">
          <div>
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
          </div>
          <div>
            <Label>New Password</Label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showPasswords ? 'Hide' : 'Show'} Passwords
            </Button>
          </div>
          <Button onClick={handleChangePassword} disabled={changing} className="gradient-primary text-primary-foreground">
            {changing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
