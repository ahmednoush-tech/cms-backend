import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const ENTITY_TYPES = ['lead', 'opportunity'];
const EVENTS = ['created', 'stage_changed'];

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(ENTITY_TYPES)
  triggerEntityType?: 'lead' | 'opportunity';

  @IsOptional()
  @IsIn(EVENTS)
  triggerEvent?: 'created' | 'stage_changed';

  /**
   * Only strictly validated here when triggerEvent is ALSO present
   * in this same request — the service layer re-derives full
   * consistency against the EXISTING stored row before saving.
   */
  @ValidateIf((o) => o.triggerEvent === 'stage_changed')
  @IsString()
  @MinLength(1)
  triggerToStage?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notificationTitle?: string;

  @IsOptional()
  @IsString()
  notificationMessage?: string;
}
