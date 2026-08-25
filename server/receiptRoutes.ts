import express, { Router } from 'express';
import { z } from 'zod';
import { errors } from './errors';
import { assertReceiptImage } from './receiptScanner';
import { scanFinancialDocumentImage } from './receiptScannerV2';

const router = Router();
const preferredTypeSchema = z.enum(['income', 'expense']).optional();
const categoriesSchema = z.array(z.string().trim().min(1).max(120)).max(50);

function parseCategoriesHeader(value: string | undefined): string[] {
  if (!value) return [];
  if (value.length > 7_000) throw errors.validation('La lista de categorías es demasiado grande.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    throw errors.validation('La lista de categorías no es válida.');
  }

  const result = categoriesSchema.safeParse(parsed);
  if (!result.success) throw errors.validation('La lista de categorías no es válida.');
  return [...new Set(result.data)];
}

router.post('/', express.raw({ type: () => true, limit: '6mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body)) throw errors.validation('No recibimos una imagen válida.');

    const preferredHeader = req.header('X-Billqo-Preferred-Type')?.trim() || undefined;
    const preferredResult = preferredTypeSchema.safeParse(preferredHeader);
    if (!preferredResult.success) throw errors.validation('El tipo de movimiento indicado no es válido.');

    const allowedCategories = parseCategoriesHeader(req.header('X-Billqo-Categories'));
    const mimeType = assertReceiptImage(req.body, req.header('Content-Type'));
    const result = await scanFinancialDocumentImage({
      image: req.body,
      mimeType,
      allowedCategories,
      preferredType: preferredResult.data,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
