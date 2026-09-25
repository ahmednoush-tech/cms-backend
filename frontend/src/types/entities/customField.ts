export type CustomFieldEntityType = 'lead' | 'opportunity' | 'customer';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDefinition {
  id: string;
  companyId: string;
  entityType: CustomFieldEntityType;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  selectOptions: string[] | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldDefinitionInput {
  entityType: CustomFieldEntityType;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  selectOptions?: string[];
  isRequired?: boolean;
  displayOrder?: number;
}

export interface UpdateCustomFieldDefinitionInput {
  label?: string;
  selectOptions?: string[];
  isRequired?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}
