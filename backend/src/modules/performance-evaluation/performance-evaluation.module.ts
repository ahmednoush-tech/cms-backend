import { Module } from '@nestjs/common';
import { PerformanceCyclesService } from './performance-cycles.service';
import { PerformanceCriteriaService } from './performance-criteria.service';
import { PerformanceEvaluationsService } from './performance-evaluations.service';
import { PerformanceCyclesController } from './performance-cycles.controller';
import { PerformanceCriteriaController } from './performance-criteria.controller';
import { PerformanceEvaluationsController } from './performance-evaluations.controller';

@Module({
  controllers: [PerformanceCyclesController, PerformanceCriteriaController, PerformanceEvaluationsController],
  providers: [PerformanceCyclesService, PerformanceCriteriaService, PerformanceEvaluationsService],
  exports: [PerformanceCyclesService, PerformanceCriteriaService, PerformanceEvaluationsService],
})
export class PerformanceEvaluationModule {}
