import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanySettings, checkAdminExists } from '@/lib/claims-api';
import { requestPasswordReset } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LogIn, Loader2, UserPlus, KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import AdminSignupForm from '@/components/AdminSignupForm';

const showcaseSlides = [
  {
    eyebrow: 'Claim intake',
    title: 'Submit fast',
    detail: 'Drafts stay in the session and mobile uploads stay lighter.',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    eyebrow: 'Admin review',
    title: 'Review clearly',
    detail: 'Receipts, deductions, and approvals stay in one flow.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
  },
  {
    eyebrow: 'Final approval',
    title: 'Approve with confidence',
    detail: 'Managers and super admins can finish the last step quickly.',
    image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const redirectTarget = new URLSearchParams(location.search).get('redirect') || '';

  const getFriendlyErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  useEffect(() => {
    getCompanySettings().then(s => { if (s) setCompanySettings(s); }).catch(() => {});
    checkAdminExists().then(setAdminExists).catch(() => setAdminExists(true));
    const savedEmail = localStorage.getItem('claimsSavedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % showcaseSlides.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      if (!result.ok) {
        if (result.message?.toLowerCase().includes('invalid')) {
          setError('Invalid email or password. Please try again.');
        } else if (result.message?.toLowerCase().includes('deactivated')) {
          setError('Your account has been deactivated. Please contact an administrator.');
        } else {
          setError(result.message || 'Login failed. Please try again.');
        }
      } else if (rememberEmail) {
        localStorage.setItem('claimsSavedEmail', email.trim());
      } else {
        localStorage.removeItem('claimsSavedEmail');
      }

      if (redirectTarget.startsWith('/')) {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Network error. Please check your connection and try again.'));
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const result = await requestPasswordReset(forgotEmail);
      if (result.ok) {
        setForgotSuccess('Check your email for the password reset link.');
        setForgotEmail('');
      } else {
        setForgotError(result.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      setForgotError(getFriendlyErrorMessage(err, 'Network error. Please check your connection and try again.'));
    }
    setForgotLoading(false);
  };

  const logoUrl = companySettings?.logo_url || '/ipi-logo.jpg';
  const companyName = companySettings?.company_name || 'Claims Management';
  const subtitle = companySettings?.company_subtitle || 'Claims workspace';
  const activeShowcase = showcaseSlides[activeSlide];

  if (showSignup && adminExists === false) {
    return <AdminSignupForm onBack={() => setShowSignup(false)} onSuccess={() => { setShowSignup(false); setAdminExists(true); }} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%),linear-gradient(140deg,#e0f2fe_0%,#f8fafc_45%,#ecfeff_100%)]" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/60 bg-card/90 shadow-[0_30px_120px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(8,47,73,0.92)_55%,rgba(12,74,110,0.88))]" />
          <div className="absolute right-10 top-10 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute bottom-8 left-8 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />
          {showcaseSlides.map((slide, index) => (
            <div
              key={slide.title}
              className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden={index !== activeSlide}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 h-full w-full object-cover opacity-28"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.35),rgba(15,23,42,0.72)_58%,rgba(15,23,42,0.88))]" />
            </div>
          ))}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="absolute right-[-8%] top-[12%] h-[420px] w-[420px] rounded-full object-cover opacity-[0.08] blur-[1px]"
            />
          ) : null}

          <div className="relative z-10 flex w-full flex-col justify-between p-10 text-white">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
                {logoUrl ? (
                  <img src={logoUrl} alt={companyName} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                    <KeyRound className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">{subtitle}</p>
                  <p className="text-sm font-semibold text-white">{companyName}</p>
                </div>
              </div>

              <div className="max-w-md space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">{activeShowcase.eyebrow}</p>
                <h1 className="text-5xl font-semibold tracking-[-0.04em] text-white">{activeShowcase.title}</h1>
                <p className="max-w-sm text-base leading-7 text-white/72">{activeShowcase.detail}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {showcaseSlides.map((slide, index) => (
                  <div
                    key={slide.title}
                    className={`rounded-[24px] border px-4 py-4 transition-all duration-500 ${
                      index === activeSlide
                        ? 'border-white/30 bg-white/14 shadow-[0_20px_50px_-30px_rgba(255,255,255,0.45)]'
                        : 'border-white/10 bg-white/6'
                    }`}
                  >
                    <div className="mb-3 overflow-hidden rounded-2xl border border-white/10">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="h-24 w-full object-cover"
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">{slide.eyebrow}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{slide.title}</p>
                    <p className="mt-2 text-xs leading-5 text-white/70">{slide.detail}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                {showcaseSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    className={`h-1.5 rounded-full transition-all ${index === activeSlide ? 'w-10 bg-white' : 'w-4 bg-white/30'}`}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center">
          <div className="w-full p-6 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center gap-4 lg:hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={companyName} className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{subtitle}</p>
                  <h2 className="text-lg font-semibold text-foreground">{companyName}</h2>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Secure access</p>
                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
                  {showForgotPassword ? 'Reset password' : 'Sign in'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {showForgotPassword ? 'We will send a reset link to your email.' : 'Use your work account to continue.'}
                </p>
              </div>

              {!showForgotPassword ? (
                <div className="mt-8 space-y-5">
                  {error ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="name@company.com"
                        className="h-12 rounded-2xl border-border/80 bg-background/70 px-4"
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          placeholder="Enter password"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 px-4 pr-12"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember-credentials"
                          checked={rememberEmail}
                          onCheckedChange={(checked) => setRememberEmail(Boolean(checked))}
                        />
                        <Label htmlFor="remember-credentials" className="text-sm font-normal text-muted-foreground">
                          Remember email
                        </Label>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError('');
                          setForgotEmail('');
                        }}
                        className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-2xl gradient-primary text-base text-primary-foreground shadow-lg shadow-primary/20"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                      {loading ? 'Signing in...' : 'Sign in'}
                    </Button>
                  </form>

                  {adminExists === false ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full rounded-2xl"
                      onClick={() => setShowSignup(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create admin account
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-8 space-y-5">
                  {forgotError ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {forgotError}
                    </div>
                  ) : null}
                  {forgotSuccess ? (
                    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-700">
                      {forgotSuccess}
                    </div>
                  ) : null}

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        placeholder="name@company.com"
                        className="h-12 rounded-2xl border-border/80 bg-background/70 px-4"
                        autoComplete="email"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-2xl gradient-primary text-base text-primary-foreground shadow-lg shadow-primary/20"
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                      {forgotLoading ? 'Sending...' : 'Send reset link'}
                    </Button>
                  </form>

                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotEmail('');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
