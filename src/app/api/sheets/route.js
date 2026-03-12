export const runtime = 'edge';
export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const gid = searchParams.get('gid') || '0';

  if (!id) {
    return Response.json({ error: 'ID de hoja requerido' }, { status: 400 });
  }

  const endpoints = [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${id}/pub?output=csv&gid=${gid}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
        },
        redirect: 'follow',
      });

      if (res.ok) {
        const text = await res.text();
        const trimmed = text.trim();
        if (trimmed.length > 20 && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html') && !trimmed.startsWith('<HTML')) {
          return new Response(text, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
          });
        }
      }
    } catch {
      // try next endpoint
    }
  }

  return Response.json(
    {
      error:
        'No se pudo acceder a la hoja. Para habilitarlo: Archivo → Publicar en la web → Seleccionar hoja → CSV → Publicar.',
    },
    { status: 403 }
  );
}
