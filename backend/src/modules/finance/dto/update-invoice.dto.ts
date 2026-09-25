import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateInvoiceDto {
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}
