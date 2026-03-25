# Droidstack — Product spec & project context

> **Purpose:** This document captures project knowledge, decisions, and context for agents, collaborators, and future contributors. Last updated: March 2025.

**TL;DR:** **Droidstack** is a remote **Android** device orchestration platform — control, scale, automate devices from a web dashboard. Solo-friendly MVP trajectory; cloud Android emulators (docker-android) first. Stack: Next.js + NestJS + Supabase + Stripe + orchestrator service. **iOS — coming soon** (physical devices / automation when feasible). Target: beta testers, dev agencies (app testing), social media workflows.

---

## 1. Project Overview

### What We're Building

**Droidstack** — *Remote Android device orchestration platform. Control, scale, automate devices effortlessly.*

The product enables users to:

- **Control Android devices remotely** from a web dashboard (view screen, send taps, swipes, type)
- **Automate tasks** (account setup, posting, workflows) across multiple devices
- **Schedule operations** (run tasks on a schedule)
- **Manage teams** (multi-user, roles, permissions)
- **Monitor activity** (analytics, reports, device status)

**iOS** is **not** in v1; it is planned for a later phase (“coming soon” from a product positioning standpoint).

### Target Users (First Customers)

- **Beta testers** — Early adopters for feedback
- **Dev agencies** — Large-scale automated app testing (virtual devices)
- **Social media agencies** — Organic growth (Instagram, TikTok, Reels, etc.)

### Market context: ALI Remote & peers

