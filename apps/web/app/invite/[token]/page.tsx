'use client';

import { api } from '@/lib/api';
import { setStoredOrganizationId } from '@/lib/org-storage';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.access_token) {
        setStatus('ready');
        return;
      }

      try {
        const { organizationId } = await api.organizations.acceptInvitation(token);
        if (cancelled) return;
        setStoredOrganizationId(organizationId);
        setStatus('done');
        router.replace('/dashboard/team');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Could not accept invitation');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-xl font-bold text-slate-900">Team invitation</h1>
        {status === 'loading' && (
          <p className="mt-4 text-sm text-slate-600">Checking your session…</p>
        )}
        {status === 'ready' && (
          <>
            <p className="mt-4 text-sm text-slate-600">
              Sign in with the email this invite was sent to, then you will be added to the team.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in
            </Link>
          </>
        )}
        {status === 'done' && (
          <p className="mt-4 text-sm text-emerald-700">You have joined the team. Redirecting…</p>
        )}
        {status === 'error' && (
          <>
            <p className="mt-4 text-sm text-red-700">{message ?? 'Something went wrong.'}</p>
            <Link href="/dashboard" className="mt-4 inline-block text-sm text-slate-900 underline">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
