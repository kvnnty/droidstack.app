# ALI Remote — Setup Instructions

Production-quality MVP for virtual Android devices in the cloud.

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
4. For **Email OTP**: Edit Auth → Email Templates → Magic Link, add `{{ .Token }}`

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

## 4. Install & Run

```bash
pnpm install
pnpm --filter @aliremote/shared build

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

- **Docker** with access to `/var/run/docker.sock`
- **KVM** (`/dev/kvm`) — hardware virtualization

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

## 9. Production Checklist

- [ ] HTTPS for API and dashboard
- [ ] Supabase redirect URLs configured
- [ ] Stripe webhook URL (production)
- [ ] Orchestrator on KVM host
- [ ] `NEXT_PUBLIC_ORCHESTRATOR_HOST` for noVNC URLs
