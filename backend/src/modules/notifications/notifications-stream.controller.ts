import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationBusService } from './notification-bus.service';
import { StreamTicketService } from './stream-ticket.service';

/**
 * Step 2 of opening the real-time stream. Its own controller, apart
 * from NotificationsController, because it must run WITHOUT the
 * normal request machinery:
 *
 * - @Public(): skips the global JwtAuthGuard — the browser's
 *   EventSource can't send a Bearer header, so authentication is
 *   the ticket instead (issued moments ago by a request that DID go
 *   through the full guard).
 * - Excluded from TenantTransactionMiddleware in app.module.ts: that
 *   middleware holds one DB connection + an open transaction until
 *   the response finishes, and a stream never finishes. Every open
 *   browser tab would otherwise permanently occupy a pooled
 *   connection (the pool would run out after a handful of tabs and
 *   freeze the whole system), and the 15s transaction timeout
 *   would kill the stream's context anyway. This handler makes no
 *   database queries at all — it only verifies a signature.
 */
@ApiTags('Notifications')
@Public()
@Controller('api/v1/notifications')
export class NotificationsStreamController {
  constructor(
    private bus: NotificationBusService,
    private streamTickets: StreamTicketService,
  ) {}

  @Get('stream')
  stream(@Query('ticket') ticket: string | undefined, @Res() res: Response) {
    const { userId } = this.streamTickets.verify(ticket); // throws 401 before anything is written
    this.bus.register(userId, res);
  }
}
