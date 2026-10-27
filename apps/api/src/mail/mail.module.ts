import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { RemindersService } from './reminders.service';

@Module({
  providers: [MailService, RemindersService],
  exports: [MailService],
})
export class MailModule {}
