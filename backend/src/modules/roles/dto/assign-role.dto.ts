import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsIn } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;

  /** Omit both scope fields for a normal, unscoped (company-wide) assignment. */
  @ApiPropertyOptional({ enum: ['department'] })
  @IsOptional()
  @IsIn(['department'])
  scopeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scopeId?: string;
}
