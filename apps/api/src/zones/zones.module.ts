import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';

@Module({
  imports: [LiveModule],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
