import type { CfdiRecord } from '../src/billingTypes';
import { errors } from './errors';

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function findTag(xml: string, localName: string): string | undefined {
  const pattern = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>`, 'i');
  return xml.match(pattern)?.[0];
}

function attributes(tag: string | undefined): Record<string, string> {
  if (!tag) return {};
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    const rawName = match[1] ?? '';
    const name = rawName.includes(':') ? rawName.split(':').at(-1)! : rawName;
    result[name] = decodeXml(match[2] ?? match[3] ?? '');
  }
  return result;
}

function number(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw errors.validation(`El XML CFDI no contiene ${label}.`);
  return value.trim();
}

export interface ParsedCfdi extends Omit<CfdiRecord, 'ticketId' | 'xml' | 'pdf' | 'createdAt'> {}

export function parseCfdi40Xml(buffer: Buffer): ParsedCfdi {
  if (!Buffer.isBuffer(buffer) || buffer.length < 80) throw errors.validation('El archivo XML está vacío o no es válido.');
  if (buffer.length > 5 * 1024 * 1024) throw errors.validation('El XML CFDI es demasiado grande.');
  const xml = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!xml.startsWith('<')) throw errors.validation('Selecciona un XML CFDI válido.');

  const comprobante = attributes(findTag(xml, 'Comprobante'));
  const emisor = attributes(findTag(xml, 'Emisor'));
  const receptor = attributes(findTag(xml, 'Receptor'));
  const timbre = attributes(findTag(xml, 'TimbreFiscalDigital'));
  const impuestos = attributes(findTag(xml, 'Impuestos'));

  const version = required(comprobante.Version ?? comprobante.version, 'la versión del comprobante');
  if (version !== '4.0') throw errors.validation('Billqo actualmente importa CFDI versión 4.0.');

  const uuid = required(timbre.UUID ?? timbre.Uuid, 'el UUID del Timbre Fiscal Digital').toUpperCase();
  if (!/^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(uuid)) {
    throw errors.validation('El UUID del CFDI no tiene un formato válido.');
  }

  const total = number(comprobante.Total);
  if (total === undefined || total < 0) throw errors.validation('El XML CFDI no contiene un total válido.');

  return {
    uuid,
    version,
    series: comprobante.Serie || undefined,
    folio: comprobante.Folio || undefined,
    issuedAt: required(comprobante.Fecha, 'la fecha de emisión'),
    currency: comprobante.Moneda || undefined,
    subtotal: number(comprobante.SubTotal),
    discount: number(comprobante.Descuento),
    total,
    paymentForm: comprobante.FormaPago || undefined,
    paymentMethod: comprobante.MetodoPago || undefined,
    placeOfIssue: comprobante.LugarExpedicion || undefined,
    issuerRfc: required(emisor.Rfc, 'el RFC del emisor').toUpperCase(),
    issuerName: emisor.Nombre || undefined,
    issuerTaxRegime: emisor.RegimenFiscal || undefined,
    receiverRfc: required(receptor.Rfc, 'el RFC del receptor').toUpperCase(),
    receiverName: receptor.Nombre || undefined,
    receiverPostalCode: receptor.DomicilioFiscalReceptor || undefined,
    receiverTaxRegime: receptor.RegimenFiscalReceptor || undefined,
    cfdiUse: receptor.UsoCFDI || undefined,
    transferredTaxes: number(impuestos.TotalImpuestosTrasladados),
    withheldTaxes: number(impuestos.TotalImpuestosRetenidos),
  };
}
