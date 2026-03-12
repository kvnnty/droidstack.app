import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule, OrchestratorModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
