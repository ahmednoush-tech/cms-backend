import { Module } from '@nestjs/common';
import { ReportDefinitionsService } from './report-definitions.service';
import { ReportRunnerService } from './report-runner.service';
import { ReportDefinitionsController } from './report-definitions.controller';
import { ReportsMetadataController } from './reports-metadata.controller';

@Module({
  controllers: [ReportDefinitionsController, ReportsMetadataController],
  providers: [ReportDefinitionsService, ReportRunnerService],
  exports: [ReportDefinitionsService, ReportRunnerService],
})
export class ReportsModule {}
