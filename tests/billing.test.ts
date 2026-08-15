import { describe, expect, it } from 'vitest';
import { columnLabel } from '../server/billingSheets';
import { parseCfdi40Xml } from '../server/cfdi';

const cfdi = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="A" Folio="123" Fecha="2026-08-15T12:00:00" FormaPago="04" SubTotal="100.00" Moneda="MXN" Total="116.00" MetodoPago="PUE" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="COMERCIO DEMO" RegimenFiscal="601" />
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="CLIENTE DEMO" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="605" UsoCFDI="G03" />
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Compra" ValorUnitario="100.00" Importe="100.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados><cfdi:Traslado Base="100.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="16.00" /></cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="16.00">
    <cfdi:Traslados><cfdi:Traslado Base="100.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="16.00" /></cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="12345678-1234-ABCD-9876-1234567890AB" FechaTimbrado="2026-08-15T12:00:01" RfcProvCertif="AAA010101AAA" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe('billing storage helpers', () => {
  it('converts spreadsheet columns past Z correctly', () => {
    expect(columnLabel(1)).toBe('A');
    expect(columnLabel(26)).toBe('Z');
    expect(columnLabel(27)).toBe('AA');
    expect(columnLabel(28)).toBe('AB');
    expect(() => columnLabel(0)).toThrow();
  });
});

describe('CFDI 4.0 parser', () => {
  it('extracts the fiscal identity, UUID, totals and top-level tax summary', () => {
    const result = parseCfdi40Xml(Buffer.from(cfdi));
    expect(result).toEqual(expect.objectContaining({
      uuid: '12345678-1234-ABCD-9876-1234567890AB',
      version: '4.0',
      series: 'A',
      folio: '123',
      currency: 'MXN',
      total: 116,
      subtotal: 100,
      transferredTaxes: 16,
      issuerRfc: 'AAA010101AAA',
      receiverRfc: 'BBB010101BBB',
      receiverPostalCode: '64000',
      receiverTaxRegime: '605',
      cfdiUse: 'G03',
    }));
  });

  it('rejects a document without a fiscal UUID', () => {
    const withoutUuid = cfdi.replace(' UUID="12345678-1234-ABCD-9876-1234567890AB"', '');
    expect(() => parseCfdi40Xml(Buffer.from(withoutUuid))).toThrow('UUID');
  });

  it('rejects CFDI versions other than 4.0', () => {
    const oldVersion = cfdi.replace('Version="4.0"', 'Version="3.3"');
    expect(() => parseCfdi40Xml(Buffer.from(oldVersion))).toThrow('versión 4.0');
  });
});
