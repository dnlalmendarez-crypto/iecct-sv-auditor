export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el ID del archivo" }), { status: 400 });
  }

  try {
    // Intento 1: descarga directa
    let driveRes = await fetch(
      `https://drive.google.com/uc?export=download&id=${id}`,
      { redirect: "follow" }
    );

    // Si Google Drive devuelve página de confirmación (archivos grandes)
    if (driveRes.headers.get("content-type")?.includes("text/html")) {
      const html = await driveRes.text();
      const confirmMatch = html.match(/confirm=([0-9A-Za-z_]+)/);
      const confirm = confirmMatch ? confirmMatch[1] : "t";
      driveRes = await fetch(
        `https://drive.google.com/uc?export=download&id=${id}&confirm=${confirm}`,
        { redirect: "follow" }
      );
    }

    if (!driveRes.ok) {
      return new Response(JSON.stringify({ error: "No se pudo descargar el archivo de Google Drive. Verifica que sea público." }), { status: 400 });
    }

    const contentType = driveRes.headers.get("content-type") || "video/mp4";
    const buffer = await driveRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
