import { describe, it, expect } from 'vitest';
import { htmlToPlainText, extractStructured } from './gofundme-parse';

describe('htmlToPlainText', () => {
  it('convierte div/p/br en saltos de línea y limpia tags', () => {
    const html =
      '<div>Hola <b>mundo</b></div><div><br /></div><p>Segundo&nbsp;párrafo</p>';
    expect(htmlToPlainText(html)).toBe('Hola mundo\n\nSegundo párrafo');
  });

  it('colapsa 3+ saltos en máximo 2 y hace trim', () => {
    expect(htmlToPlainText('<div>a</div><br/><br/><br/><div>b</div>')).toBe(
      'a\n\nb',
    );
  });

  it('cadena vacía o sin contenido devuelve string vacío', () => {
    expect(htmlToPlainText('<div></div>')).toBe('');
  });
});

describe('extractStructured', () => {
  const slug = 'demo';
  const url = `https://www.gofundme.com/f/${slug}`;

  function pageWith(fundraiser: Record<string, unknown>): string {
    const data = { props: { pageProps: { apollo: { fundraiser } } } };
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      data,
    )}</script>`;
  }

  it('extrae descripción completa, fecha y montos de la entidad Fundraiser', () => {
    const html = pageWith({
      __typename: 'Fundraiser',
      title: 'Ayuda a la familia',
      defaultSlug: slug,
      fundraiserImageUrl: 'https://img/x.jpg',
      currentAmount: { amount: 1500, currencyCode: 'USD' },
      goalAmount: { amount: 5000, currencyCode: 'USD' },
      publishedAt: '2026-06-27T04:09:33.000-05:00',
      createdAt: '2026-06-20T00:00:00.000-05:00',
      'description({"excerpt":false})': '<div>Historia <b>completa</b> aquí.</div>',
      'description({"excerpt":true})': 'Resumen corto',
    });

    const result = extractStructured(html, url);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Ayuda a la familia');
    expect(result!.description).toBe('Historia completa aquí.');
    expect(result!.gofundme_created_at).toBe('2026-06-27T04:09:33.000-05:00');
    expect(result!.raised_amount).toBe(1500);
    expect(result!.goal_amount).toBe(5000);
    expect(result!.currency).toBe('USD');
  });

  it('usa createdAt si no hay publishedAt; excerpt:true si no hay excerpt:false', () => {
    const html = pageWith({
      __typename: 'Fundraiser',
      defaultSlug: slug,
      currentAmount: { amount: 10, currencyCode: 'EUR' },
      createdAt: '2026-05-01T00:00:00.000Z',
      'description({"excerpt":true})': 'Solo resumen',
    });

    const result = extractStructured(html, url);
    expect(result!.gofundme_created_at).toBe('2026-05-01T00:00:00.000Z');
    expect(result!.description).toBe('Solo resumen');
  });

  it('devuelve null si no hay __NEXT_DATA__ o no hay Fundraiser con monto', () => {
    expect(extractStructured('<html></html>', url)).toBeNull();
  });
});
