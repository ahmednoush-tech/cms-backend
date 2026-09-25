import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';

/**
 * Two creation paths, both handled by this one DTO (the XOR logic
 * itself — quotationId means customerId/items are ignored, else
 * customerId+items are required — is enforced in
 * InvoicesService.create(), not declaratively here, since
 * class-validator doesn't express "required unless X" cleanly):
 *
 *   1. From an accepted quotation: { quotationId, issueDate, dueDate? }
 *      — customer, items, currencyCode, AND exchangeRateToBase are
 *      all copied from the quotation. currencyCode/exchangeRateToBase
 *      on THIS dto are ignored entirely on that path — a standalone
 *      invoice's currency is set once at issuance and should not
 *      silently diverge from the quotation the customer already saw.
 *   2. Standalone: { customerId, items, issueDate, dueDate?, currencyCode?, exchangeRateToBase? }
 */
export class CreateInvoiceDto {
  @IsUUID()
  @IsOptional()
  quotationId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsDateString()
  issueDate: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Required only if any line item carries a stockItemId — validated at issue() time, not here, since a draft invoice may be created before the warehouse is decided. */
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currencyCode?: string;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  exchangeRateToBase?: number;
}
