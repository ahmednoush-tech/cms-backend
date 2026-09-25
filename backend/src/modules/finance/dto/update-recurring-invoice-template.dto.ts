import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringInvoiceTemplateItemDto } from './recurring-invoice-template-item.dto';

export class UpdateRecurringInvoiceTemplateDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /**
   * When provided, REPLACES the template's entire item list —
   * simpler and less error-prone than a separate add/remove
   * sub-resource for something that only affects FUTURE
   * generations, never invoices already created.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringInvoiceTemplateItemDto)
  @IsOptional()
  items?: RecurringInvoiceTemplateItemDto[];
}
