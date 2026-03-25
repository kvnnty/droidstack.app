'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = displayName.trim();
      if (!name) return;
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .upsert(
            { id: user.id, display_name: name, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          );
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setLoading(false);
      }
    },
    [displayName, supabase, router]
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-block font-display text-xl font-bold text-slate-900">
          Droidstack
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Welcome! Let&apos;s get started
          </h1>
          <p className="mt-2 text-slate-600">
            Tell us how you&apos;d like to be called. You can change this later.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex"
              required
              autoFocus
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
