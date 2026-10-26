import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import type { LiveSnapshot } from '@oa/types';
import { REDIS } from '../common/common.module';
import { AppConfig, CONFIG } from '../common/config';
import { LiveService } from './live.service';

/**
 * Live counts for the dashboard, the delegate's boarding screen and the
 * ushers' zone fill. Rooms: event:<id> for the whole picture, trip:<id> for
 * one bus.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class LiveGateway implements OnGatewayInit, OnModuleInit {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly live: LiveService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async afterInit(server: Server): Promise<void> {
    // One room spans every API instance, so a check-in on one shows on all.
    const subscriber = this.redis.duplicate();
    server.adapter(createAdapter(this.redis, subscriber));
    this.logger.log('Live gateway ready.');
  }

  onModuleInit(): void {
    this.live.changes.on('snapshot', (snapshot: LiveSnapshot) => {
      this.server?.to(`event:${snapshot.eventId}`).emit('live:update', snapshot);
      for (const trip of snapshot.trips) {
        this.server?.to(`trip:${trip.id}`).emit('trip:update', trip);
      }
    });
  }

  @SubscribeMessage('watch:event')
  async watchEvent(
    @MessageBody() eventId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<LiveSnapshot | null> {
    if (typeof eventId !== 'string' || eventId.length > 64) return null;
    await client.join(`event:${eventId}`);
    return this.live.snapshot(eventId);
  }

  @SubscribeMessage('watch:trip')
  async watchTrip(
    @MessageBody() tripId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<{ boardedCount: number } | null> {
    if (typeof tripId !== 'string' || tripId.length > 64) return null;
    await client.join(`trip:${tripId}`);
    return { boardedCount: await this.live.tripBoarded(tripId) };
  }

  @SubscribeMessage('unwatch')
  async unwatch(@MessageBody() room: string, @ConnectedSocket() client: Socket): Promise<void> {
    if (typeof room === 'string') await client.leave(room);
  }
}
