export const maxDuration = 60; // Vercel max timeout en segundos

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const provider = formData.get("provider"); // "groq" o "openai"
    const apiKey = formData.get("apiKey");

    if (!file || !apiKey) {
      return new Response(JSON.stringify({ error: "Faltan parámetros: file y apiKey son requeridos." }), { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file);
    upstreamForm.append("language", "es");
    upstreamForm.append("response_format", "json");

    let url;
    if (provider === "openai") {
      url = "https://api.openai.com/v1/audio/transcriptions";
      upstreamForm.append("model", "whisper-1");
    } else {
      // groq por defecto
      url = "https://api.groq.com/openai/v1/audio/transcriptions";
      upstreamForm.append("model", "whisper-large-v3");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data?.error?.message || `Error ${provider} (${res.status})` }),
        { status: res.status }
      );
    }

    return new Response(JSON.stringify({ text: data.text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
