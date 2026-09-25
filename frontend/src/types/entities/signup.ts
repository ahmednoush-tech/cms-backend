export interface SignupInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface SignupResult {
  companyId: string;
  companyName: string;
  userId: string;
  email: string;
}
