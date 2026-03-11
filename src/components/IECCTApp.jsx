"use client";
import { useState, useRef, useCallback } from "react";

// ── Extraer ID de Google Drive ────────────────────────────────────────────────
function extractDriveId(url) {
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

// ── Extraer audio del video como WAV 16kHz mono (en el navegador, sin red) ───
async function extractAudioAsWav(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const numSamples = audioBuffer.length;
  const numChannels = audioBuffer.numberOfChannels;
  const monoData = new Float32Array(numSamples);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < numSamples; i++) monoData[i] += channelData[i] / numChannels;
  }

  const pcm = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, monoData[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const dataSize = pcm.byteLength;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, dataSize, true);
  new Int16Array(wavBuffer, 44).set(pcm);

  return new File([wavBuffer], "audio.wav", { type: "audio/wav" });
}

// ── Extraer frames para análisis visual ──────────────────────────────────────
async function extractFrames(file, count = 5) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.onloadedmetadata = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const frames = [];
      const step = video.duration / (count + 1);
      for (let i = 1; i <= count; i++) {
        await new Promise((res) => {
          video.currentTime = step * i;
          video.onseeked = () => { ctx.drawImage(video, 0, 0, 320, 240); frames.push(canvas.toDataURL("image/jpeg", 0.55).split(",")[1]); res(); };
        });
      }
      URL.revokeObjectURL(video.src);
      resolve(frames);
    };
    video.onerror = () => resolve([]);
    video.load();
  });
}

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(messages, system, maxTokens = 900) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Error Anthropic ${res.status}`); }
  const d = await res.json();
  return d.content.map((b) => b.text || "").join("");
}

async function analyzeVisualPresence(frames) {
  if (!frames.length) return 2.5;
  let hits = 0;
  for (const frame of frames.slice(0, 3)) {
    try {
      const r = await callClaude([{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame } },
        { type: "text", text: "¿Hay un rostro humano visible mirando hacia la cámara en esta imagen de teleconsulta médica? Responde SOLO: SI o NO." },
      ]}], undefined, 10);
      if (/^s[ií]/i.test(r.trim())) hits++;
    } catch { /* omitir */ }
  }
  return +((hits / Math.min(frames.length, 3)) * 5).toFixed(1);
}

async function evaluateWarmth(transcription) {
  const raw = await callClaude([{ role: "user", content:
    `Transcripción de teleconsulta médica en El Salvador:
"${transcription}"
Evalúa calidez con instrumento IECCT-SV. Puntaje 1-5 por criterio.
Responde SOLO JSON válido, sin texto extra ni markdown:
{"acomodacion":0,"validacion":0,"cierre":0,"analisis_resumen":"2-3 oraciones","aspectos_positivos":["a","b"],"areas_mejora":["a","b"]}`
  }],
  `Eres auditor de salud pública de El Salvador especializado en calidez de teleconsultas IECCT-SV. Responde ÚNICAMENTE JSON válido.`, 900);
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ── Groq directo desde navegador (soporta CORS) ───────────────────────────────
async function transcribeWithGroq(audioFile, apiKey) {
  const form = new FormData();
  form.append("file", audioFile, audioFile.name);
  form.append("model", "whisper-large-v3");
  form.append("language", "es");
  form.append("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Error Groq (${res.status}) — verifica tu API Key`);
  }
  return (await res.json()).text;
}

