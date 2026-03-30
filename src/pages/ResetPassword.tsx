import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2, Eye, EyeOff, Check, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  const getFriendlyErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');

    if (!emailParam || !tokenParam) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setEmail(emailParam);
    setResetToken(tokenParam);
  }, [searchParams]);

  const validatePassword = (password: string): string => {
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validatePassword(newPassword);
    if (validation) {
      setValidationError(validation);
      return;
    }

    setLoading(true);
    setError('');
    setValidationError('');

    try {
      const result = await resetPassword(email, resetToken, newPassword);
      if (result.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setError(result.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Network error. Please check your connection and try again.'));
    }
    setLoading(false);
  };

  if (!email || !resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 gradient-primary animate-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }} />
        <div className="w-full max-w-md rounded-2xl shadow-2xl bg-card/95 backdrop-blur-xl overflow-hidden border border-white/20 relative z-10">
          <div className="gradient-primary p-6 sm:p-8 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary-foreground">Invalid Reset Link</h2>
          </div>
          <div className="p-6 sm:p-8 space-y-4">
            <p className="text-muted-foreground">
              The password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={() => navigate('/')}
              className="w-full gradient-primary text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 gradient-primary animate-gradient relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }} />
        <div className="w-full max-w-md rounded-2xl shadow-2xl bg-card/95 backdrop-blur-xl overflow-hidden border border-white/20 relative z-10">
          <div className="gradient-primary p-6 sm:p-8 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary-foreground">Password Reset Successful</h2>
          </div>
          <div className="p-6 sm:p-8 space-y-4">
            <p className="text-muted-foreground text-center">
              Your password has been reset successfully. Redirecting to login...
            </p>
            <Button
              onClick={() => navigate('/')}
              className="w-full gradient-primary text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-primary animate-gradient relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-card/95 backdrop-blur-xl overflow-hidden border border-white/20 relative z-10">
        <div className="gradient-primary p-6 sm:p-8 text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
            <KeyRound className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary-foreground">Reset Your Password</h2>
          <p className="text-primary-foreground/70 text-sm mt-1">Enter a new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4 sm:space-y-5">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {validationError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input 
                id="new-password" 
                type={showPassword ? "text" : "password"} 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
                placeholder="Enter new password"
                className="h-11 sm:h-10 text-base sm:text-sm pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              At least 6 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input 
                id="confirm-password" 
                type={showConfirm ? "text" : "password"} 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                placeholder="Confirm password"
                className="h-11 sm:h-10 text-base sm:text-sm pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 sm:h-10 gradient-primary text-primary-foreground text-base sm:text-sm" 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-primary hover:text-primary/80 font-medium w-full text-center py-2 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
