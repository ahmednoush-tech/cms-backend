import { apiRequest } from '../client';
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CreateCustomFieldDefinitionInput,
  UpdateCustomFieldDefinitionInput,
} from '../../types/entities/customField';

/** Confirmed 1:1 against backend/src/modules/custom-fields/custom-field-definitions.controller.ts. */
export const customFieldDefinitionsApi = {
  list: async (entityType: CustomFieldEntityType): Promise<CustomFieldDefinition[]> => {
    const { data } = await apiRequest<CustomFieldDefinition[]>({ method: 'GET', url: '/custom-field-definitions', params: { entityType } });
    return data;
  },
  create: async (input: CreateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> => {
    const { data } = await apiRequest<CustomFieldDefinition>({ method: 'POST', url: '/custom-field-definitions', data: input });
    return data;
  },
  update: async (id: string, input: UpdateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> => {
    const { data } = await apiRequest<CustomFieldDefinition>({ method: 'PATCH', url: `/custom-field-definitions/${id}`, data: input });
    return data;
  },
  deactivate: async (id: string): Promise<CustomFieldDefinition> => {
    const { data } = await apiRequest<CustomFieldDefinition>({ method: 'DELETE', url: `/custom-field-definitions/${id}` });
    return data;
  },
};
