import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason: string;
}
