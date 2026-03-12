import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  private getToken(headers: Record<string, string | undefined>): string {
    const token = headers['x-device-token'];
    if (!token) throw new Error('Missing X-Device-Token');
    return token;
  }

  @Post('devices/:id/heartbeat')
  async heartbeat(
    @Param('id') deviceId: string,
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: { batteryLevel?: number; metadata?: Record<string, unknown> },
  ) {
    const token = this.getToken(headers);
    await this.agent.heartbeat(deviceId, token, body);
    return { ok: true };
  }

  @Get('devices/:id/commands')
  async getCommands(
    @Param('id') deviceId: string,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const token = this.getToken(headers);
    return this.agent.getPendingCommands(deviceId, token);
  }

  @Post('devices/:id/alerts')
  async createAlert(
    @Param('id') deviceId: string,
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: { alertType: string; message?: string; severity?: string },
  ) {
    const token = this.getToken(headers);
    return this.agent.createAlert(deviceId, token, body);
  }

  @Post('commands/:id/complete')
  async completeCommand(
    @Param('id') commandId: string,
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: { success: boolean; result?: Record<string, unknown> },
  ) {
    const token = this.getToken(headers);
    await this.agent.completeCommand(commandId, token, body);
    return { ok: true };
  }
}
