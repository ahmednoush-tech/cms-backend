import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateFixedAssetDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  purchaseDate: string;

  @IsNumber()
  @Min(0.01)
  purchaseCost: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salvageValue?: number;

  @IsInt()
  @Min(1)
  usefulLifeMonths: number;

  @IsUUID()
  @IsOptional()
  fixedAssetAccountId?: string;

  @IsUUID()
  @IsOptional()
  accumulatedDepreciationAccountId?: string;

  @IsUUID()
  @IsOptional()
  depreciationExpenseAccountId?: string;
}
