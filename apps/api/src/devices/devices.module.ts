import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [OrchestratorModule, BillingModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
