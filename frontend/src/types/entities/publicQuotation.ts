export interface PublicQuotationItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
}

export interface PublicQuotation {
  quotationNumber: string;
  status: 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  validUntil: string | null;
  createdAt: string;
  items: PublicQuotationItem[];
  customer: { name: string };
  company: { name: string; logo: string | null; email: string | null; phone: string | null; website: string | null };
}
