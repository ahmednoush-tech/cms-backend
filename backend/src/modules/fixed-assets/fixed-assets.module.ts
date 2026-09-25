import { Module } from '@nestjs/common';
import { FixedAssetsService } from './fixed-assets.service';
import { FixedAssetsController } from './fixed-assets.controller';
import { DepreciationRunsService } from './depreciation-runs.service';
import { DepreciationRunsController } from './depreciation-runs.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [FixedAssetsController, DepreciationRunsController],
  providers: [FixedAssetsService, DepreciationRunsService],
  exports: [FixedAssetsService, DepreciationRunsService],
})
export class FixedAssetsModule {}
