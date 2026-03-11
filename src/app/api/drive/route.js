export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el ID del archivo" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Intento 1: usercontent.google.com (más confiable para archivos grandes)
    let driveRes = await fetch(
      `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
      {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const contentType = driveRes.headers.get("content-type") || "";

    // Si sigue siendo HTML, intentar con la URL clásica
    if (contentType.includes("text/html")) {
      const html = await driveRes.text();

      // Extraer UUID si existe (archivos grandes de Drive)
      const uuidMatch = html.match(/uuid=([0-9A-Za-z_-]+)/);
      const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);

      let fallbackUrl;
      if (uuidMatch) {
        fallbackUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&uuid=${uuidMatch[1]}`;
      } else if (confirmMatch) {
        fallbackUrl = `https://drive.google.com/uc?export=download&id=${id}&confirm=${confirmMatch[1]}`;
      } else {
        return new Response(
          JSON.stringify({
            error: "El archivo de Google Drive debe ser público. Ve a Drive → clic derecho → Compartir → 'Cualquiera con el enlace puede ver'.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      driveRes = await fetch(fallbackUrl, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
    }

    // Validar que sea un archivo media y no HTML
    const finalType = driveRes.headers.get("content-type") || "video/mp4";
    if (finalType.includes("text/html")) {
      return new Response(
        JSON.stringify({
          error: "No se pudo descargar el archivo. Asegúrate que el archivo sea público en Google Drive.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!driveRes.ok) {
      return new Response(
        JSON.stringify({ error: `Error Drive (${driveRes.status}). Verifica que el archivo sea público.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const buffer = await driveRes.arrayBuffer();

    // Forzar tipo video/mp4 si el content-type es genérico
    const mediaType = finalType.includes("video") || finalType.includes("audio")
      ? finalType
      : "video/mp4";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mediaType,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Error: " + e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
