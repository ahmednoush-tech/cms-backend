import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsIn } from 'class-validator';

export class GrantPermissionDto {
  @ApiProperty()
  @IsUUID()
  permissionId: string;

  /** Omit both scope fields for a normal, unscoped (company-wide) grant. */
  @ApiPropertyOptional({ enum: ['department'] })
  @IsOptional()
  @IsIn(['department'])
  scopeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scopeId?: string;
}
