import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateBillDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  vendorReference?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, nullable: true, description: 'Send null to unlink this bill from any project.' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}
