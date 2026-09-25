import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { CreateQuotationItemDto } from './quotation-item.dto';

export class CreateQuotationDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ required: false, default: 'SAR', description: 'ISO 4217 code from the currencies table. Defaults to the base currency (SAR).' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiProperty({
    required: false,
    default: 1,
    description:
      'Units of base currency (SAR) per 1 unit of currencyCode, frozen at creation. Ignored/forced to 1 when currencyCode is SAR — see QuotationsService.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  exchangeRateToBase?: number;

  @ApiProperty({
    required: false,
    type: [CreateQuotationItemDto],
    description: 'Optional initial line items — can also be added afterward via the items sub-resource.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];

  // NOTE: quotationNumber, subtotal, discount, tax, total, and
  // status are intentionally NOT accepted here. quotationNumber is
  // generated server-side (unique per company); the four monetary
  // fields are always derived from items; status always starts at
  // 'draft'.
}

export class UpdateQuotationDto {
  @ApiProperty({ required: false, description: 'Only mutable while status is draft' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ required: false, description: 'Only mutable while status is draft' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiProperty({
    required: false,
    description: 'Mutable in draft or sent (a due-date extension is not a commercial change)',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
