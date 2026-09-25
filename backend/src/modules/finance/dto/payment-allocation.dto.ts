import { IsNumber, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class PaymentAllocationDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  exchangeRateToBase?: number;
}
