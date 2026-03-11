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
    // Usar usercontent.google.com que es más directo
    const driveRes = await fetch(
      `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const contentType = driveRes.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({
          error:
            "El archivo de Drive debe ser público. Ve a Drive → clic derecho en el video → Compartir → 'Cualquiera con el enlace puede ver'.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!driveRes.ok) {
      return new Response(
        JSON.stringify({ error: `Error Drive (${driveRes.status})` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Streaming directo — sin cargar el archivo completo en memoria
    return new Response(driveRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType.includes("video") || contentType.includes("audio")
          ? contentType
          : "video/mp4",
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
