# Droidstack — Setup & documentation

Remote Android device orchestration platform. Control, scale, automate devices effortlessly.

## Stack

- **Monorepo** — pnpm workspaces
- **Web** — Next.js 14 (App Router), Tailwind
- **API** — NestJS
- **Orchestrator** — Docker-based Android emulators
- **Shared** — `@droidstack/shared` (types, constants)
- **Database** — Supabase (Postgres + Auth)
- **Billing** — Stripe
- **Devices** — Android emulators (docker-android)

## Project structure

```
droidstack/
├── apps/
│   ├── web/              # Next.js frontend (dashboard)
│   ├── api/              # NestJS backend
│   └── orchestrator/     # Device orchestrator
├── packages/
│   └── shared/           # Shared types & constants
├── agent/                # Android agent (ADB command executor)
├── docker/
│   └── emulator/         # docker-android config
├── docs/
│   └── SETUP.md          # This file
└── PROJECT.md            # Project spec
```

## Quick start

```bash
pnpm install
pnpm --filter @droidstack/shared build

# Dev (separate terminals — see full setup for orchestrator & env)
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:3001
```

## Architecture

```
User → Dashboard (Next.js) → Backend API (NestJS) → Device Orchestrator → Docker (Android Emulator)
                                    ↓
                              Supabase (Postgres + Auth)
                                    ↓
                              Stripe (Billing)
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for orchestrator + emulators)
- Supabase account
- Stripe account

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in **SQL Editor** (in order):
   - `supabase/migrations/20250306000000_profiles.sql`
   - `supabase/migrations/20250306100000_devices_schema.sql`
   - `supabase/migrations/20250306200000_devices_orchestrator_billing.sql`
3. Enable **Google** in Auth → Providers
4. **Email OTP (6-digit code)**: The app uses OTP, not magic links. In [Auth → Email Templates](https://supabase.com/dashboard/project/_/auth/templates), update **both** templates to show the code instead of a link:
   - **Confirm signup** — used for new users
   - **Magic Link** — used for existing users

   Replace the default link-based content with:
   ```html
   <h2>Your sign-in code</h2>
   <p>Enter this 6-digit code in the app:</p>
   <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">{{ .Token }}</p>
   <p>This code expires in 5 minutes.</p>
   ```
   The `{{ .Token }}` variable contains the 6-digit OTP. Do not use `{{ .ConfirmationURL }}` — that sends a magic link.

**Auth options**

- **Google OAuth** — enable in [Supabase → Auth → Providers](https://supabase.com/dashboard/project/_/auth/providers)
- **Email OTP** — templates as above

## 2. Stripe Setup

1. Create a product: **Virtual Android Device** — $10/month
2. Copy the **Price ID** (e.g. `price_xxx`)
3. Create a webhook: `https://your-api.com/billing/webhook`
   - Events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the **Webhook signing secret** (`whsec_xxx`)

## 3. Environment Variables

**Dashboard** (`apps/web/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend API** (`apps/api/.env`):

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
CORS_ORIGIN=http://localhost:3000
PORT=3001

ORCHESTRATOR_URL=http://localhost:3002

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_PER_DEVICE=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Orchestrator** (`apps/orchestrator/.env`):

```env
PORT=3002
EMULATOR_IMAGE=budtmo/docker-android:emulator_13.0
PORT_RANGE_START=6000
PORT_RANGE_END=7000
```

Copy `.env.example` to `.env.local` (web) and `.env` (api) where applicable.

## 4. Install & Run

```bash
pnpm install
pnpm --filter @droidstack/shared build

# Terminal 1: Backend API
pnpm dev:api

# Terminal 2: Orchestrator (requires Docker + KVM)
pnpm dev:orchestrator

# Terminal 3: Dashboard
pnpm dev:web
```

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **Orchestrator**: http://localhost:3002

## 5. Orchestrator Requirements

The orchestrator launches Android emulator containers. It requires:

- **Docker** with access to the Docker socket (Linux: `/var/run/docker.sock`, Windows: `//./pipe/docker_engine`)
- **KVM** (`/dev/kvm`) — hardware virtualization (Linux only; emulators may not run in Docker on Windows)

**First device creation**: The orchestrator auto-pulls `budtmo/docker-android:emulator_13.0` (~2GB) if missing. This can take several minutes.

Supported hosts: GCP Compute Engine, Hetzner dedicated, AWS Bare Metal, or nested-VPS.

## 6. Device Creation Flow

1. User signs up (Google or Email OTP)
2. User subscribes via Stripe (Billing page)
3. User clicks "Create device" → backend checks subscription
4. Backend creates device record (status: `starting`)
5. Backend calls orchestrator → orchestrator starts Docker container
6. Orchestrator returns `containerId`, `adbPort`, `novncPort`
7. Backend updates device (status: `running`)
8. User views device screen via noVNC

## 7. Remote Viewing

Each device gets dynamic `adbPort` and `novncPort`. The dashboard embeds:

```
http://<orchestrator-host>:<novncPort>/vnc.html
```

For local dev, use `localhost`. For production, set `NEXT_PUBLIC_ORCHESTRATOR_HOST`.

## 8. Stripe Webhooks (Production)

Use Stripe CLI for local testing:

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

Use the printed webhook secret in `STRIPE_WEBHOOK_SECRET`.

## 9. Troubleshooting

**"Could not find the table 'public.devices' in the schema cache"**

The database migrations haven't been run. Run the combined migration:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Copy the contents of `supabase/run_all_migrations.sql`
3. Paste and click **Run**

Or run the individual migrations in order (see [Database (Supabase)](#1-database-supabase)).

## 10. Production Checklist

- [ ] HTTPS for API and dashboard
- [ ] Supabase redirect URLs configured
- [ ] Stripe webhook URL (production)
- [ ] Orchestrator on KVM host
- [ ] `NEXT_PUBLIC_ORCHESTRATOR_HOST` for noVNC URLs

## License

Private
