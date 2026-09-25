# Ebook Formatter UI

Next.js (App Router) + Tailwind CSS front end for the ebook formatting platform,
for `format.toolstackai.xyz`. It drives the FastAPI backend in
`/root/ebook-formatter`.

## Running it

```bash
npm install
cp .env.example .env.local     # BACKEND_ORIGIN, plus the Supabase pair below
npm run dev                    # http://localhost:3000
```

The backend must be running first:

```bash
cd /root/ebook-formatter
uvicorn main:app --reload --port 8000
```

### Checks

```bash
npm run typecheck              # tsc --noEmit
npm test                       # lib/editorContent.ts
```

`npm test` needs no runner and no new dependency: Node strips the TypeScript
itself from v22.6 on, so `scripts/test-editor-content.mjs` imports the real
module. It covers the Markdown ⇄ HTML bridge except `htmlToMarkdown`, which
needs a DOM that neither Node nor this repo supplies — that one is on the manual
pass. The backend's own harness is `verify.py` in the other repo.

### Native addons on Termux/Android

Tailwind v4 needs two native binaries — `@tailwindcss/oxide` and `lightningcss`.
On Termux, Android's linker refuses to load a library from outside a fixed set of
permitted directories (`/system/lib64`, `/data`, …). This checkout is at `/root`,
which is not among them, so both fail and `next build` dies compiling
`app/globals.css` with a misleading "Cannot find module
'../lightningcss.android-arm64.node'".

`scripts/fix-native-addons.sh` moves the binaries under `/data` and leaves
symlinks behind; the linker resolves the symlink before checking the path, so the
path it sees is permitted. It runs automatically from `postinstall`, because
`npm install` restores the real files — and it is a no-op off Android or in a
checkout that is already under `/data`. To run it by hand:

```bash
npm run postinstall
```

### Supabase

Accounts and the saved-projects list need a Supabase project. `/dashboard` is
gated on a session, so without one the formatter is unreachable — the sign-in
page says which variables are missing rather than failing silently.

1. Create a project, then copy **Project Settings → API**'s URL and anon key
   into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Run `supabase/schema.sql` against it (SQL editor, or
   `supabase db execute --file supabase/schema.sql`). It creates the
   `manuscripts` table and the row-level security policies that keep one
   account's rows away from another's, and it is safe to re-run.
3. For Google sign-in, enable the provider under **Authentication → Providers**
   and add `<your-origin>/auth/callback` to the allowed redirect URLs.
   Email/password needs nothing extra, though a new project confirms addresses
   by default — the sign-up form says so when it happens.

Both variables are `NEXT_PUBLIC_`, so they ship to the browser. That is
intended: the anon key only identifies the project, and RLS is what protects the
data. The service-role key must never appear in this app.

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
3. **Edit** — a Tiptap canvas with chapter navigation on the left and a
   typography panel on the right. Bold, italic, three heading levels, bullet
   lists, blockquotes, undo and redo; each chapter is a tab stop in the list,
   with a live word count and a per-chapter revert.
4. **Genre and layout** — nine genre cards (**fiction, non-fiction, academic,
   journal, comic, minimal**, plus poetry, technical and children's), and an
   advanced accordion for title, author, font family, font size and trim size.
5. **Export** — a primary PDF button and a one-click bar for EPUB, DOCX, RTF
   and TXT, each posting to `/api/export-book` and saving the response.

## The editor

The canvas speaks HTML; the backend speaks Markdown-flavoured text (`# Heading`
from the extractor, `**bold**` and `*italic*` in the exporter's regexes).
`lib/editorContent.ts` is the only place that converts between them, in both
directions, and it is hand-written rather than a Markdown library because the
node set is closed by the toolbar: a general library would emit syntax the
exporter does not understand.

Both directions mirror the exporter's *ordering* rule that a scene break is
tested before a bullet, because `* * *` also matches the bullet pattern. Getting
that order wrong turns every scene break in every book into a one-item list.

Text is joined into a single manuscript only where it is needed — at export and
at save — never as derived state, so a keystroke never walks the whole book.

### Fonts in the preview are not the fonts in the export

`lib/googleFonts.ts` injects a `fonts.googleapis.com` stylesheet at runtime, on
first selection of a family, and applies the resulting stack to the canvas as
CSS custom properties. That is a preview: WeasyPrint renders the export on the
server, so the *export* still uses the family named in the settings panel, which
has to be installed there. The panel says so.

`next/font/google` is deliberately not used — it resolves families at build
time, and these are chosen at runtime.

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

The editor is seeded once, from that corrected text. A correction accepted
*after* the editor has loaded cannot be applied retroactively without discarding
whatever has been typed, so each chapter carries its own revert and the step
says so. It is the corrected text that is reverted *to*.

## Accounts and saved projects

`middleware.ts` runs `lib/supabase/middleware.ts` on every request. That does
two things: it refreshes the Supabase session, which Server Components cannot do
themselves because they render with a read-only cookie jar, and it gates
`/dashboard`, sending a signed-out visitor to `/login?next=/dashboard` so they
land back where they were headed.

The gate calls `auth.getUser()`, not `getSession()`. `getSession` only decodes
the cookie, so anything that can write a cookie could present itself as a signed
-in user; `getUser` validates the token with the auth server.

A saved project is the manuscript's **settings and measurements** — title,
author, word count, chapter breakdown, genre, font family, size and trim — plus,
once it has been saved from the editor, the **manuscript text itself**, as
Markdown, in the row's `content` column.

Storing the text is a deliberate reversal of the original design, which held
settings only. The editor is what changed the trade: an editing surface whose
work is lost on reload is not an editing surface, and the Markdown form is the
same text `/api/export-book` already receives, so it is one representation of
the book rather than two. `content` stays null for a project saved through the
upload flow without the editor ever being opened, and the panel says which case
a given project is.

Reopening a project still needs the original file re-uploaded before exporting,
for a different reason than before: the export is told the language, script and
text direction the analyzer detects, and a project row does not store them.
Re-uploading does **not** overwrite the stored text — the editor stays seeded
from the project, and the upload is used only for what it alone knows.

The chapter breakdown comes from the API. `/api/analyze-book` returns a
`chapters` array (`title`, `line_number`, `word_count`) alongside
`chapter_count`, built from the same heading rules the count uses — so a
manuscript whose text starts before its first heading reports one more chapter
entry than `chapter_count`, that first entry being "Front Matter".

Once the editor has been typed into, that breakdown is recomputed from the
edited Markdown on save, because the analyzer's line numbers describe the
uploaded text and a document with a paragraph added above chapter three no
longer has chapter three on the same line. The recomputation reads `#`-style
headings only, which is what the editor can represent; a manuscript the analyzer
chapters by bare `Chapter One` lines keeps the analyzer's breakdown as long as
nobody edits it, and is re-derived into one section per `#` heading once
somebody does.

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
- **A saved project stores the text once it has been through the editor.**
  Before that it is settings and measurements only. Either way, exporting a
  reopened project needs the file again, because the language, script and text
  direction the renderer is told are not stored.
- **The chapter breakdown is the analyzer's until the manuscript is edited.** It
  is derived by the same heading rules as `chapter_count`, so a manuscript with
  no detectable headings reports one "Front Matter" entry and a count of zero
  rather than an invented structure. Editing the text re-derives it from the
  editor's own `#` headings, since the analyzer's line numbers no longer
  describe the document.
- **Missing Supabase config fails closed.** `/dashboard` redirects to `/login`
  and the sign-in page prints the setup steps. Assuming "signed in" when the
  project is unconfigured would hand the formatter to anyone who asked.
