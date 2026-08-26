import { escapeHtml } from './escape-html.util';

describe('escapeHtml (defensa real contra XSS en correos)', () => {
  it('escapa los 5 caracteres reales que pueden inyectar HTML/atributos', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('neutraliza un payload real de XSS completo — el escenario real que motivó esta función', () => {
    // Mismo hallazgo real ya documentado en Bridge/LECCIONES_ARQUITECTURA.md:
    // un "nombre" real capturado en un formulario, interpolado sin escapar
    // en un correo HTML, ejecutaría este script en quien lo abriera.
    const nombreMalicioso = '<img src=x onerror=alert(1)>';
    const resultado = escapeHtml(nombreMalicioso);
    expect(resultado).not.toContain('<img');
    expect(resultado).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('deja intacto el texto real que no tiene ningún caracter especial', () => {
    expect(escapeHtml('Benjamín Zamudio')).toBe('Benjamín Zamudio');
  });

  it('escapa el ampersand ANTES que los demás — evita un doble-escape real (ej. "&lt;" no se vuelve "&amp;lt;")', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