[ALI Remote](https://aliremote.com) and similar products often use **physical iPhones** in a device farm. Useful reference points:

- **Physical devices** — Many commercial farms are iOS-heavy; iOS does not run in cloud VMs like Android emulators
- **Pricing elsewhere:** Tens of dollars per managed device / month is common in the category
- **Features in mature products:** Remote control, automations, scheduling, multi-user, analytics

**Droidstack** is **not** a 1:1 clone of any single competitor. It is an **MVP-first** product: Android + emulators + orchestration API, with room to grow into physical devices and iOS.

---

## 2. Strategic Decisions

### Device Strategy

| Phase | Approach | Rationale |
|-------|----------|-----------|
| **Phase 1 (MVP)** | Cloud Android emulators | No hardware cost, faster to ship, validate product |
| **Phase 2** | Physical Android devices | When emulator detection limits production use |
| **Phase 3** | **iOS (coming soon)** — physical iPhones | When Apple approval, hardware, and budget allow |

### Why Android First?

- **Easier:** Scrcpy, ADB, docker-android — mature tooling
- **Cheaper:** Emulators in cloud; physical Androids cheaper than iPhones
- **No approval:** No App Store review for dev tools
- **iOS later:** WebDriverAgent + physical iPhones when ready

### Why Emulators First?

- No upfront hardware investment
- Scale by spinning up containers
- Good for development, testing, and early customers
- **Limitation:** Social apps (Instagram, TikTok) may detect emulators — physical devices needed for some production use cases

---

## 3. Tech Stack

### Confirmed Choices

| Layer | Technology | Notes |
|-------|-------------|-------|
| **Frontend** | Next.js 14+ (App Router) | TypeScript, Tailwind, shadcn/ui |
| **API** | NestJS | TypeScript, modular structure |
| **Orchestrator** | NestJS (`apps/orchestrator`) | Spawns/manages emulator containers, exposes ports (noVNC, ADB) |
| **Database** | Supabase (Postgres Auth) | See [SETUP.md](./SETUP.md) for migrations |
| **Auth** | Supabase Auth | Part of Supabase (Google, Email OTP) |
| **Billing** | Stripe | Subscriptions / per-device pricing (see API billing module) |
| **Cache/Queue** | Redis (e.g. Upstash) | BullMQ for jobs, sessions |
| **Devices** | Android emulators (docker-android) | e.g. `budtmo/docker-android` |
| **Hosting** | Linux VPS with KVM for emulators | Budget tier for API + web; KVM host for orchestrator (see section 10) |

### Supabase Free Tier Limits (Be Aware)

- 500 MB database
- 1 GB file storage
- 50,000 MAU (auth)
- 2 GB bandwidth/month
- 2 projects

**Plan:** Use free tier for early MVP; migrate or upgrade when limits hit.

### Redis (Defer Until Automation Heats Up)

- **Needed for:** BullMQ (automation, scheduling), session storage
- **Early MVP:** Can skip if automation is minimal — add when scheduling/heavy jobs ship
- **Option when needed:** Upstash Redis (free tier) or Redis on VPS

### Hosting Considerations

- **VPS:** Full control, cheaper at scale — need KVM for emulators (GCP, Hetzner dedicated)
- **Managed:** Easier ops, higher cost — may not support emulator containers
- **Hybrid:** API on managed, emulator layer on VPS with KVM

---

## 4. Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js                                              │
│  Dashboard, device list, live view (noVNC embed), auth, billing   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  API — NestJS                                                    │
│  Auth, device CRUD, billing (Stripe), orchestrator integration    │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Supabase       │  │  Stripe          │  │  Redis (defer)   │
│  • Postgres     │  │  • Checkout       │  │  • BullMQ        │
│  • Auth         │  │  • Webhooks       │  │  • Sessions      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR — VPS with KVM (GCP / Hetzner dedicated)           │
│                                                                  │
│  Docker containers: budtmo/docker-android                        │
│  • noVNC (browser view)                                          │
│  • ADB (automation)                                               │
│  • Service starts/stops containers, returns ports / container IDs │
└─────────────────────────────────────────────────────────────────┘
```

### Cloud Emulator Requirements

- **KVM** (`/dev/kvm`) — hardware virtualization required
- **Providers that support it:** GCP Compute Engine, Hetzner dedicated, AWS Bare Metal
- **Providers that don't:** Standard AWS EC2, most cheap VPS

---

## 5. Features

### MVP Scope (Aggressive — Solo)

*Must-have for launch. Everything else is post-MVP.*

| Feature | Priority | Notes |
|---------|----------|-------|
| User auth (signup, login) | P0 | Supabase Auth |
| **Billing (Stripe)** | P0 | Subscription / per-device model — aligns with current backend |
| Device list & status | P0 | At least 1 emulator, online/offline |
| Live device view | P0 | noVNC embed — see device screen |
| Remote control (tap, swipe, type) | P0 | Via noVNC input or ADB |
| Landing page | P0 | Signup CTA, waitlist/beta |
| Basic automation | P1 | *Defer if needed* — run script on device |
| Scheduling | P2 | *Defer* — post-MVP |
| Multi-user / teams | P2 | *Defer* — post-MVP |

### Post-MVP (After Launch)

- Deeper automation (BullMQ + ADB)
- Simple scheduling
- Multi-user, roles
- More devices (scale emulators)
- Polish billing (usage, tiers)

### Future (When Capital / Feasible)

- Physical Android device support (USB, Scrcpy)
- **iOS support** (WebDriverAgent, physical devices) — “coming soon” on the roadmap
- Advanced automations (workflow builder)
- Analytics dashboard
- Social platform integrations (Instagram, TikTok APIs where allowed)

---

## 6. Timeline

- **Total (initial burst):** ~1 month (solo) — historical planning baseline
- **Week 1:** Project setup (Next.js + NestJS), Supabase auth, landing page, basic dashboard shell
- **Week 2:** Emulator layer (1× docker-android on KVM host), device list API, status
- **Week 3:** Live view (noVNC embed), remote control (tap/swipe/type)
- **Week 4:** Polish, beta signup flow, deploy, testing

*Automation, scheduling, multi-user → post-MVP. Billing/Stripe integrated as product matures.*

---

## 7. Key Technical Details

### Android Emulator Stack

- **Image:** `budtmo/docker-android:emulator_13.0` (or 12, 14)
- **Ports:** noVNC + ADB (dynamic range in orchestrator — see [SETUP.md](./SETUP.md))
- **Control:** ADB connect, Appium (optional)
- **View:** noVNC in browser, or scrcpy-web (e.g. shmayro/dockerify-android)

### Automation Options

- **ADB:** Direct commands (install, shell, input)
- **Appium:** UI automation (find elements, tap, type)
- **Maestro:** YAML flows, newer alternative

### Video Streaming

- **MVP:** noVNC (VNC over WebSocket) — simple, works
- **Future:** WebRTC for lower latency

---

## 8. Constraints & Risks

| Constraint | Mitigation |
|------------|------------|
| **Aggressive solo timeline** | Cut scope: auth + billing path + 1 device + live view + control. Defer heavy automation, scheduling, org features. |
| **Budget (cheap VPS)** | API + frontend on $5–10 VPS. Emulators need KVM → GCP free credit or nested-VPS (~$15–25). |
| Supabase 500 MB limit | Fine for MVP; migrate if needed later |
| Emulator detection by social apps | Accept for MVP; dev agencies (app testing) less affected |
| KVM required for emulators | GCP $300 credit, or nested-VPS; avoid standard cheap VPS |
| **No iOS in v1** | Android + emulators first; **iOS coming soon** in product messaging |

---

## 9. Competitors & References

- **ALI Remote** — aliremote.com (category reference; physical iPhones, managed farms)
- **The Phone Farm** — thephonefarm.com (physical iPhones, higher tiers)
- **Firebase Test Lab** — Managed emulators, ~$1/hr
- **AWS Device Farm** — Physical + virtual devices
- **budtmo/docker-android** — GitHub, widely used self-hosted emulators

---

## 10. Project Context (Decided)

| Item | Decision |
|------|----------|
| **Product name** | **Droidstack** |
| **Team** | Solo developer (scalable) |
| **Budget** | Minimal — small Linux VPS (~$5–15/mo) + KVM host for emulators when needed |
| **MVP launch** | Fast iteration; scope per section 5 |
| **Codebase** | Monorepo (`apps/web`, `apps/api`, `apps/orchestrator`, `packages/shared`, …) |
| **First customers** | Beta testers, dev agencies (app testing), social media agencies |
| **Billing** | **Stripe** — subscriptions / webhooks (see [SETUP.md](./SETUP.md)) |
| **Physical devices** | When capital or customer demand justifies |
| **iOS** | **Coming soon** — not in initial Android-emulator MVP |

### Budget Reality Check

**Emulators require KVM** (hardware virtualization). Most cheap VPS ($5–10/mo) do **not** support nested virtualization.

| Hosting option | KVM? | Cost | Fit for MVP? |
|----------------|------|------|--------------|
| DigitalOcean / Vultr / Hetzner Cloud | ❌ No | $5–10/mo | API + frontend only |
| GCP Compute Engine | ✅ Yes | ~$50+/mo | Emulators — use $300 free credit |
| Hetzner dedicated | ✅ Yes | €40+/mo | Emulators |
| Nested-VPS providers (Cloudzy, SSDNodes) | ✅ Yes | ~$15–25/mo | Emulators — check specs |

**Recommendation:** Run API + frontend on cheap VPS. For emulators: use **GCP $300 free credit** (new account) or a nested-VPS trial. Physical devices when capital allows.

---

## 11. File Structure

```
droidstack/
├── docs/
│   ├── PROJECT.md      # This file
│   └── SETUP.md        # Setup & environment
├── package.json        # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── web/            # Next.js frontend
│   ├── api/            # NestJS backend
│   └── orchestrator/   # Emulator orchestration service
├── packages/
│   └── shared/         # @droidstack/shared — types, constants
├── agent/              # Android agent (ADB executor)
├── docker/
│   └── emulator/       # docker-android compose
└── supabase/           # Migrations & SQL
```

---

## 12. Quick Reference

| Term | Meaning |
|------|---------|
| **ADB** | Android Debug Bridge — CLI to control Android devices |
| **noVNC** | VNC client in browser (WebSocket) |
| **KVM** | Kernel-based Virtual Machine — hardware virtualization for Linux |
| **Scrcpy** | Screen mirror + control for Android (USB or WiFi) |
| **WDA** | WebDriverAgent — Apple's tool for iOS automation |
| **BullMQ** | Redis-based job queue for Node.js |

---

*Document maintained for project continuity. Update as decisions change.*
