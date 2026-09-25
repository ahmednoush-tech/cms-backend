import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateQuotationItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ required: false, default: 0, description: 'Absolute line discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, default: 0, description: 'Absolute line tax amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  /** Catalog reference only — a quotation never creates a stock movement. See migration 098's comment. */
  @ApiProperty({ required: false, description: 'Optional link into the multi-warehouse StockItem catalog — reference only, never affects stock' })
  @IsOptional()
  @IsUUID()
  stockItemId?: string;

  // NOTE: `total` is intentionally NOT a field here. It is always
  // server-computed by QuotationCalculator from quantity/unitPrice/
  // discount/tax — never accepted from the client.
}

export class UpdateQuotationItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  stockItemId?: string;
}
