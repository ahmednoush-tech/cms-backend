import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @IsUUID()
  @IsOptional()
  inventoryAccountId?: string;

  @IsUUID()
  @IsOptional()
  cogsAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Deliberately no `sku` (identity field, immutable) and no
  // `quantityOnHand`/`averageUnitCost` — those only ever change
  // through a recorded movement (adjustStock, or a sale/purchase),
  // never by direct edit.
}
