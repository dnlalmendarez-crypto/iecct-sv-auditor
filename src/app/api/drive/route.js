export const runtime = "edge";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el ID del archivo" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Intentar obtener la URL de descarga directa sin descargar el archivo
    const checkUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

    const headRes = await fetch(checkUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    const contentType = headRes.headers.get("content-type") || "";

    // Si Drive responde con HTML, el archivo no es público
    if (contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({
          error:
            "El archivo debe ser público. Ve a Google Drive → clic derecho en el video → Compartir → 'Cualquiera con el enlace puede ver'.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Devolver la URL directa para que el navegador descargue sin pasar por Vercel
    return new Response(
      JSON.stringify({ directUrl: checkUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Error: " + e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
