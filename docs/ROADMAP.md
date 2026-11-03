# ReelForge Studio — roadmap

## Done

- Per-user accounts: sign up, email verify, password reset, profile, terms, and project ownership. `/admin` remains a separate login.
- Detached jobs persisted in `DATA_DIR/jobs.json`, with resume after a restart.
- Public host (the app is no longer tied to a rotating dev tunnel).
- Meta-only runtime switch (on by default): Muse Spark / Wonder / Image, optional SAM 3.1, Baseten Muse Spark Open, self-hosted MMS-TTS and wav2vec2.
- Cloudflare R2 for media, streamed back through the app with a disk cache.
- Per-user Meta API quota (Admin → Usage limits).
- Platform formats enforce aspect ratio and maximum duration for the storyboard and the cut.

## Next

- Move the JSON document store (`DATA_DIR/db.json`) to SQLite so concurrent writers do not share one file.
- Let the agent drive Files and Terminal as tools. Today it opens the browser and writes a log the Terminal view shows.
- A Meta video model, when one is available for this project. Until then the cut is FFmpeg / HyperFrames motion over Muse Image stills. Third-party video engines stay behind `META_ONLY=off`.

## Known limits

- One shared Linux desktop, leased to one account at a time.
- The voice service is one CPU-sized container. MMS-TTS weights are CC-BY-NC 4.0.
- HyperFrames is slow on a single vCPU. The render falls back to FFmpeg Ken Burns.
- JSON-file database and in-memory agent transcripts. A process restart keeps projects and jobs; it does not keep an in-progress chat transcript.
- Usage limits count Meta API calls (Muse, Baseten, SAM). They do not bill self-hosted MMS or local FFmpeg.

## History

- v1: script → assets → storyboard → continuity → voice → edit.
- v2: provider chain, brainstorm, research desktop, assistant.
- v3: take control, YouTube tools in chat.
- v4: floating desktop, mobile viewer.
- v5: ReelForge rebrand, accounts, Meta-only pipeline, R2 media, MMS voice service.
