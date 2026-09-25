import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

/**
 * Approved application-level role values (Phase 2D design
 * review). project_members.role remains a free-text VARCHAR(50)
 * in the approved schema — no CHECK constraint was added. This
 * enum is enforced here, at the DTO layer, only.
 */
export const PROJECT_MEMBER_ROLES = [
  'manager',
  'coordinator',
  'technician',
  'qa',
  'support',
  'member',
] as const;

export class AddProjectMemberDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: PROJECT_MEMBER_ROLES })
  @IsIn(PROJECT_MEMBER_ROLES)
  role: string;
}

export class UpdateProjectMemberRoleDto {
  @ApiProperty({ enum: PROJECT_MEMBER_ROLES })
  @IsIn(PROJECT_MEMBER_ROLES)
  role: string;
}
