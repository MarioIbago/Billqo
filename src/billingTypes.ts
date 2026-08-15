export type BillingTicketStatus = 'pending' | 'invoiced' | 'not_required';

export interface BillingIdentifier {
  key: string;
  value: string;
}

export interface BillingFileRef {
  fileId: string;
  webViewUrl?: string;
  name?: string;
  mimeType?: string;
}

export interface BillingTicket {
  id: string;
  merchant: string;
  issuerRfc?: string;
  date: string;
  time?: string;
  total: number;
  subtotal?: number;
  iva?: number;
  currency: string;
  paymentMethod?: string;
  cardLast4?: string;
  identifiers: BillingIdentifier[];
  invoiceUrl?: string;
  qrData?: string;
  image?: BillingFileRef;
  status: BillingTicketStatus;
  cfdiUuid?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalProfile {
  rfc: string;
  legalName: string;
  postalCode: string;
  taxRegime: string;
  cfdiUse: string;
  email?: string;
  updatedAt: string;
}

export interface CfdiRecord {
  uuid: string;
  ticketId?: string;
  version: string;
  series?: string;
  folio?: string;
  issuedAt: string;
  currency?: string;
  subtotal?: number;
  discount?: number;
  total: number;
  paymentForm?: string;
  paymentMethod?: string;
  placeOfIssue?: string;
  issuerRfc: string;
  issuerName?: string;
  issuerTaxRegime?: string;
  receiverRfc: string;
  receiverName?: string;
  receiverPostalCode?: string;
  receiverTaxRegime?: string;
  cfdiUse?: string;
  transferredTaxes?: number;
  withheldTaxes?: number;
  xml: BillingFileRef;
  pdf?: BillingFileRef;
  createdAt: string;
}

export interface BillingSnapshot {
  tickets: BillingTicket[];
  fiscalProfile?: FiscalProfile;
  cfdis: CfdiRecord[];
  syncedAt: string;
}

export interface BillingTicketScanResult {
  merchant: string | null;
  issuerRfc: string | null;
  date: string | null;
  time: string | null;
  total: number | null;
  subtotal: number | null;
  iva: number | null;
  currency: string | null;
  paymentMethod: string | null;
  cardLast4: string | null;
  identifiers: BillingIdentifier[];
  invoiceUrl: string | null;
  qrData: string | null;
  confidence: number;
  warnings: string[];
}

export type BillingTicketInput = Omit<BillingTicket, 'id' | 'createdAt' | 'updatedAt' | 'cfdiUuid'> & {
  image?: BillingFileRef;
};
