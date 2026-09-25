import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ReceiptDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class IssueDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  fromWarehouseId: string;

  @IsUUID()
  toWarehouseId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

/** newQuantity (the counted total after a physical stocktake), not a +/- delta — the service computes the correct delta (and correct movement direction) from the difference against the current cached quantity. */
export class AdjustmentDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0)
  newQuantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
