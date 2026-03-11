export const runtime = "edge";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "Falta ID" }), { status: 400 });
  try {
    const url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    if ((res.headers.get("content-type") || "").includes("text/html")) {
      return new Response(JSON.stringify({ error: "El archivo debe ser público en Google Drive." }), { status: 400 });
    }
    return new Response(JSON.stringify({ directUrl: url }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}