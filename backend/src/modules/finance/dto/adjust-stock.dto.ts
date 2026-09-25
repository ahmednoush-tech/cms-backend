import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  inventoryItemId: string;

  @IsIn(['increase', 'decrease'])
  direction: 'increase' | 'decrease';

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @IsUUID()
  offsetAccountId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
