'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(0, local.length - 2));
  return `${visible}${masked}@${domain}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/dashboard';
  const supabase = createClient();
  const [step, setStep] = useState<'choose' | 'email' | 'otp'>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const errorParam = searchParams.get('error');
  useEffect(() => {
    if (errorParam === 'auth_callback_error') {
      setError('Authentication failed. Please try again.');
    }
  }, [errorParam]);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setLoading(false);
    }
  }, [supabase.auth, nextPath]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setStep('otp');
        setResendCooldown(RESEND_COOLDOWN_SEC);
        otpInputRefs.current[0]?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send code');
      } finally {
        setLoading(false);
      }
    },
    [email, supabase.auth]
  );

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown, supabase.auth]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (value.length > 1) {
        const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
        const next = [...otp];
        digits.forEach((d, i) => {
          if (index + i < OTP_LENGTH) next[index + i] = d;
        });
        setOtp(next);
        const nextFocus = Math.min(index + digits.length, OTP_LENGTH - 1);
        otpInputRefs.current[nextFocus]?.focus();
        return;
      }
      const digit = value.replace(/\D/g, '');
      const next = [...otp];
      next[index] = digit;
      setOtp(next);
      if (digit && index < OTP_LENGTH - 1) {
        otpInputRefs.current[index + 1]?.focus();
      }
    },
    [otp]
  );

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handleOtpVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const code = otp.join('');
      if (code.length !== OTP_LENGTH) return;
      setLoading(true);
      setError(null);
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: 'email',
        });
        if (error) throw error;
        router.push(nextPath);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid or expired code');
        setOtp(Array(OTP_LENGTH).fill(''));
        otpInputRefs.current[0]?.focus();
      } finally {
        setLoading(false);
      }
    },
    [email, otp, supabase.auth, router, nextPath]
  );

  const handleBack = useCallback(() => {
    setStep(step === 'otp' ? 'email' : 'choose');
    setError(null);
    setOtp(Array(OTP_LENGTH).fill(''));
  }, [step]);

  return (
    <div className="w-full max-w-sm">
      <Link
        href="/"
        className="mb-8 inline-block font-display text-xl font-bold text-slate-900"
      >
        Droidstack
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {step === 'choose' && (
          <>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Sign in or create an account
            </h1>
            <p className="mt-2 text-slate-600">
              Get started with Google or email. No password required.
            </p>

            {error && (
              <div
                className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-slate-500">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('email')}
                disabled={loading}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Continue with Email
              </button>
            </div>
          </>
        )}

        {step === 'email' && (
          <>
            <button type="button" onClick={handleBack} className="-ml-2 mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-900">Enter your email</h1>
            <p className="mt-2 text-slate-600">We&apos;ll send you a one-time code to sign in.</p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="mt-6">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending code...
                  </span>
                ) : (
                  'Send code'
                )}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <button type="button" onClick={handleBack} className="-ml-2 mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-900">Check your email</h1>
            <p className="mt-2 text-slate-600">
              We sent a 6-digit code to <span className="font-medium text-slate-900">{maskEmail(email)}</span>
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleOtpVerify} className="mt-6">
              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-12 rounded-xl border border-slate-200 text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={loading || otp.join('').length !== OTP_LENGTH}
                className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying...
                  </span>
                ) : (
                  'Verify & sign in'
                )}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        By signing in, you agree to our <Link href="#" className="underline hover:text-slate-700">Terms</Link> and{' '}
        <Link href="#" className="underline hover:text-slate-700">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-sm">
        <div className="mb-8 h-7 w-32 animate-pulse rounded bg-slate-200" />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 flex flex-col gap-3">
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
