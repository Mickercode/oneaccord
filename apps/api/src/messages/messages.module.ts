import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [MailModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
