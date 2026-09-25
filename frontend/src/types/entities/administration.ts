/** Department — fields transcribed exactly from the Prisma model this session. */
export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  managerId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  /** Included on both GET /departments (list) and GET /departments/:id — selected fields only (id, firstName, lastName), not the full Employee record. */
  manager?: { id: string; firstName: string; lastName: string } | null;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  managerId?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  managerId?: string;
  status?: 'active' | 'inactive';
}

/** Employee — fields transcribed exactly from the Prisma model this session. */
export interface Employee {
  id: string;
  companyId: string;
  departmentId: string | null;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  managerId: string | null;
  status: 'active' | 'inactive' | 'terminated';
  basicSalary: string | null;
  housingAllowance: string;
  otherAllowances: string;
  gosiEmployeeRate: string | null;
  gosiEmployerRate: string | null;
  nationality: string | null;
  iqamaNumber: string | null;
  iqamaExpiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Included on both GET /employees (list) and GET /employees/:id — selected fields only (department: id+name; manager: id+firstName+lastName), not the full records. */
  department?: { id: string; name: string } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  user?: { id: string; email: string; status: string } | null;
}

export interface ExpiringIqamaEmployee {
  id: string;
  name: string;
  iqamaNumber: string | null;
  iqamaExpiryDate: string;
  daysRemaining: number;
}

export interface ExpiringIqamasResult {
  expiringCount: number;
  notificationsSent: number;
  employees: ExpiringIqamaEmployee[];
}

export interface CreateEmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  hireDate?: string;
  managerId?: string;
  /** Existing users.id — links at creation time; must not already be linked to another employee. */
  userId?: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  hireDate?: string;
  managerId?: string;
  status?: 'active' | 'inactive' | 'terminated';
  basicSalary?: number;
  housingAllowance?: number;
  otherAllowances?: number;
  gosiEmployeeRate?: number;
  gosiEmployerRate?: number;
  nationality?: string;
  iqamaNumber?: string;
  iqamaExpiryDate?: string;
}

/** User — password_hash is deliberately NOT in this type; the backend never returns it either. */
export interface AdminUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive' | 'locked';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Included only on GET /users/:id (findOne) — never on the list. */
  userRoles?: UserRoleLink[];
  /** Included only on GET /users/:id (findOne) — never on the list. */
  userPermissions?: UserPermissionLink[];
}

export interface UserRoleLink {
  userId: string;
  roleId: string;
  role: { id: string; name: string };
  /** 'company' + the all-zeros sentinel UUID means unscoped (company-wide) — see backend's COMPANY_WIDE_SCOPE_ID. */
  scopeType: string;
  scopeId: string;
}

export interface UserPermissionLink {
  userId: string;
  permissionId: string;
  permission: Permission;
  scopeType: string;
  scopeId: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  /** Plain password, sent once at creation — no update endpoint accepts a password field (confirmed this session, a real backend gap, see Phase 3E report). */
  password: string;
  phone?: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'locked';
}

/** Role — findAll/findOne both include rolePermissions[].permission (confirmed this session). */
export interface Permission {
  id: string;
  module: string;
  resource: string;
  action: string;
}

export interface RolePermissionLink {
  roleId: string;
  permissionId: string;
  permission: Permission;
}

export interface Role {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  rolePermissions: RolePermissionLink[];
  /** Included only on GET /roles/:id (findOne) — never on the list. */
  userRoles?: RoleUserLink[];
}

export interface RoleUserLink {
  userId: string;
  roleId: string;
  user: { id: string; name: string; email: string };
  scopeType: string;
  scopeId: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
}

/** Additive only — the backend upserts each ID, never removes an existing grant not in the list (confirmed this session, no remove-permission endpoint exists). */
export interface AssignPermissionsInput {
  permissionIds: string[];
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  /** Omit both for a normal, unscoped (company-wide) assignment. */
  scopeType?: string;
  scopeId?: string;
}

/** Omit both scope fields for a normal, unscoped (company-wide) grant. */
export interface GrantPermissionInput {
  permissionId: string;
  scopeType?: string;
  scopeId?: string;
}
