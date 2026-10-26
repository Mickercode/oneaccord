import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Serialises everything happening to one pickup point, so two people
   * registering in the same millisecond cannot take the same last seat.
   */
  async lockPickupPoint(pickupPointId: string): Promise<void> {
    await this.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', pickupPointId);
  }
}
