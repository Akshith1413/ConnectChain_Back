import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'tracking',
})
export class TrackingGateway {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private trackingService: TrackingService) {}

  @SubscribeMessage('join_booking')
  handleJoinBooking(
    @MessageBody() data: { bookingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `booking_${data.bookingId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined tracking room: ${room}`);
    return { event: 'joined', room };
  }

  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @MessageBody() data: { bookingId: string; workerId: string; latitude: number; longitude: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { bookingId, workerId, latitude, longitude } = data;
    const room = `booking_${bookingId}`;

    try {
      // 1. Update database coordinates
      await this.trackingService.updateLocation(bookingId, workerId, latitude, longitude);

      // 2. Broadcast coordinates to all joined clients in that booking room
      this.server.to(room).emit('location_updated', {
        bookingId,
        latitude,
        longitude,
        updatedAt: new Date().toISOString(),
      });

      this.logger.log(`Broadcasted location update for booking ${bookingId}: lat=${latitude}, lng=${longitude}`);
    } catch (err) {
      this.logger.error(`Location update failed: ${err.message}`);
      client.emit('error', { message: err.message });
    }
  }
}
