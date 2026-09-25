import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentAllocationDto } from './payment-allocation.dto';

export class CreateCustomerPaymentDto {
  @IsUUID()
  customerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsIn(['cash', 'bank_transfer', 'card', 'cheque', 'other'])
  method: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other';

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reference?: string;

  /**
   * Does not have to sum to `amount` exactly — any leftover is
   * tracked as `unappliedAmount` (e.g. an advance payment, or
   * money received before the customer says which invoices it
   * covers). It must never sum to MORE than `amount` — that's
   * validated in the service, not here.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations: PaymentAllocationDto[];
}
