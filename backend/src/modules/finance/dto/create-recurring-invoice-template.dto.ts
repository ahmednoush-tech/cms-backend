import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringInvoiceTemplateItemDto } from './recurring-invoice-template-item.dto';

export class CreateRecurringInvoiceTemplateDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['monthly', 'quarterly', 'yearly'])
  frequency: 'monthly' | 'quarterly' | 'yearly';

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currencyCode?: string;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  exchangeRateToBase?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringInvoiceTemplateItemDto)
  items: RecurringInvoiceTemplateItemDto[];
}
