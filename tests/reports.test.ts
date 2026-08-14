import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, doc, collection } = vi.hoisted(() => ({
  create: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock('../server/firebaseAdmin', () => ({
  getAdminDb: () => ({ collection }),
}));

import { createSupportReport, SUPPORT_REPORTS_COLLECTION } from '../server/reports';

describe('support report storage', () => {
  beforeEach(() => {
    create.mockReset();
    doc.mockReset();
    collection.mockReset();
    doc.mockReturnValue({ create });
    collection.mockReturnValue({ doc });
  });

  it('writes the fixed report shape through Firebase Admin only', async () => {
    await createSupportReport({
      category: 'idea',
      message: 'Sería útil poder adjuntar una captura al reporte.',
      email: 'PERSON@EXAMPLE.COM',
    });

    expect(collection).toHaveBeenCalledWith(SUPPORT_REPORTS_COLLECTION);
    expect(doc).toHaveBeenCalledWith();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      source: 'landing',
      status: 'new',
      category: 'idea',
      message: 'Sería útil poder adjuntar una captura al reporte.',
      email: 'person@example.com',
      createdAt: expect.anything(),
    }));
  });
});
