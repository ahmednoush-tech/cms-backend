import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  // Deliberately no `vendorId` — an order genuinely intended for
  // a different vendor is a new order, not an edit of this one.
}
