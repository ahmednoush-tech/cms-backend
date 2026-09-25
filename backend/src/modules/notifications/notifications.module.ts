import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationBusService } from './notification-bus.service';
import { StreamTicketService } from './stream-ticket.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsStreamController } from './notifications-stream.controller';

/**
 * @Global() so every module that creates notifications (tasks,
 * work orders, projects, quotations, employees, automation rules)
 * can inject NotificationsService without each one having to import
 * this module — same approach as CommonServicesModule.
 *
 * JwtModule.register({}) with no default secret: StreamTicketService
 * always passes its own derived secret explicitly (same pattern as
 * PlatformAdminModule), so nothing here can accidentally sign with
 * the real access-token secret.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController, NotificationsStreamController],
  providers: [NotificationsService, NotificationBusService, StreamTicketService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
