import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { MailModule } from './mail/mail.module';
import { LiveModule } from './live/live.module';
import { ZonesModule } from './zones/zones.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { PassesModule } from './passes/passes.module';
import { CheckInsModule } from './checkins/checkins.module';
import { TripsModule } from './trips/trips.module';
import { MessagesModule } from './messages/messages.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health.controller';
import { ApiFallbackModule } from './api-fallback.controller';

@Module({
  imports: [
    CommonModule,
    // A floor under every public endpoint. Cloudflare sits in front of this
    // in production and does the heavy lifting.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    MailModule,
    LiveModule,
    ZonesModule,
    AuthModule,
    EventsModule,
    RegistrationsModule,
    PassesModule,
    CheckInsModule,
    TripsModule,
    MessagesModule,
    ExportModule,
    // After every real API route, so it only catches what is left over.
    ApiFallbackModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
