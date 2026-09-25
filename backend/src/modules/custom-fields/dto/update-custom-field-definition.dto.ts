import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * fieldKey and fieldType are DELIBERATELY NOT editable here —
 * changing either would silently reinterpret whatever values are
 * already stored under that key across every existing Lead's
 * customFields JSON. To genuinely change a field's key or type,
 * deactivate this definition and create a new one instead.
 */
export class UpdateCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectOptions?: string[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
