import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicQuotationService } from './public-quotation.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * No @UseGuards() at all here beyond the global JwtAuthGuard,
 * which @Public() explicitly bypasses — this route is reachable
 * by anyone with the link, by design. It carries no
 * @Permissions() and no @InternalOnly()/@PortalOnly() because
 * neither applies: there is no authenticated identity of any kind
 * on this request.
 */
@ApiTags('Public / Quotation Share Link')
@Public()
@Controller('api/v1/public/quotations')
export class PublicQuotationController {
  constructor(private publicQuotationService: PublicQuotationService) {}

  @Get(':token')
  getByToken(@Param('token', ParseUUIDPipe) token: string) {
    return this.publicQuotationService.getByToken(token);
  }
}
