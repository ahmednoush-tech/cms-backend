import { apiRequest } from '../client';
import type {
  CustomerContact,
  CreateCustomerContactInput,
  UpdateCustomerContactInput,
  CustomerPortalUser,
  CreatePortalUserInput,
  LinkExistingUserInput,
} from '../../types/entities/customer';

/** Confirmed 1:1 against backend/src/modules/customer-contacts/customer-contacts.controller.ts — nested under /customers/:customerId/contacts. */
export const customerContactsApi = {
  list: async (customerId: string): Promise<CustomerContact[]> => {
    const { data } = await apiRequest<CustomerContact[]>({ method: 'GET', url: `/customers/${customerId}/contacts` });
    return data;
  },
  create: async (customerId: string, input: CreateCustomerContactInput): Promise<CustomerContact> => {
    const { data } = await apiRequest<CustomerContact>({
      method: 'POST',
      url: `/customers/${customerId}/contacts`,
      data: input,
    });
    return data;
  },
  update: async (customerId: string, contactId: string, input: UpdateCustomerContactInput): Promise<CustomerContact> => {
    const { data } = await apiRequest<CustomerContact>({
      method: 'PATCH',
      url: `/customers/${customerId}/contacts/${contactId}`,
      data: input,
    });
    return data;
  },
  remove: async (customerId: string, contactId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/customers/${customerId}/contacts/${contactId}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/customer-users/customer-users.controller.ts — nested under /customers/:customerId/portal-users. */
export const customerUsersApi = {
  list: async (customerId: string): Promise<CustomerPortalUser[]> => {
    const { data } = await apiRequest<CustomerPortalUser[]>({
      method: 'GET',
      url: `/customers/${customerId}/portal-users`,
    });
    return data;
  },
  create: async (customerId: string, input: CreatePortalUserInput): Promise<CustomerPortalUser> => {
    const { data } = await apiRequest<CustomerPortalUser>({
      method: 'POST',
      url: `/customers/${customerId}/portal-users`,
      data: input,
    });
    return data;
  },
  linkExisting: async (customerId: string, input: LinkExistingUserInput): Promise<CustomerPortalUser> => {
    const { data } = await apiRequest<CustomerPortalUser>({
      method: 'POST',
      url: `/customers/${customerId}/portal-users/link-existing`,
      data: input,
    });
    return data;
  },
  revoke: async (customerId: string, customerUserId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/customers/${customerId}/portal-users/${customerUserId}` });
  },
};
