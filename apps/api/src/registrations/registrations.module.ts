import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { LiveModule } from '../live/live.module';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';

@Module({
  imports: [MailModule, LiveModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
