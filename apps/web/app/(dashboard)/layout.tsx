export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (!displayName?.trim()) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard" className="font-display text-xl font-bold text-slate-900">
            ALI Remote
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{displayName}</span>
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
