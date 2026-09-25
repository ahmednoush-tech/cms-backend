import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZatcaCertificateService } from './zatca-certificate.service';
import { GenerateZatcaCsrDto } from './dto/generate-zatca-csr.dto';

@ApiTags('Finance / ZATCA Phase 2')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/zatca')
export class ZatcaCertificateController {
  constructor(private zatcaCertificateService: ZatcaCertificateService) {}

  @Get('certificates')
  @Permissions('Finance:zatca:view')
  list(@CurrentUser('companyId') companyId: string) {
    return this.zatcaCertificateService.list(companyId);
  }

  @Post('certificates/csr')
  @Permissions('Finance:zatca:manage')
  generateCsr(@CurrentUser('companyId') companyId: string, @Body() dto: GenerateZatcaCsrDto) {
    return this.zatcaCertificateService.generateCsr(companyId, dto);
  }

  @Post('certificates/:id/compliance-csid')
  @Permissions('Finance:zatca:manage')
  requestComplianceCsid(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('otp') otp: string,
  ) {
    return this.zatcaCertificateService.requestComplianceCsid(companyId, id, otp);
  }

  @Post('certificates/:id/production-csid')
  @Permissions('Finance:zatca:manage')
  requestProductionCsid(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.zatcaCertificateService.requestProductionCsid(companyId, id);
  }
}
