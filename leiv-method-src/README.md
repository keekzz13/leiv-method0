# Leiv Method

Private, browser-based lossless MP4 container optimizer.

## Features

- **Local processing** with FFmpeg WebAssembly — videos never leave the device
- **Lossless stream-copy mode** when the container allows (`-c copy -movflags +faststart`)
- **Compatibility mode** with clear quality warnings when re-encoding is needed
- Dark, minimal premium UI inspired by developer tools
- No accounts required
- Free beta

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build for production

```bash
npm run build
npm start
```

## Deploy (free hosting)

Because processing is 100% client-side, deploy to:

1. **Vercel** (recommended) — free hobby plan, best Next.js support
2. **Cloudflare Pages** — excellent free tier
3. **Netlify**

Connect your Git repo or drag-and-drop the project. The `next.config.ts` already sets the COOP/COEP headers required by ffmpeg.wasm.

## Notes

- Large files need sufficient browser RAM
- Only claim lossless results when stream copy actually succeeds
- Beta software — expect occasional bugs
