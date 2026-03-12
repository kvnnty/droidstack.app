import { Body, Controller, Delete, Post } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post('start')
  async start(@Body() body: { deviceId: string }) {
    return this.orchestrator.startContainer(body.deviceId);
  }

  @Post('stop')
  async stop(@Body() body: { containerId: string }) {
    await this.orchestrator.stopContainer(body.containerId);
    return { ok: true };
  }

  @Post('restart')
  async restart(@Body() body: { containerId: string }) {
    await this.orchestrator.restartContainer(body.containerId);
    return { ok: true };
  }

  @Post('status')
  async status(@Body() body: { containerId: string }) {
    return { status: await this.orchestrator.getContainerStatus(body.containerId) };
  }
}
