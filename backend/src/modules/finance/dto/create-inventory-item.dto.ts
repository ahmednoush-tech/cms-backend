import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  sku: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  openingQuantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  openingUnitCost?: number;

  @IsUUID()
  @IsOptional()
  inventoryAccountId?: string;

  @IsUUID()
  @IsOptional()
  cogsAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
