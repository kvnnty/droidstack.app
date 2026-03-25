import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgentModule } from './agent/agent.module';
import { BillingModule } from './billing/billing.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 60_000, limit: 30 },
      { name: 'long', ttl: 300_000, limit: 150 },
    ]),
    SupabaseModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    DevicesModule,
    AgentModule,
    OrchestratorModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
