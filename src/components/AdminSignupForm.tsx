import { useState } from 'react';
import { createFirstAdmin } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface AdminSignupFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AdminSignupForm({ onBack, onSuccess }: AdminSignupFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await createFirstAdmin({ name: name.trim(), email: email.trim(), password });
      if (result.ok) {
        toast.success('Admin account created successfully! Please sign in.');
        onSuccess();
      } else {
        setError(result.message || 'Failed to create admin account');
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-primary animate-gradient relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-card/95 backdrop-blur-xl overflow-hidden border border-white/20 relative z-10">
        <div className="gradient-primary p-6 sm:p-8 text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
            <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary-foreground">Create Admin Account</h2>
          <p className="text-primary-foreground/70 text-sm mt-1">Set up your first administrator</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="Enter your full name"
              className="h-11 sm:h-10 text-base sm:text-sm"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input 
              id="signup-email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="Enter your email"
              className="h-11 sm:h-10 text-base sm:text-sm"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input 
              id="signup-password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder="Create a password (min 6 chars)"
              className="h-11 sm:h-10 text-base sm:text-sm"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input 
              id="confirm-password" 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
              placeholder="Confirm your password"
              className="h-11 sm:h-10 text-base sm:text-sm"
              autoComplete="new-password"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-11 sm:h-10 gradient-primary text-primary-foreground text-base sm:text-sm" 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? 'Creating Account...' : 'Create Admin Account'}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full h-11 sm:h-10 text-base sm:text-sm"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </form>
      </div>
    </div>
  );
}
