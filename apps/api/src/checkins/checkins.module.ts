import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { ZonesModule } from '../zones/zones.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { CheckInsService } from './checkins.service';
import { CheckInsController } from './checkins.controller';

@Module({
  imports: [LiveModule, ZonesModule, RegistrationsModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
