# ALI Remote

Remote device control platform — control and automate Android emulators from a web dashboard.

## Stack

- **Monorepo** — pnpm workspaces
- **Web** — Next.js 14 (App Router), Tailwind
- **API** — NestJS
- **Shared** — @aliremote/shared (types, constants)
- **Database** — Supabase (Postgres + Auth)
- **Devices** — Android emulators (docker-android)

## Quick start

```bash
# Install
pnpm install

# Build shared package first
pnpm --filter @aliremote/shared build

# Dev (run in separate terminals)
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:3001
```

See [docs/SETUP.md](docs/SETUP.md) for full setup (Supabase, emulator, agent).

## Project structure

```
aliremote.com/
├── apps/
│   ├── web/          # Next.js frontend (dashboard)
│   └── api/          # NestJS backend
├── packages/
│   └── shared/       # Shared types & constants
├── agent/            # Android agent (ADB command executor)
├── docker/
│   └── emulator/     # docker-android config
├── docs/
│   └── SETUP.md      # Full setup instructions
└── PROJECT.md        # Project spec
```

## Auth

Authentication supports:

- **Google OAuth** — Sign in with Google (enable in [Supabase → Auth → Providers](https://supabase.com/dashboard/project/_/auth/providers))
- **Email OTP** — Passwordless sign-in via one-time code

For Email OTP, configure the Magic Link template in [Supabase → Auth → Email Templates](https://supabase.com/dashboard/project/_/auth/templates) to include `{{ .Token }}` so users receive a 6-digit code instead of a magic link.

## Env

Copy `.env.example` to `.env.local` (web) and `.env` (api):

**Web** (`apps/web/.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (safe for browser)

**API** (`apps/api/.env`):

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SECRET_KEY` — Supabase secret key (for server-side auth verification)
- `CORS_ORIGIN` — Allowed origin (default: `http://localhost:3000`)

## License

Private
