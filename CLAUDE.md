# CLAUDE.md — IECCT-SV AI Auditor

## Project Overview

**IECCT-SV AI Auditor** is a single-page web application that evaluates the quality of medical telemedicine consultations using the IECCT-SV methodology. It processes video recordings of consultations, transcribes the audio, analyzes video frames, and scores the interaction on warmth and communication quality.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 18, JSX, inline styles |
| Language | JavaScript (no TypeScript) |
| Transcription | Groq API (Whisper v3), OpenAI API (Whisper-1), Web Speech API |
| AI Analysis | Anthropic Claude API (vision + text) |
| File Storage | Google Drive (external) |
| Runtime | Node.js (API route), Edge (Drive/Transcribe routes) |
| Deployment | Vercel (assumed) |

---

## Directory Structure

```
iecct-sv-auditor/
├── CLAUDE.md                          # This file
├── next.config.js                     # Next.js config (50MB body limit, server actions)
├── package.json                       # Dependencies and scripts
├── .gitignore
└── src/
    ├── app/
    │   ├── layout.js                  # Root HTML layout, lang="es", metadata
    │   ├── page.js                    # Entry page — renders <IECCTApp />
    │   └── api/
    │       ├── claude/route.js        # Proxy: forwards requests to Anthropic API
    │       ├── drive/route.js         # Proxy: validates and returns Google Drive URL
    │       └── transcribe/route.js   # Proxy: optional server-side transcription (Groq/OpenAI)
    └── components/
        └── IECCTApp.jsx              # Main app component (~479 lines, all logic here)
```

---

## Environment Variables

The application requires the following environment variable at runtime:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (server) | Used in `/api/claude/route.js` to authenticate Anthropic API calls |

> Note: Groq and OpenAI API keys are passed directly from the client-side form input and never stored server-side. The `ANTHROPIC_API_KEY` must be set in the server environment (e.g., `.env.local` for development, Vercel environment settings for production).

---

## Development Workflow

### Setup

```bash
npm install
```

### Running Locally

```bash
npm run dev      # Starts dev server on http://localhost:3000
```

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Building for Production

```bash
npm run build
npm start
```

---

## API Routes

### `POST /api/claude`
- **Runtime:** Node.js (required for large request bodies)
- **Purpose:** Server-side proxy for Anthropic Claude API
- **Behavior:** Forwards the full request body to `https://api.anthropic.com/v1/messages`
- **Headers forwarded:** `x-api-key`, `anthropic-version`
- **Max duration:** 60 seconds
- **Why proxied:** Keeps `ANTHROPIC_API_KEY` off the client

### `GET /api/drive?id=<driveId>`
- **Runtime:** Edge
- **Purpose:** Validates Google Drive file access and returns direct download URL
- **Behavior:** Sends a HEAD request to `https://lh3.googleusercontent.com/d/<id>`; returns error if response is HTML (permission denied)
- **Returns:** `{ directUrl }` on success

### `POST /api/transcribe`
- **Runtime:** Edge
- **Purpose:** Optional server-side transcription proxy
- **Parameters:** `file` (audio blob), `provider` (`groq` | `openai`), `apiKey`
- **Note:** Currently not used by `IECCTApp.jsx`; transcription calls are made directly from the browser

---

## Main Component: `IECCTApp.jsx`

All application logic lives in this single component. It manages three UI screens:

1. **Upload screen** — input video file or Google Drive link, enter API keys, select transcription provider
2. **Processing screen** — step-by-step progress display
3. **Results screen** — scores with visual bars and downloadable report

### Key Functions

| Function | Description |
|---|---|
| `extractDriveId(url)` | Parses a Google Drive URL and returns the file ID |
| `extractAudioAsWav(file)` | Converts video/audio to 8kHz mono WAV using Web Audio API (max 20 minutes) |
| `extractFrames(file)` | Extracts 5 evenly-spaced frames from video as base64 PNG using Canvas API |
| `callClaude(messages, apiKey)` | POSTs to `/api/claude` with the given messages array |
| `analyzeVisualPresence(frames, apiKey)` | Sends frames to Claude vision model; scores doctor face presence 0–5 |
| `evaluateWarmth(transcript, apiKey)` | Sends transcript to Claude; evaluates IECCT-SV verbal criteria (scores 1–5 each) |
| `transcribeWithGroq(audioBlob, apiKey)` | Calls Groq API directly from the browser (whisper-large-v3, language=es) |
| `transcribeWithOpenAI(audioBlob, apiKey)` | Calls OpenAI API directly from the browser (whisper-1, language=es) |
| `fetchFromDrive(url)` | Calls `/api/drive` to resolve a Google Drive link to a downloadable URL |
| `startWebSpeech()` | Activates browser Web Speech API for live microphone transcription (Spanish) |
| `downloadReport()` | Generates and triggers download of a `.txt` audit report |

### Sub-components

| Component | Description |
|---|---|
| `ScoreBar` | Renders a labeled progress bar for metric display |
| `StepRow` | Shows status icon (spinner/check/error) and label for a processing step |

---

## IECCT-SV Evaluation Criteria

The app scores consultations on four dimensions:

| Dimension | Spanish Name | Scale |
|---|---|---|
| Language Accommodation | Acomodación | 1–5 |
| Emotional Validation | Validación | 1–5 |
| Closure/Commitment | Cierre | 1–5 |
| Visual Presence | Presencia Visual | 0–5 |

**Final score** = average of verbal domain (Acomodación, Validación, Cierre) and Presencia Visual.

---

## Code Conventions

- **Language:** All UI text and comments are in **Spanish**
- **Styles:** Inline styles only — no CSS files, no CSS modules, no Tailwind classes at build time
- **Color palette:** Dark theme; green `#34d399` (success), blue `#38bdf8` (active), red `#f87171` (error), yellow `#fbbf24` (warning)
- **Hooks:** `useState`, `useRef`, `useCallback` — no context API or external state library
- **Async:** All async operations use `async/await` with `try/catch`
- **Naming:** camelCase; abbreviations like `tx` (transcription), `sr` (speech recognition), `ctx` (audio context)
- **No TypeScript** — plain `.js` and `.jsx` files throughout
- **No tests** — no test framework is configured

---

## Architecture Notes

- The application is **stateless** — no database, no sessions, no persistent storage
- API keys (Groq, OpenAI) are entered by the user at runtime and used directly in browser-side fetch calls
- `ANTHROPIC_API_KEY` is server-only and never exposed to the client
- Video/audio preprocessing happens entirely on the **client side** using Web Audio API and Canvas API
- The `/api/transcribe` route exists but is not currently wired into the UI — transcription goes directly from the browser to Groq/OpenAI
- `next.config.js` sets a 50MB server action body size limit to support large audio payloads through the Claude proxy

---

## Known Limitations / Tech Debt

- No automated tests (unit, integration, or E2E)
- No TypeScript — no static type checking
- All logic in one large component (`IECCTApp.jsx`) — difficult to unit test or maintain at scale
- No fallback if external APIs (Claude, Groq, OpenAI) are unavailable
- Inline styles make visual changes verbose and harder to maintain
- Spanish-only UI with no i18n infrastructure
- No `.env.example` file documenting required variables
- No README.md

---

## Git Branch Convention

- Default branch: `master`
- Feature/AI branches: `claude/<description>-<session-id>`
- Commit messages use conventional-ish format: `fix:`, `add`, `feat:`

---

## Useful Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm start         # Run production build
```
