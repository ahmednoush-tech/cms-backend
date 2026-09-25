import { Module } from '@nestjs/common';
import { CrmTimelineService } from './crm-timeline.service';
import { CrmTimelineController } from './crm-timeline.controller';

@Module({
  controllers: [CrmTimelineController],
  providers: [CrmTimelineService],
})
export class CrmTimelineModule {}
