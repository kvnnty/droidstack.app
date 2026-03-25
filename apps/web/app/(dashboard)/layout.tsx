export const dynamic = 'force-dynamic';

import { DashboardAppShell } from '@/components/dashboard-app-shell';
import { createClient } from '@/lib/supabase/server';
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
      <DashboardAppShell displayName={displayName}>{children}</DashboardAppShell>
    </div>
  );
}
