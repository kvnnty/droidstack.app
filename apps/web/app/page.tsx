import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">
            ALI Remote
          </Link>
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.12),transparent)]" />
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Remote Device Control Platform
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
            Control your Android devices
            <br />
            <span className="text-slate-600">from anywhere.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Web-based dashboard. 24/7 access. Seamless automation. Run emulators,
            run tests, and scale your workflows without the wait.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/30"
            >
              Launch Dashboard
            </Link>
            <Link
              href="#features"
              className="rounded-full border border-slate-300 px-8 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-slate-200 bg-slate-50/50 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Secure
            </span>
            Encrypted connections
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              Web-based
            </span>
            No local install
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Scalable
            </span>
            Docker-ready
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Features
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Don&apos;t manage devices like it&apos;s 1995
          </h2>

          <div className="mt-16 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Available 24/7"
              description="On-demand access, any time. Jump into your emulators from the web—no VPN, no complex setup."
              icon="⏱"
            />
            <FeatureCard
              title="Web Dashboard"
              description="View status, start sessions, and monitor automation from a single clean interface."
              icon="📊"
            />
            <FeatureCard
              title="Automation at Scale"
              description="Run tests, scripts, and workflows across multiple devices. Docker-native for easy deployment."
              icon="⚡"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-slate-200 bg-slate-50/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Testimonials
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What others say about ALI Remote
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <TestimonialCard
              quote="Finally, a way to run our Android tests without spinning up local emulators. Game changer."
              author="Alex Chen"
              role="QA Lead @ DevFlow"
            />
            <TestimonialCard
              quote="We scaled from 2 to 20 emulators in a week. The web dashboard is exactly what we needed."
              author="Sarah Kim"
              role="CTO @ MobileScale"
            />
            <TestimonialCard
              quote="Docker integration made deployment trivial. Our CI pipeline now runs device tests in the cloud."
              author="Marcus Webb"
              role="DevOps @ StackLabs"
            />
          </div>
        </div>
      </section>

      {/* CTA block */}
      <section className="border-t border-slate-200 bg-slate-900 py-24 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Scale your device workflows.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Control emulators from anywhere. Automate tests. Ship faster.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <Link href="/" className="font-display text-lg font-bold">
            ALI Remote
          </Link>
          <div className="flex gap-8 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="#" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="#" className="hover:text-slate-900">
              Terms
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} ALI Remote. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mt-2 text-slate-600">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-slate-700">&ldquo;{quote}&rdquo;</p>
      <div className="mt-4">
        <p className="font-semibold text-slate-900">{author}</p>
        <p className="text-sm text-slate-500">{role}</p>
      </div>
    </div>
  );
}
