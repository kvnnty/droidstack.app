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

## Project structure

```
aliremote.com/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   └── shared/       # Shared types & constants
├── docker/
│   └── emulator/     # docker-android config
├── docs/
└── PROJECT.md        # Full project spec
```

## Env

Create `.env.local` (web) and `.env` (api) with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (api only)

## License

Private
