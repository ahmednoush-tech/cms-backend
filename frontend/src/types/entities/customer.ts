/**
 * Fields transcribed exactly from the Customer/CustomerContact/
 * CustomerUser Prisma models this session — Customers has no
 * dedicated response DTO, the backend returns the raw row.
 */

export interface Customer {
  id: string;
  companyId: string;
  customerType: 'company' | 'individual';
  companyName: string | null;
  customerCode: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  vatRegistrationNumber: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  ownerId: string | null;
  customFields: Record<string, string | number> | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /customers body — matches CreateCustomerDto exactly. */
export interface CreateCustomerInput {
  customerType: 'company' | 'individual';
  companyName?: string;
  customerCode: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  vatRegistrationNumber?: string;
  ownerId?: string;
  customFields?: Record<string, unknown>;
}

/** PATCH /customers/:id body — matches UpdateCustomerDto exactly. */
export interface UpdateCustomerInput {
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  vatRegistrationNumber?: string;
  status?: 'active' | 'inactive' | 'blacklisted';
  ownerId?: string;
  customFields?: Record<string, unknown>;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface CreateCustomerContactInput {
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface UpdateCustomerContactInput extends Partial<CreateCustomerContactInput> {
  status?: 'active' | 'inactive';
}

export interface CustomerPortalUser {
  id: string;
  customerId: string;
  userId: string;
  contactId: string | null;
  status: 'active' | 'inactive';
  user?: { id: string; name: string; email: string; status: string };
}

export interface CreatePortalUserInput {
  name: string;
  email: string;
  password: string;
  contactId?: string;
}

export interface LinkExistingUserInput {
  userId: string;
  contactId?: string;
}
