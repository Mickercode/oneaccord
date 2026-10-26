import { Module } from '@nestjs/common';
import { PassesController } from './passes.controller';

@Module({
  controllers: [PassesController],
})
export class PassesModule {}
