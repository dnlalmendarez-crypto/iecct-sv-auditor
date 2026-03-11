# CLAUDE.md — IECCT-SV Auditor

## Project Overview

**IECCT-SV Auditor** is a Next.js web application for automated quality evaluation of medical teleconsultations in El Salvador. It analyzes video recordings using AI to score warmth (calidez) according to the IECCT-SV evaluation framework.

The application is entirely client-heavy: video/audio processing happens in the browser using Web APIs, and results are generated via third-party AI APIs (Anthropic Claude, Groq Whisper, OpenAI Whisper). There is no database, no authentication system, and no persistent storage.

**Language:** All UI text, comments, and variable names are in Spanish (Salvadoran Spanish locale `es-SV`).

---

## Repository Structure

```
iecct-sv-auditor/
├── next.config.js                  # Next.js config (50MB body limit, experimental serverActions)
├── package.json                    # Dependencies: next, react, react-dom only
└── src/
    ├── app/
    │   ├── layout.js               # Root layout — sets lang="es", viewport meta
    │   ├── page.js                 # Entry point — "use client", renders <IECCTApp />
    │   └── api/
    │       ├── drive/route.js      # GET /api/drive — verifies Google Drive access
    │       └── transcribe/route.js # POST /api/transcribe — proxies Groq/OpenAI transcription
    └── components/
        └── IECCTApp.jsx            # Main component — all application logic (~493 lines)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 18 (functional components + hooks) |
| Styling | Inline styles only (no CSS files, no CSS-in-JS libraries) |
| AI — Vision/Text | Anthropic Claude (`claude-sonnet-4-20250514`) called directly from browser |
| AI — Speech-to-text | Groq Whisper v3 (default, free, called directly from browser) |
| AI — Speech-to-text alt | OpenAI Whisper-1 (paid, optional) |
| Audio processing | Web Audio API + OfflineAudioContext (browser-native) |
| Video processing | HTML5 `<video>` + `<canvas>` (browser-native) |
| Live transcription | Web Speech Recognition API (`es-SV` locale) |
| Deployment | Vercel (Edge Runtime for API routes) |

---

## Core Application Flow

```
User uploads video (or Google Drive link)
        │
        ▼
1. Obtain video file
        │
        ├─► Extract 5 video frames (320×240 JPEG)
        │         │
        │         └─► Claude Vision: detect face presence per frame → Visual Presence Score (0–5)
        │
        └─► Extract audio as 8kHz mono WAV (max 20 min → always < 20 MB for Groq)
                  │
                  └─► Transcribe via Groq / OpenAI / Web Speech / Manual paste
                            │
                            └─► Claude text analysis: IECCT-SV warmth evaluation
                                        │
                                        └─► Final Report (scores + download as .txt)
```

### Scoring

- **Presencia Visual (noVerbal):** `(hits / 3 frames analyzed) × 5`
- **Dominio Verbal:** average of `acomodación + validación + cierre` (each 1–5 scored by Claude)
- **Total:** `(domVerbal + noVerbal) / 2`
- **Grade:** Excelente (≥4.5), Bueno (≥3.5), Regular (≥2.5), Necesita Mejora (<2.5)

---

## Key Functions in `IECCTApp.jsx`

| Function | Purpose |
|---|---|
| `extractDriveId(url)` | Parses Google Drive file ID from share URL |
| `extractAudioAsWav(file)` | Resamples audio to 8kHz mono WAV, truncates to 20 min |
| `extractFrames(file, count=5)` | Extracts N evenly-spaced video frames as base64 JPEG |
| `callClaude(messages, system, maxTokens)` | Direct fetch to Anthropic API (no SDK) |
| `analyzeVisualPresence(frames)` | Sends up to 3 frames to Claude Vision, returns score |
| `evaluateWarmth(transcription)` | Sends transcription to Claude, returns parsed JSON evaluation |
| `transcribeWithGroq(audioFile, apiKey)` | Direct Groq API call (supports CORS from browser) |
| `transcribeWithOpenAI(audioFile, apiKey)` | Direct OpenAI API call |
| `fetchFromDrive(driveUrl)` | Verifies via `/api/drive`, then downloads directly from Google |
| `startWebSpeech(onPartial, onFinal, onError)` | Starts Web Speech Recognition in `es-SV` continuous mode |

### UI Components

| Component | Purpose |
|---|---|
| `ScoreBar({ label, value, icon })` | Colored progress bar for scores 1–5 |
| `StepRow({ num, label, status, detail })` | Processing step indicator (idle/active/done) |

### Screens (controlled by `screen` state)

- `"upload"` — Main form: video upload + transcription mode selection
- `"processing"` — Step-by-step progress display
- `"results"` — Score breakdown + download report button

---

## API Routes

### `GET /api/drive?id=<driveFileId>`
- **Runtime:** Edge
- Verifies that a Google Drive file is publicly accessible (checks `content-type` is not `text/html`)
- Returns `{ directUrl }` pointing to `drive.usercontent.google.com` for direct browser download
- Client then downloads the file directly from Google (bypasses Vercel payload limits)

### `POST /api/transcribe`
- **Runtime:** Edge
- **Body:** FormData with `file` (audio), `provider` (`groq`|`openai`), `apiKey`
- Proxies to Groq or OpenAI Whisper with `language: "es"` and `response_format: "json"`
- **Note:** Currently unused in production — Groq is called directly from the browser since it supports CORS. This route exists as a fallback if direct calls are blocked.

---

## Audio Processing Details

Audio is extracted client-side using Web Audio API:
- Resampled to **8 kHz, mono, 16-bit PCM**
- Truncated to **max 20 minutes** (ensures file stays under Groq's 20MB limit)
- Written as a raw WAV file with a manually constructed 44-byte header
- Constants: `SAMPLE_RATE = 8000`, `MAX_SECONDS = 1200`

---

## Claude API Usage

Claude is called **directly from the browser** using a plain `fetch()` to `https://api.anthropic.com/v1/messages`. The Anthropic API key is passed by the user at runtime through the UI — it is never stored anywhere.

