import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

const ENTITY_TYPES = ['lead', 'opportunity', 'customer'];
const FIELD_TYPES = ['text', 'number', 'date', 'select'];

export class CreateCustomFieldDefinitionDto {
  @IsIn(ENTITY_TYPES)
  entityType: 'lead' | 'opportunity' | 'customer';

  /** Lowercase letters, numbers, and underscores only — used as the JSON key stored on the entity. */
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'fieldKey must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.' })
  fieldKey: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsIn(FIELD_TYPES)
  fieldType: 'text' | 'number' | 'date' | 'select';

  /** Required when fieldType is 'select', and must be omitted otherwise. */
  @ValidateIf((o) => o.fieldType === 'select')
  @IsArray()
  @IsString({ each: true })
  selectOptions?: string[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
