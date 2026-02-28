import { Injectable } from '@nestjs/common';
import type { Device } from '@aliremote/shared';

@Injectable()
export class DevicesService {
  async list(): Promise<Device[]> {
    // TODO: List emulator containers from Docker / Supabase
    return [];
  }
}
