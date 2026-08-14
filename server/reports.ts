import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin';

export const SUPPORT_REPORTS_COLLECTION = 'supportReports';

export type SupportReportCategory = 'bug' | 'idea' | 'other';

export interface SupportReportInput {
  category: SupportReportCategory;
  message: string;
  email?: string;
}

/**
 * Support reports are deliberately written only through the server. Firestore
 * client rules remain closed, so visitors cannot create arbitrary documents or
 * inspect someone else's report.
 */
export async function createSupportReport(input: SupportReportInput): Promise<void> {
  const report = getAdminDb().collection(SUPPORT_REPORTS_COLLECTION).doc();
  await report.create({
    source: 'landing',
    status: 'new',
    category: input.category,
    message: input.message,
    ...(input.email ? { email: input.email.toLowerCase() } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });
}
