import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  clanId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);

  @WebSocketServer()
  server!: Server;

  private connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.['token'] ||
        client.handshake.headers?.['authorization']?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      client.userId = payload.sub;
      client.join(`user:${payload.sub}`);

      if (payload.clanId) {
        client.clanId = payload.clanId;
        client.join(`clan:${payload.clanId}`);
      }

      const userSockets = this.connectedUsers.get(payload.sub) || new Set();
      userSockets.add(client.id);
      this.connectedUsers.set(payload.sub, userSockets);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(client.userId);
        }
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('auction.join')
  handleAuctionJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string },
  ) {
    client.join(`auction:${data.auctionId}`);
    this.logger.debug(`User ${client.userId} joined auction room ${data.auctionId}`);
  }

  @SubscribeMessage('auction.leave')
  handleAuctionLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { auctionId: string },
  ) {
    client.leave(`auction:${data.auctionId}`);
  }

  @SubscribeMessage('activity.join')
  handleActivityJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { activityId: string },
  ) {
    client.join(`activity:${data.activityId}`);
    this.logger.debug(`User ${client.userId} joined activity room ${data.activityId}`);
  }

  @SubscribeMessage('activity.leave')
  handleActivityLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { activityId: string },
  ) {
    client.leave(`activity:${data.activityId}`);
  }

  @SubscribeMessage('randomizer.join')
  handleRandomizerJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    client.join(`randomizer:${data.sessionId}`);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToClan(clanId: string, event: string, data: unknown) {
    this.server.to(`clan:${clanId}`).emit(event, data);
  }

  emitToAuction(auctionId: string, event: string, data: unknown) {
    this.server.to(`auction:${auctionId}`).emit(event, data);
  }

  emitToActivity(activityId: string, event: string, data: unknown) {
    this.server.to(`activity:${activityId}`).emit(event, data);
  }

  emitToRandomizer(sessionId: string, event: string, data: unknown) {
    this.server.to(`randomizer:${sessionId}`).emit(event, data);
  }
}
