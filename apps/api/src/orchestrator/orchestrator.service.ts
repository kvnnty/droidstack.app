import { Injectable } from '@nestjs/common';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3002';

@Injectable()
export class OrchestratorService {
  async startContainer(deviceId: string): Promise<{
    containerId: string;
    adbPort: number;
    novncPort: number;
  }> {
    const res = await fetch(`${ORCHESTRATOR_URL}/orchestrator/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) throw new Error(`Orchestrator error: ${await res.text()}`);
    const data = await res.json() as { containerId: string; adbPort: number; novncPort: number };
    return data;
  }

  async stopContainer(containerId: string): Promise<void> {
    const res = await fetch(`${ORCHESTRATOR_URL}/orchestrator/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId }),
    });
    if (!res.ok) throw new Error(`Orchestrator error: ${await res.text()}`);
  }

  async restartContainer(containerId: string): Promise<void> {
    const res = await fetch(`${ORCHESTRATOR_URL}/orchestrator/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId }),
    });
    if (!res.ok) throw new Error(`Orchestrator error: ${await res.text()}`);
  }
}
