import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { CheckInsModule } from '../checkins/checkins.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';

@Module({
  imports: [LiveModule, CheckInsModule, RegistrationsModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