// ── OpenAI directo desde navegador ───────────────────────────────────────────
async function transcribeWithOpenAI(audioFile, apiKey) {
  const form = new FormData();
  form.append("file", audioFile, audioFile.name);
  form.append("model", "whisper-1");
  form.append("language", "es");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Error OpenAI (${res.status})`);
  }
  return (await res.json()).text;
}

// ── Google Drive vía proxy Vercel (necesario por CORS de Drive) ───────────────
async function fetchFromDrive(driveUrl) {
  const id = extractDriveId(driveUrl);
  if (!id) throw new Error("Link de Google Drive inválido.");
  const res = await fetch(`/api/drive?id=${id}`);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error || "No se pudo descargar el archivo de Drive. Verifica que sea público.");
  }
  const blob = await res.blob();
  return new File([blob], "teleconsulta.mp4", { type: blob.type || "video/mp4" });
}

// ── Web Speech API ────────────────────────────────────────────────────────────
function startWebSpeech(onPartial, onFinal, onError) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError("Usa Chrome o Edge para el micrófono."); return null; }
  const r = new SR();
  r.lang = "es-SV"; r.continuous = true; r.interimResults = true;
  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
      else interim += e.results[i][0].transcript;
    }
    onPartial(finalText, interim);
  };
  r.onend = () => onFinal(finalText.trim());
  r.onerror = (e) => onError(e.error);
  r.start();
  return r;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScoreBar({ label, value, icon }) {
  const c = value >= 4 ? "#34d399" : value >= 2.5 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>{icon} {label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: c, fontFamily: "monospace" }}>{value}/5</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${(value / 5) * 100}%`, height: "100%", background: c, borderRadius: 99, transition: "width 1.1s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

function StepRow({ num, label, status, detail }) {
  const c = { done: "#34d399", active: "#38bdf8", idle: "#2d3748" }[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${c}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: c, flexShrink: 0, background: status === "done" ? "rgba(52,211,153,0.1)" : "transparent", transition: "all 0.4s" }}>
        {status === "done" ? "✓" : num}
      </div>
      <div>
        <span style={{ fontSize: 13, color: status === "idle" ? "#3d4f6b" : "#e2e8f0" }}>
          {status === "active" && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", marginRight: 7, animation: "blink 1s infinite" }} />}
          {label}
        </span>
        {detail && <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const STEP_LABELS = [
  "Obteniendo video",
  "Extrayendo fotogramas",
  "Analizando presencia visual (IA)",
  "Extrayendo audio del video",
  "Transcribiendo audio",
  "Evaluando calidez (Claude)",
  "Compilando informe",
];

export default function IECCTApp() {
  const [screen, setScreen] = useState("upload");
  const [videoFile, setVideoFile] = useState(null);
  const [driveLink, setDriveLink] = useState("");
  const [txMode, setTxMode] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [manualTx, setManualTx] = useState("");
  const [speechFinal, setSpeechFinal] = useState("");
  const [speechInterim, setSpeechInterim] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepDetails, setStepDetails] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const srRef = useRef(null);

  const setStep = useCallback((i, s, detail) => {
    setSteps((p) => { const n = [...p]; n[i] = { ...n[i], status: s }; return n; });
    if (detail !== undefined) setStepDetails((p) => ({ ...p, [i]: detail }));
  }, []);

  const startListening = () => {
    setSpeechFinal(""); setSpeechInterim("");
    srRef.current = startWebSpeech(
      (fin, int) => { setSpeechFinal(fin); setSpeechInterim(int); },
      (fin) => { setSpeechFinal(fin); setIsListening(false); },
      (e) => { setSpeechInterim("❌ " + e); setIsListening(false); },
    );
    if (srRef.current) setIsListening(true);
  };
  const stopListening = () => { srRef.current?.stop(); setIsListening(false); };

  const handleProcess = async () => {
    setError(null);
    setStepDetails({});
    setSteps(STEP_LABELS.map((label, i) => ({ label, status: i === 0 ? "active" : "idle" })));
    setScreen("processing");

    try {
      // Paso 0: obtener video
      let file = videoFile;
      if (!file && driveLink.trim()) {
        file = await fetchFromDrive(driveLink.trim());
      }
      if (!file) throw new Error("Selecciona un video o pega un link de Google Drive.");
      setStep(0, "done"); setStep(1, "active");

      // Paso 1: frames
      const frames = await extractFrames(file);
      setStep(1, "done"); setStep(2, "active");

      // Paso 2: presencia visual
      const noVerbal = await analyzeVisualPresence(frames);
      setStep(2, "done");

      // Pasos 3-4: transcripción
      let tx = "";
      if (txMode === "manual") {
        tx = manualTx.trim();
        if (!tx) throw new Error("Escribe o pega la transcripción.");
        setStep(3, "done"); setStep(4, "done");
      } else if (txMode === "webspeech") {
        tx = speechFinal.trim();
        if (!tx) throw new Error("Graba el audio con el micrófono antes de analizar.");
        setStep(3, "done"); setStep(4, "done");
      } else {
        if (!apiKey.trim()) throw new Error(`Pega tu API Key de ${txMode === "groq" ? "Groq" : "OpenAI"}.`);

        // Extraer audio localmente — el WAV resultante es mucho más pequeño
        setStep(3, "active");
        let audioFile;
        try {
          audioFile = await extractAudioAsWav(file);
          const mb = (audioFile.size / 1024 / 1024).toFixed(1);
          setStep(3, "done", `Audio: ${mb} MB (WAV 16kHz)`);
        } catch {
          audioFile = file; // fallback: usar archivo original
          setStep(3, "done", "Usando archivo original");
        }

        // Llamar directamente a Groq/OpenAI desde el navegador
        setStep(4, "active");
        if (txMode === "groq") {
          tx = await transcribeWithGroq(audioFile, apiKey.trim());
        } else {
          tx = await transcribeWithOpenAI(audioFile, apiKey.trim());
        }
        setStep(4, "done");
      }

      // Paso 5: calidez
      setStep(5, "active");
      const verbal = await evaluateWarmth(tx);
      setStep(5, "done"); setStep(6, "active");

      // Paso 6: compilar
      const domVerbal = +((verbal.acomodacion + verbal.validacion + verbal.cierre) / 3).toFixed(1);
      const total = +((domVerbal + noVerbal) / 2).toFixed(1);
      const grade = total >= 4.5 ? "Excelente" : total >= 3.5 ? "Bueno" : total >= 2.5 ? "Regular" : "Necesita Mejora";
      setResults({ verbal, noVerbal, domVerbal, total, grade, transcription: tx });
      setStep(6, "done");
      setTimeout(() => setScreen("results"), 600);
    } catch (e) {
      setError(e.message || "Error inesperado.");
      setScreen("upload");
    }
  };

  const reset = () => {
    setScreen("upload"); setVideoFile(null); setDriveLink("");
    setSpeechFinal(""); setSpeechInterim(""); setManualTx("");
    setResults(null); setError(null); setSteps([]); setStepDetails({});
  };

  const downloadReport = () => {
    if (!results) return;
    const r = results;
    const blob = new Blob([[
      "══════════════════════════════════════",
      "    REPORTE IECCT-SV AI — AUDITORÍA",
      "══════════════════════════════════════",
      `Fecha: ${new Date().toLocaleDateString("es-SV")}`,
      "", `Puntaje Total:        ${r.total}/5  (${r.grade})`,
      `Dominio Verbal:       ${r.domVerbal}/5`,
      `Presencia Visual:     ${r.noVerbal}/5`,
      "", `  Acomodación:        ${r.verbal.acomodacion}/5`,
      `  Validación emoc.:   ${r.verbal.validacion}/5`,
      `  Cierre/Compromiso:  ${r.verbal.cierre}/5`,
      "", "── ANÁLISIS ──────────────────────────",
      r.verbal.analisis_resumen, "",
      "Aspectos positivos:", ...(r.verbal.aspectos_positivos || []).map((a) => "  + " + a),
      "", "Áreas de mejora:", ...(r.verbal.areas_mejora || []).map((a) => "  - " + a),
      "", "── TRANSCRIPCIÓN ─────────────────────", r.transcription,
      "", "Generado por IECCT-SV AI Auditor",
    ].join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `Reporte_IECCT_${new Date().toISOString().slice(0, 10)}.txt`; a.click();
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  const bg = { minHeight: "100vh", padding: "18px 14px", background: "linear-gradient(160deg,#060d1a,#0c1628 55%,#0a1220)", fontFamily: "'Inter',sans-serif", color: "#e2e8f0" };
  const card = (x = {}) => ({ background: "rgba(12,22,46,0.9)", border: "1px solid rgba(56,189,248,0.11)", borderRadius: 17, padding: "20px 18px", marginBottom: 12, ...x });
  const inp = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 11, padding: "11px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" };
  const btnP = (x = {}) => ({ width: "100%", padding: "14px", borderRadius: 13, border: "none", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", ...x });
  const lbl = { fontSize: 10, color: "#3d5068", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace", marginBottom: 12, display: "block" };

  const TX_OPTIONS = [
    { id: "groq", icon: "⚡", title: "Groq", sub: "Gratis · Whisper v3" },
    { id: "webspeech", icon: "🎤", title: "Micrófono", sub: "Chrome · Gratis" },
    { id: "openai", icon: "🤖", title: "OpenAI", sub: "$0.006/min" },
    { id: "manual", icon: "✍️", title: "Manual", sub: "Pegar texto" },
  ];

  const KEY_HELP = {
    groq: { color: "#34d399", badge: "✅ 600 min/día GRATIS · Whisper Large v3 · Llamada directa al navegador", placeholder: "gsk_...", steps: ["Ve a console.groq.com", "Crea cuenta gratis (Google o email)", "Menú → API Keys → Create API Key", "La key empieza con gsk_"] },
    openai: { color: "#38bdf8", badge: "💳 De pago · $0.006/min · Alta precisión", placeholder: "sk-...", steps: ["Ve a platform.openai.com", "Inicia sesión → API Keys → Create new secret key", "La key empieza con sk-"] },
  };

  // ── Processing ────────────────────────────────────────────────────────────────
  if (screen === "processing") return (
    <div style={bg}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", paddingTop: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 38 }}>🔬</div>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: "8px 0 4px", color: "#38bdf8" }}>Analizando Teleconsulta</h2>
          <p style={{ fontSize: 12, color: "#3d5068", margin: 0 }}>Procesando · 2–4 minutos</p>
        </div>
        <div style={card()}>
          {steps.map((s, i) => <StepRow key={i} num={i + 1} label={s.label} status={s.status} detail={stepDetails[i]} />)}
        </div>
      </div>
    </div>
  );

  // ── Results ───────────────────────────────────────────────────────────────────
  if (screen === "results" && results) {
    const gc = results.total >= 4.5 ? "#34d399" : results.total >= 3.5 ? "#fbbf24" : results.total >= 2.5 ? "#fb923c" : "#f87171";
    return (
      <div style={bg}>
        <style>{`details summary::-webkit-details-marker{display:none}`}</style>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#38bdf8", fontFamily: "monospace", letterSpacing: 2, marginBottom: 5 }}>RESULTADO FINAL</div>
            <div style={{ fontSize: 68, fontWeight: 900, color: gc, lineHeight: 1 }}>{results.total}<span style={{ fontSize: 28, color: "#2d3f55" }}>/5</span></div>
            <div style={{ fontSize: 20, fontWeight: 700, color: gc }}>{results.grade}</div>
          </div>
          <div style={card()}>
            <span style={lbl}>Puntajes</span>
            <ScoreBar label="Dominio Verbal" value={results.domVerbal} icon="🗣️" />
            <ScoreBar label="Presencia Visual" value={results.noVerbal} icon="👁️" />
            <ScoreBar label="Acomodación del lenguaje" value={results.verbal.acomodacion} icon="🤝" />
            <ScoreBar label="Validación emocional" value={results.verbal.validacion} icon="❤️" />
            <ScoreBar label="Cierre y compromiso" value={results.verbal.cierre} icon="✅" />
          </div>
          <div style={card()}>
            <span style={lbl}>Análisis de la IA</span>
            <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, margin: "0 0 14px" }}>{results.verbal.analisis_resumen}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>✦ POSITIVOS</div>
                {(results.verbal.aspectos_positivos || []).map((a, i) => <div key={i} style={{ fontSize: 12, color: "#7d95b0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>• {a}</div>)}
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>◆ MEJORAS</div>
                {(results.verbal.areas_mejora || []).map((a, i) => <div key={i} style={{ fontSize: 12, color: "#7d95b0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>• {a}</div>)}
              </div>
            </div>
          </div>
          <details style={card({ cursor: "pointer" })}>
            <summary style={{ fontSize: 12, color: "#3d5068", userSelect: "none", listStyle: "none" }}>▶ Ver transcripción utilizada</summary>
            <p style={{ fontSize: 12, color: "#7d95b0", lineHeight: 1.8, marginTop: 10, maxHeight: 150, overflowY: "auto" }}>{results.transcription}</p>
          </details>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button onClick={downloadReport} style={btnP({ background: "linear-gradient(135deg,#059669,#10b981)" })}>📄 Descargar Reporte</button>
            <button onClick={reset} style={btnP({ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" })}>↩ Nueva Auditoría</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload ────────────────────────────────────────────────────────────────────
  const canSubmit = (videoFile || driveLink.trim()) &&
    (txMode === "manual" ? manualTx.trim() : txMode === "webspeech" ? speechFinal.trim() : apiKey.trim());

  return (
    <div style={bg}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap');
        input::placeholder,textarea::placeholder{color:#2d3f55}
        details summary::-webkit-details-marker{display:none}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
      `}</style>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 99, padding: "5px 13px", marginBottom: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "monospace", letterSpacing: 1.2 }}>IECCT-SV · El Salvador</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 800, margin: "0 0 4px", background: "linear-gradient(135deg,#e2e8f0 30%,#5a7a9a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Auditoría de Calidez IA
          </h1>
          <p style={{ fontSize: 11, color: "#3d5068", margin: 0 }}>Evaluación automática de teleconsultas · Funciona en cualquier dispositivo</p>
        </div>

        {error && <div style={{ background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 11, padding: "10px 14px", marginBottom: 12, color: "#fca5a5", fontSize: 13 }}>⚠️ {error}</div>}

        {/* Card 1: Video */}
        <div style={card()}>
          <span style={lbl}>1 · Cargar Video</span>
          <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${videoFile ? "#34d399" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "22px 16px", textAlign: "center", cursor: "pointer", background: videoFile ? "rgba(52,211,153,0.04)" : "transparent", transition: "all 0.2s", marginBottom: 10 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{videoFile ? "🎬" : "📁"}</div>
            <div style={{ fontSize: 13, color: videoFile ? "#34d399" : "#4a6070" }}>{videoFile ? videoFile.name : "Haz clic para seleccionar tu video"}</div>
            {videoFile ? <div style={{ fontSize: 11, color: "#3d5068", marginTop: 2 }}>{(videoFile.size / 1024 / 1024).toFixed(0)} MB — audio extraído automáticamente</div> : <div style={{ fontSize: 11, color: "#263549", marginTop: 2 }}>MP4 · MOV · WebM · cualquier tamaño</div>}
          </div>
          <input ref={fileRef} type="file" accept="video/*,audio/*" style={{ display: "none" }} onChange={(e) => { setVideoFile(e.target.files[0] || null); setDriveLink(""); }} />
          <div style={{ textAlign: "center", fontSize: 11, color: "#263549", margin: "8px 0" }}>— o Google Drive —</div>
          <input style={inp} placeholder="https://drive.google.com/file/d/..." value={driveLink} onChange={(e) => { setDriveLink(e.target.value); setVideoFile(null); }} />
          <div style={{ fontSize: 11, color: "#263549", marginTop: 5 }}>💡 Drive: Compartir → "Cualquiera con el enlace puede ver"</div>
        </div>

        {/* Card 2: Transcripción */}
        <div style={card()}>
          <span style={lbl}>2 · Transcripción del Audio</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
            {TX_OPTIONS.map((m) => (
              <button key={m.id} onClick={() => { setTxMode(m.id); setShowKeyHelp(false); }} style={{ padding: "9px 6px", borderRadius: 10, border: `1px solid ${txMode === m.id ? "#38bdf8" : "rgba(255,255,255,0.08)"}`, background: txMode === m.id ? "rgba(56,189,248,0.09)" : "rgba(255,255,255,0.02)", color: txMode === m.id ? "#38bdf8" : "#3d5068", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 18 }}>{m.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{m.title}</div>
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {(txMode === "groq" || txMode === "openai") && (() => {
            const h = KEY_HELP[txMode];
            return (
              <div>
                <div style={{ background: `${h.color}12`, border: `1px solid ${h.color}25`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: h.color }}>{h.badge}</div>
                <input style={inp} type="password" placeholder={h.placeholder + " (API Key)"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                <button onClick={() => setShowKeyHelp(!showKeyHelp)} style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 11, cursor: "pointer", marginTop: 6, padding: 0 }}>
                  {showKeyHelp ? "▲" : "▼"} ¿Cómo obtengo la API Key?
                </button>
                {showKeyHelp && (
                  <div style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.12)", borderRadius: 10, padding: "10px 12px", marginTop: 8, fontSize: 12, color: "#7d95b0", lineHeight: 1.9 }}>
                    {h.steps.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
                  </div>
                )}
              </div>
            );
          })()}

          {txMode === "webspeech" && (
            <div>
              <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10, padding: "8px 12px", marginBottom: 11, fontSize: 12, color: "#d4a944" }}>
                💡 Haz clic en <strong>Grabar</strong>, reproduce el video con volumen activo.
              </div>
              {(speechFinal || speechInterim || isListening) && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, minHeight: 50, maxHeight: 120, overflowY: "auto", fontSize: 12, lineHeight: 1.7 }}>
                  <span style={{ color: "#cbd5e1" }}>{speechFinal}</span>
                  <span style={{ color: "#3d5068", fontStyle: "italic" }}>{speechInterim}</span>
                  {isListening && !speechFinal && !speechInterim && <span style={{ color: "#3d5068" }}>Escuchando <span style={{ animation: "blink 1s infinite", display: "inline-block" }}>●</span></span>}
                </div>
              )}
              <button onClick={isListening ? stopListening : startListening} style={{ padding: "12px", width: "100%", borderRadius: 11, border: `1px solid ${isListening ? "rgba(239,68,68,0.3)" : "rgba(56,189,248,0.22)"}`, background: isListening ? "rgba(239,68,68,0.12)" : "rgba(56,189,248,0.1)", color: isListening ? "#f87171" : "#38bdf8", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                {isListening ? "⏹ Detener grabación" : "🎤 Iniciar grabación"}
              </button>
              {speechFinal && !isListening && <div style={{ fontSize: 11, color: "#34d399", marginTop: 7, textAlign: "center" }}>✓ {speechFinal.trim().split(/\s+/).length} palabras capturadas</div>}
            </div>
          )}

          {txMode === "manual" && (
            <textarea style={{ ...inp, minHeight: 130, resize: "vertical" }} placeholder="Pega aquí la transcripción completa de la teleconsulta..." value={manualTx} onChange={(e) => setManualTx(e.target.value)} />
          )}
        </div>

        <button onClick={handleProcess} disabled={!canSubmit} style={btnP({ opacity: canSubmit ? 1 : 0.3, cursor: canSubmit ? "pointer" : "not-allowed" })}>
          🚀 INICIAR ANÁLISIS DE IA
        </button>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#1c2a3a" }}>🔒 Audio extraído localmente · No se almacena el video · Claude AI</div>
      </div>
    </div>
  );
}
