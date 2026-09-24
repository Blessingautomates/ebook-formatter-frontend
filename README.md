# Ebook Formatter UI

Next.js (App Router) + Tailwind CSS front end for the ebook formatting platform,
for `format.toolstackai.xyz`. It drives the FastAPI backend in
`/root/ebook-formatter`.

## Running it

```bash
npm install
cp .env.example .env.local     # point BACKEND_ORIGIN at the API
npm run dev                    # http://localhost:3000
```

The backend must be running first:

```bash
cd /root/ebook-formatter
uvicorn main:app --reload --port 8000
```

## How it talks to the API

`next.config.mjs` rewrites `/api/*` to `BACKEND_ORIGIN`, so the browser only
ever makes same-origin requests. Two consequences worth knowing:

- **No CORS middleware is needed on the API.** If you ever bypass the proxy and
  call the backend cross-origin, you would have to add `CORSMiddleware` to
  `main.py`, which is a deliberate decision about who may call the API rather
  than a formality.
- The `Content-Disposition` header on a download stays readable, so the saved
  filename is the one the server chose.

`BACKEND_ORIGIN` is read by the Next.js **server**, not the browser, so it is
not a `NEXT_PUBLIC_` variable and is never exposed to the client.

## The flow

1. **Dropzone** — `.docx`, `.md`, `.txt`, with the extension checked in the
   browser before the upload so an obvious mistake costs nothing. Posts to
   `/api/analyze-book` with `include_text=true`.
2. **Pre-scan** — word count, chapter count, estimated pages, language and
   token cost, plus the script and direction the backend inferred. The typo
   drawer lists each finding with its suggestions, chapter, line and a context
   snippet.
3. **Genre and layout** — nine genre cards (**fiction, non-fiction, academic,
   journal, comic, minimal**, plus poetry, technical and children's), and an
   advanced accordion for title, author, font family, font size and trim size.
4. **Export** — a primary PDF button and a one-click bar for EPUB, DOCX, RTF
   and TXT, each posting to `/api/export-book` and saving the response.

## Why the manuscript text comes back from `/api/analyze-book`

Typo fixes only mean something if they reach the exported file, and the export
endpoint takes text. So the app asks for the extracted text with
`include_text=true`, applies the accepted corrections client-side, and posts the
corrected text to `/api/export-book`. Without that flag the app falls back to
re-uploading the original file and says so in the UI — the corrections would
then have nowhere to go.

Corrections are applied line by line, using the line numbers the analyser
reported, and only to the recorded word on that line. A replacement never adds
or removes a line, so the numbering stays valid for every later correction.

## Notes and limits

- **Fonts resolve on the server.** WeasyPrint renders there, so a family the
  browser has but the server does not will fall back to the genre's stack. The
  settings panel says so.
- **Trim size applies to the paged formats.** EPUB reflows to the reader and has
  no fixed page, so the trim is ignored for it.
- **A missing renderer is a `503`, not a crash.** If WeasyPrint, EbookLib or
  python-docx is not installed, only the formats it serves are affected and the
  error names the package to install.
- **The typo list is capped by the API** (200 entries). When the count exceeds
  the list, the drawer says how many occurrences were found and how many are
  listed, so a partial list is never mistaken for a clean manuscript.
- **No dictionary means no scan.** For languages pyspellchecker has no
  dictionary for, the API reports `typo_check_available: false` and the drawer
  explains why rather than showing a misleading zero.
