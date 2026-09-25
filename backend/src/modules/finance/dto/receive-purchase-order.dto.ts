import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveLineDto {
  @IsUUID()
  purchaseOrderItemId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;
}

export class ReceivePurchaseOrderDto {
  /** The warehouse the goods are physically being received INTO — every line in this receiving event goes to the same warehouse; receiving different lines into different warehouses is two separate calls. */
  @IsUUID()
  warehouseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}
