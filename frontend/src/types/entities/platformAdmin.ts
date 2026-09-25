export interface PlatformAdminLoginResult {
  accessToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PlatformAdminCompanySummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  userCount: number;
  employeeCount: number;
  customerCount: number;
}

export interface PlatformAdminCompanyDetail {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  usage: {
    userCount: number;
    employeeCount: number;
    customerCount: number;
    leadCount: number;
    opportunityCount: number;
    invoiceCount: number;
    projectCount: number;
  };
}
