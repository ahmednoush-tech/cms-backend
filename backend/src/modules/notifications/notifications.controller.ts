import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsService } from './notifications.service';
import { StreamTicketService } from './stream-ticket.service';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';

/**
 * No @Permissions() on purpose: every endpoint here only ever acts
 * on the CALLER'S OWN notifications (companyId + sub from the JWT),
 * so being a logged-in internal user is the whole requirement —
 * there is nothing to grant or withhold.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private streamTickets: StreamTicketService,
  ) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.list(companyId, userId, {
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.unreadCount(companyId, userId);
  }

  @Post('read')
  markRead(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: MarkNotificationsReadDto,
  ) {
    return this.notificationsService.markRead(companyId, userId, dto.ids);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllRead(companyId, userId);
  }

  /** Step 1 of opening the real-time stream — see StreamTicketService for why a ticket is needed at all. */
  @Post('stream-ticket')
  streamTicket(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string) {
    return this.streamTickets.issue(userId, companyId);
  }
}
