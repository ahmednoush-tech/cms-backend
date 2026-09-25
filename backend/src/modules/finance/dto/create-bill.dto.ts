import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BillItemDto } from './bill-item.dto';

export class CreateBillDto {
  @IsUUID()
  vendorId: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  vendorReference?: string;

  @IsDateString()
  billDate: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, description: 'projects.id — links this vendor bill to a project for material/vendor cost tracking (see ProjectsService.getProgressAndBudget).' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  items: BillItemDto[];
}
