export const maxDuration = 60;

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta ANTHROPIC_API_KEY" }), { status: 500 });
    }
    const body = await request.json();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
