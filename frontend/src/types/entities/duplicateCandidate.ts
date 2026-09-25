export type DuplicateMatchField = 'email' | 'phone' | 'companyName';

export interface DuplicateCandidate {
  id: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  customerCode: string;
  matchedOn: DuplicateMatchField[];
}

export interface CheckDuplicatesInput {
  email?: string;
  phone?: string;
  companyName?: string;
  excludeId?: string;
}
