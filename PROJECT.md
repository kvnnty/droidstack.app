# Project: ALI Remote Clone — Remote Device Control Platform

> **Purpose:** This document captures all project knowledge, decisions, and context for agents, collaborators, and future contributors. Last updated: Feb 2025.

**TL;DR:** Solo dev, 1-month MVP, minimal budget. Android emulators in cloud (docker-android). Next.js + NestJS + Supabase. Target: beta testers, dev agencies (app testing), social media agencies. No billing in v1. Physical devices when capital allows.

---

## 1. Project Overview

### What We're Building

A **remote device control and automation platform** inspired by [ALI Remote](https://aliremote.com). The product enables users to:

- **Control Android devices remotely** from a web dashboard (view screen, send taps, swipes, type)
- **Automate tasks** (account setup, posting, workflows) across multiple devices
- **Schedule operations** (run tasks on a schedule)
- **Manage teams** (multi-user, roles, permissions)
- **Monitor activity** (analytics, reports, device status)

### Target Users (First Customers)

- **Beta testers** — Early adopters for feedback
- **Dev agencies** — Large-scale automated app testing (need virtual devices)
- **Social media agencies** — Organic growth (Instagram, TikTok, Reels, etc.)

### Inspiration: ALI Remote

ALI Remote is a commercial SaaS that uses **physical iPhones** in a device farm. Key facts:

- **Physical devices only** — No emulators; iOS cannot run in cloud VMs
- **Pricing:** $49–79 per iPhone/month (Standard, Premium, Ultimate tiers)
- **Features:** 100% remote control, automations, scheduling, multi-user, analytics
- **Full clone timeline:** 18–36 months with 4–6 engineers

We are **not** building a 1:1 clone. We are building an **MVP** with a different strategy.

---

## 2. Strategic Decisions

### Device Strategy

| Phase | Approach | Rationale |
|-------|----------|-----------|
| **Phase 1 (MVP)** | Cloud Android emulators | No hardware cost, faster to ship, validate product |
| **Phase 2** | Physical Android devices | When emulator detection limits production use |
| **Phase 3** | Physical iPhones | When we have Apple approval, hardware, and budget |

### Why Android First?

- **Easier:** Scrcpy, ADB, docker-android — mature tooling
- **Cheaper:** Emulators in cloud; physical Androids cheaper than iPhones
- **No approval:** No App Store review for dev tools
- **iOS later:** WebDriverAgent + physical iPhones when ready

### Why Emulators First?

- No upfront hardware investment
- Scale by spinning up containers
- Good for development, testing, and early customers
- **Limitation:** Social apps (Instagram, TikTok) may detect emulators — physical devices needed for production use cases

---

## 3. Tech Stack

### Confirmed Choices

| Layer | Technology | Notes |
|-------|-------------|-------|
| **Frontend** | Next.js 14+ (App Router) | TypeScript, Tailwind, shadcn/ui |
| **API** | NestJS | TypeScript, modular structure |
| **Database** | Supabase (Postgres) | Free tier only for MVP |
| **Auth** | Supabase Auth | Part of Supabase |
| **Cache/Queue** | Redis (e.g. Upstash) | BullMQ for jobs, sessions |
| **Devices** | Android emulators (docker-android) | budtmo/docker-android or similar |
| **Hosting** | Small Linux VPS | Budget: ~$5–15/mo; emulators need KVM (see §10) |

### Supabase Free Tier Limits (Be Aware)

- 500 MB database
- 1 GB file storage
- 50,000 MAU (auth)
- 2 GB bandwidth/month
- 2 projects

**Plan:** Use free tier for MVP; migrate or upgrade when limits hit.

### Redis (Defer for 1-Month MVP)

- **Needed for:** BullMQ (automation, scheduling), session storage
- **1-month MVP:** Can skip if no automation — add when automation ships
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
│  Dashboard, device list, live view (noVNC embed), auth UI         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  API — NestJS                                                    │
│  Auth, device CRUD, session management, automation triggers       │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Supabase       │  │  Redis (defer)   │  │  (Future)        │
│  • Postgres     │  │  • BullMQ        │  │  Stripe         │
│  • Auth         │  │  • Sessions      │  │                  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  EMULATOR LAYER — VPS with KVM (GCP / Hetzner dedicated)         │
│                                                                  │
│  Docker containers: budtmo/docker-android                        │
│  • noVNC on :6080 (browser view)                                 │
│  • ADB on :5555 (automation)                                      │
│  • NestJS spawns/stops containers, proxies noVNC, runs ADB        │
└─────────────────────────────────────────────────────────────────┘
```

### Cloud Emulator Requirements

- **KVM** (`/dev/kvm`) — hardware virtualization required
- **Providers that support it:** GCP Compute Engine, Hetzner dedicated, AWS Bare Metal
- **Providers that don't:** Standard AWS EC2, most cheap VPS

---

## 5. Features

### 1-Month MVP Scope (Aggressive — Solo)

*Must-have for launch. Everything else is post-MVP.*

| Feature | Priority | Notes |
|---------|----------|-------|
| User auth (signup, login) | P0 | Supabase Auth |
| Device list & status | P0 | At least 1 emulator, online/offline |
| Live device view | P0 | noVNC embed — see device screen |
| Remote control (tap, swipe, type) | P0 | Via noVNC input or ADB |
| Landing page | P0 | Signup CTA, waitlist/beta |
| Basic automation | P1 | *Defer if needed* — run script on device |
| Scheduling | P2 | *Defer* — post-MVP |
| Multi-user / teams | P2 | *Defer* — post-MVP |
| Billing | — | Not in MVP |

### Post-MVP (After Launch)

- Basic automation (BullMQ + ADB)
- Simple scheduling
- Multi-user, roles
- More devices (scale emulators)
- Stripe billing

### Future (When Capital / Feasible)

- Physical Android device support (USB, Scrcpy)
- Physical iPhone support (WebDriverAgent)
- Advanced automations (workflow builder)
- Analytics dashboard
- Social platform integrations (Instagram, TikTok APIs where allowed)

---

## 6. Timeline

- **Total:** 1 month (solo)
- **Week 1:** Project setup (Next.js + NestJS), Supabase auth, landing page, basic dashboard shell
- **Week 2:** Emulator layer (1× docker-android on KVM host), device list API, status
- **Week 3:** Live view (noVNC embed), remote control (tap/swipe/type)
- **Week 4:** Polish, beta signup flow, deploy, testing

*Automation, scheduling, multi-user → post-MVP.*

---

## 7. Key Technical Details

### Android Emulator Stack

- **Image:** `budtmo/docker-android:emulator_13.0` (or 12, 14)
- **Ports:** 6080 (noVNC), 5555 (ADB)
- **Control:** ADB connect, Appium (optional)
- **View:** noVNC in browser, or scrcpy-web (shmayro/dockerify-android)

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
| **1-month timeline** | Cut scope: auth + 1 device + live view + control only. Defer automation, scheduling, billing. |
| **Budget (cheap VPS)** | API + frontend on $5–10 VPS. Emulators need KVM → GCP free credit or nested-VPS (~$15–25). |
| Supabase 500 MB limit | Fine for MVP; migrate if needed later |
| Emulator detection by social apps | Accept for MVP; dev agencies (app testing) less affected |
| KVM required for emulators | GCP $300 credit, or nested-VPS; avoid standard cheap VPS |
| No iOS in Phase 1 | Android-only for MVP |

---

## 9. Competitors & References

- **ALI Remote** — aliremote.com (physical iPhones, $49–79/device/mo)
- **The Phone Farm** — thephonefarm.com (physical iPhones, $250+/mo)
- **Firebase Test Lab** — Managed emulators, ~$1/hr
- **AWS Device Farm** — Physical + virtual devices
- **budtmo/docker-android** — GitHub, 14k+ stars, self-hosted emulators

---

## 10. Project Context (Decided)

| Item | Decision |
|------|----------|
| **Team** | Solo developer |
| **Budget** | Little to none — cheap, enough for a small Linux VPS (~$5–15/mo) |
| **MVP launch** | 1 month |
| **Codebase** | From scratch |
| **First customers** | Beta testers, dev agencies (app testing), social media agencies (organic growth) |
| **Billing** | MVP first — no billing in v1 |
| **Physical devices** | When we get capital or if feasible |

### Budget Reality Check

**Emulators require KVM** (hardware virtualization). Most cheap VPS ($5–10/mo) do **not** support nested virtualization.

| Hosting option | KVM? | Cost | Fit for MVP? |
|----------------|------|------|--------------|
| DigitalOcean / Vultr / Hetzner Cloud | ❌ No | $5–10/mo | API + frontend only |
| GCP Compute Engine | ✅ Yes | ~$50+/mo | Emulators — use $300 free credit |
| Hetzner dedicated | ✅ Yes | €40+/mo | Emulators |
| Nested-VPS providers (Cloudzy, SSDNodes) | ✅ Yes | ~$15–25/mo | Emulators — check specs |

**Recommendation:** Run API + frontend on cheap VPS. For emulators in month 1: use **GCP $300 free credit** (new account) or a nested-VPS trial. Physical devices when capital allows.

---

## 11. File Structure

```
aliremote.com/
├── PROJECT.md          # This file
├── package.json        # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── web/            # Next.js 14 frontend
│   └── api/            # NestJS backend
├── packages/
│   └── shared/         # @aliremote/shared — types, constants
├── docker/
│   └── emulator/        # docker-android compose
└── docs/
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
