import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';

const EMULATOR_IMAGE = process.env.EMULATOR_IMAGE ?? 'budtmo/docker-android:emulator_13.0';
const PORT_RANGE_START = parseInt(process.env.PORT_RANGE_START ?? '6000', 10);
const PORT_RANGE_END = parseInt(process.env.PORT_RANGE_END ?? '7000', 10);

@Injectable()
export class OrchestratorService {
  private docker: Docker;
  private usedPorts = new Set<number>();
  private containerPorts = new Map<string, { adbPort: number; novncPort: number }>();

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  private findFreePort(): number {
    for (let p = PORT_RANGE_START; p < PORT_RANGE_END; p++) {
      if (!this.usedPorts.has(p)) {
        this.usedPorts.add(p);
        return p;
      }
    }
    throw new Error('No free ports available');
  }

  private releasePort(port: number) {
    this.usedPorts.delete(port);
  }

  async startContainer(deviceId: string): Promise<{
    containerId: string;
    adbPort: number;
    novncPort: number;
  }> {
    const adbPort = this.findFreePort();
    const novncPort = this.findFreePort();

    try {
      const container = await this.docker.createContainer({
        Image: EMULATOR_IMAGE,
        name: `aliremote-${deviceId.slice(0, 8)}`,
        HostConfig: {
          Privileged: true,
          PortBindings: {
            '5555/tcp': [{ HostPort: String(adbPort) }],
            '6080/tcp': [{ HostPort: String(novncPort) }],
          },
          Devices: [{ PathOnHost: '/dev/kvm', PathInContainer: '/dev/kvm', CgroupPermissions: 'rwm' }],
        },
        Env: [
          'EMULATOR_DEVICE=Samsung Galaxy S10',
          'WEB_VNC=true',
          `DEVICE_ID=${deviceId}`,
        ],
      });

      await container.start();
      const info = await container.inspect();
      this.containerPorts.set(info.Id, { adbPort, novncPort });

      return {
        containerId: info.Id,
        adbPort,
        novncPort,
      };
    } catch (e) {
      this.releasePort(adbPort);
      this.releasePort(novncPort);
      throw e;
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const ports = this.containerPorts.get(containerId);
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 10 });
      await container.remove();
      if (ports) {
        this.releasePort(ports.adbPort);
        this.releasePort(ports.novncPort);
        this.containerPorts.delete(containerId);
      }
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 404) throw e;
    }
  }

  async restartContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.restart();
  }

  async getContainerStatus(containerId: string): Promise<'running' | 'exited' | 'not_found'> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Running ? 'running' : 'exited';
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return 'not_found';
      throw e;
    }
  }
}
