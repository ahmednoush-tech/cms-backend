import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportDefinitionsService } from './report-definitions.service';
import { ReportRunnerService } from './report-runner.service';
import { CreateReportDefinitionDto, UpdateReportDefinitionDto } from './dto/report-definition.dto';
import { toCsv } from '../../common/utils/csv.util';

@ApiTags('Analytics / Custom Reports')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/report-definitions')
export class ReportDefinitionsController {
  constructor(
    private reportDefinitionsService: ReportDefinitionsService,
    private reportRunnerService: ReportRunnerService,
  ) {}

  @Get()
  @Permissions('Analytics:custom_reports:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.reportDefinitionsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Analytics:custom_reports:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportDefinitionsService.findOne(companyId, id);
  }

  @Post()
  @Permissions('Analytics:custom_reports:manage')
  create(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateReportDefinitionDto) {
    return this.reportDefinitionsService.create(companyId, userId, dto);
  }

  @Patch(':id')
  @Permissions('Analytics:custom_reports:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDefinitionDto) {
    return this.reportDefinitionsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Analytics:custom_reports:manage')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportDefinitionsService.remove(companyId, id);
  }

  @Get(':id/run')
  @Permissions('Analytics:custom_reports:view')
  run(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportRunnerService.run(companyId, id);
  }

  /**
   * Same data as run() above, as a downloadable CSV file instead
   * of JSON — every report's result rows share the same
   * {label, value} shape (see reports-registry.ts), so this needs
   * no per-report-type handling. The report's own name becomes the
   * downloaded filename, sanitized to strip characters that would
   * break a Content-Disposition header or be awkward in a
   * filename (kept simple on purpose: this is a display name a
   * user already chose, not arbitrary untrusted input requiring
   * exhaustive sanitization).
   */
  @Get(':id/export.csv')
  @Permissions('Analytics:custom_reports:view')
  async exportCsv(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const [def, rows] = await Promise.all([
      this.reportDefinitionsService.findOne(companyId, id),
      this.reportRunnerService.run(companyId, id),
    ]);
    const csv = toCsv(rows, { label: 'Label', value: 'Value' });

    // Only strip characters that are illegal in filenames or would
    // break the header — NOT non-Latin letters. An earlier version
    // kept only [a-zA-Z0-9], which silently erased an Arabic report
    // name entirely (falling back to "report").
    const safeName = def.name.replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'report';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // filename= is a plain-ASCII fallback for old clients;
    // filename*= (RFC 5987) carries the real UTF-8 name, which is
    // what every modern browser actually uses.
    res.setHeader('Content-Disposition', `attachment; filename="report.csv"; filename*=UTF-8''${encodeURIComponent(safeName)}.csv`);
    // Leading UTF-8 byte-order mark: without it, Excel opens the
    // file in the legacy Windows code page and Arabic text becomes
    // unreadable. Harmless to every other CSV reader.
    res.send('\uFEFF' + csv);
  }

  /** Preview a report WITHOUT saving it first — same permission as create(), since previewing is part of building a new report. */
  @Post('preview')
  @Permissions('Analytics:custom_reports:manage')
  preview(@CurrentUser('companyId') companyId: string, @Body() dto: CreateReportDefinitionDto) {
    return this.reportRunnerService.runAdHoc(companyId, dto);
  }
}
