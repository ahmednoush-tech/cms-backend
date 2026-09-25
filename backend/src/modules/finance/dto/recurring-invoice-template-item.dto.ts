import { IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class RecurringInvoiceTemplateItemDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tax?: number;
}
