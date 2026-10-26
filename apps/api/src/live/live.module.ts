import { Module } from '@nestjs/common';
import { LiveService } from './live.service';
import { LiveGateway } from './live.gateway';
import { LiveController } from './live.controller';

@Module({
  controllers: [LiveController],
  providers: [LiveService, LiveGateway],
  exports: [LiveService],
})
export class LiveModule {}
