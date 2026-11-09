# Autovira AI — V4.1 Viral Studio (SaaS starter)

## What is included
- GPT Script Builder via OpenAI Responses API (server-side).
- ElevenLabs Arabic TTS endpoint (server-side).
- fal.ai image generation endpoint (server-side).
- Pexels portrait-video search endpoint (server-side).
- Local B-roll and original Avi upload.
- Multi-scene timeline with add/edit/delete/reorder and durations.
- Punchy word-reveal captions (Hormozi-inspired short-form treatment; not a copy of any creator's exact assets).
- Local editorial Virality Score rubric (not a real-world viral prediction).
- Browser recording with narration/music audio mix.
- Optional FFmpeg.wasm WebM-to-MP4 conversion, loaded only when requested.

## Run locally
Requires Node.js 20+.
1. Copy `.env.example` to `.env`.
2. Add only the API keys you already have. Keep this file private.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Do not open `public/index.html` by double-clicking `file://` if you want server-backed features; use the Node server URL.

## API keys and costs
- OpenAI: requires an API project key; a ChatGPT subscription does not automatically provide API credits. API use is billed separately.
- ElevenLabs: TTS requests consume the account's character quota/credits.
- fal.ai: image generation is usage-based and costs depend on the selected model and image size.
- Pexels: API access requires an existing API key. As of Nov 8, 2026, Pexels' Help Center says issuing new API keys is temporarily paused. Use manual B-roll upload until access is available.
- No API secret is included in the HTML. Never put any key in browser code or send it in chat.

## FFmpeg and iPhone
The in-browser recorder uses MediaRecorder + Canvas + Web Audio. If the browser records WebM, the optional FFmpeg.wasm action can convert it to MP4. It downloads the FFmpeg core on demand (around 31 MB in the current ffmpeg.wasm usage guide). This may use significant memory/CPU on a phone. Keep Safari open while exporting. If conversion fails on iPhone, keep the WebM file and convert on a computer or use Canva.
The canvas render is 1080x1920 at 30 fps. Actual codec/container support depends on the browser. This starter has not been device-tested on the user's iPhone.

## What this is not yet
This is a working starter, not a finished multi-tenant SaaS. Before charging clients or public launch, add:
- user accounts and per-user project storage,
- secure persistent secrets and encrypted asset storage,
- billing/subscriptions,
- API usage quotas and client-level cost limits,
- background job queue for large renders,
- audit logs, backups, privacy/terms, and production monitoring,
- proper timed subtitle alignment (SRT/word timings), export regression tests, and broad device testing.

Virality Score is a content-quality checklist only. It cannot predict or guarantee reach, views, leads, or revenue.