Current model: **`claude-sonnet-4-20250514`**

Two distinct calls per analysis:
1. **Vision** (`analyzeVisualPresence`): up to 3 calls, `max_tokens: 10`, expects "SI" or "NO"
2. **Text** (`evaluateWarmth`): 1 call, `max_tokens: 900`, expects valid JSON

The `evaluateWarmth` prompt instructs Claude to respond **only** with valid JSON in this shape:
```json
{
  "acomodacion": 0,
  "validacion": 0,
  "cierre": 0,
  "analisis_resumen": "2-3 sentences",
  "aspectos_positivos": ["a", "b"],
  "areas_mejora": ["a", "b"]
}
```
JSON is parsed with a cleanup step: `raw.replace(/```json|```/g, "").trim()`.

---

## UI Conventions

- **Theme:** Dark (background gradient `#060d1a → #0c1628`)
- **Accent color:** Cyan `#38bdf8`
- **Score colors:** Green `#34d399` (≥4), Amber `#fbbf24` (≥2.5), Red `#f87171` (<2.5)
- **Font:** Inter (body), Space Grotesk 700/800 (headings)
- **All styling:** Inline `style` objects — no external CSS files, no Tailwind, no CSS modules
- **Labels:** Uppercase monospace, `fontSize: 10`, `letterSpacing: 1.5`
- Card helper: `card(extraStyles?)` returns a style object with dark background, cyan border, and border-radius

---

## Transcription Modes

| Mode | Key ID | Description |
|---|---|---|
| Groq Whisper | `groq` | Default. Free (600 min/day). Direct browser call to Groq API. Requires `gsk_...` key |
| OpenAI Whisper | `openai` | Paid ($0.006/min). Direct browser call. Requires `sk-...` key |
| Web Speech | `webspeech` | Free. Browser microphone. Chrome/Edge only. `es-SV` locale |
| Manual | `manual` | Paste transcription text directly |

---

## Development Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
```

No environment variables are required — all API keys are entered by the user at runtime through the UI.

---

## Deployment

The app is optimized for **Vercel**:
- API routes use `export const runtime = "edge"` for global low-latency distribution
- `next.config.js` sets `experimental.serverActions.bodySizeLimit: "50mb"` for large video uploads
- No server-side secrets needed

---

## Testing & Linting

There is currently **no test suite** and **no linter configuration**. The codebase has:
- No Jest, Vitest, or other test runner
- No ESLint config
- No Prettier config
- No pre-commit hooks

When adding tests, prefer **Vitest** + **React Testing Library** as they integrate well with Next.js App Router.

---

## Important Constraints & Gotchas

1. **No Anthropic SDK** — Claude is called via raw `fetch()`. Do not add the `@anthropic-ai/sdk` package without good reason; the current approach avoids a browser bundle dependency.

2. **API keys are user-provided at runtime** — Never add server-side environment variables for user API keys. The existing architecture intentionally keeps keys client-side.

3. **Google Drive downloads bypass the server** — The `/api/drive` route only verifies access, then returns a `directUrl`. The actual download happens browser-to-Google to avoid Vercel's response size limits.

4. **Audio truncation is intentional** — `MAX_SECONDS = 1200` (20 min) keeps WAV files under Groq's 20MB limit. Do not increase this without also increasing file size validation.

5. **All UI is in Spanish** — Keep all user-facing text, error messages, and comments in Spanish. Do not translate to English.

6. **Inline styles only** — Do not introduce CSS files, CSS modules, Tailwind, or styled-components. Maintain the existing inline style pattern.

7. **Client component** — `IECCTApp.jsx` uses browser-only APIs (Web Audio, HTMLVideoElement, Web Speech). It must remain a client component (`"use client"`). Do not add server-side logic to it.

8. **WAV header is hand-written** — The 44-byte WAV header in `extractAudioAsWav` is constructed manually using `DataView`. Do not replace this with a library dependency.
