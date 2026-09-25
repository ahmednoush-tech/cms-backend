import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFixedAssetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  fixedAssetAccountId?: string;

  @IsUUID()
  @IsOptional()
  accumulatedDepreciationAccountId?: string;

  @IsUUID()
  @IsOptional()
  depreciationExpenseAccountId?: string;

  // Deliberately no `purchaseCost`, `salvageValue`, or
  // `usefulLifeMonths` — these define the depreciation SCHEDULE.
  // Once any depreciation has been posted against an asset,
  // changing them in place would silently make past postings
  // inconsistent with a recalculated schedule.
}
