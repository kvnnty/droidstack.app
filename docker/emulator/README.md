# Android Emulator (docker-android)

Requires a host with **KVM** (hardware virtualization). Most cheap VPS do not support this.

## Quick start

```bash
docker compose -f docker/emulator/docker-compose.yml up -d
```

- noVNC: http://localhost:6080
- ADB: `adb connect localhost:5555`

## Providers with KVM

- GCP Compute Engine
- Hetzner dedicated
- Nested-VPS (Cloudzy, SSDNodes)
