import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceNoteItemDto } from './invoice-note-item.dto';

export class CreateInvoiceNoteDto {
  @IsUUID()
  invoiceId: string;

  @IsIn(['credit', 'debit'])
  noteType: 'credit' | 'debit';

  @IsDateString()
  noteDate: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceNoteItemDto)
  items: InvoiceNoteItemDto[];
}
