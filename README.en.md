# Personal Space

> English · [中文版 README](README.md)

A single-user project showcase: keep all of your projects on one page, each with a **summary, links (GitHub repo / live demo URL), code snippets and an embedded live preview**. The goal is to be cleaner and nicer to use than GitHub: optimistic updates, 5-second undo for deletes, drag-and-drop ordering, a command palette, 6 built-in themes and a custom accent colour.

The backend is Java 17 (the JDK's built-in HTTP server) + Gson + sqlite-jdbc, packaged by Maven into a **single executable jar** that serves both the REST API and the embedded frontend from the same process. The frontend is React 18 + TypeScript + Vite + Tailwind. There is **no online CDN dependency** anywhere, and no Electron / Tauri / YAML / Redux.

## Layout

```
personal-space/
├── server/                        # Java 17 backend (produces a single jar)
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd            # Maven Wrapper, no need to install Maven
│   └── src/main/java/app/pspace/
│       ├── Main.java              # startup, argument parsing, graceful shutdown
│       ├── Options.java           # CLI flags and environment variables
│       ├── Db.java                # SQLite connection and schema migration
│       ├── Store.java             # reads/writes for projects, snippets, tags, settings, assets
│       ├── Seed.java              # imports seed/projects.json on first start
│       ├── Validate.java          # request validation, anything invalid -> 400
│       ├── ApiException.java      # the unified error shape {error, message}
│       ├── Json.java / Version.java
│       ├── GitHub.java            # reads repo info from GitHub (auto-fill summary)
│       ├── model/                 # Project / Snippet / Settings / Asset ...
│       └── web/                   # Router / Http / StaticFiles
├── web/                           # frontend: React + TS + Vite + Tailwind
│   └── src/{api,app,components,features,lib}
├── seed/projects.json             # 5 seed projects
├── scripts/                       # build scripts, curl smoke test, acceptance checklist
└── data/                          # SQLite database created at runtime (gitignored)
```

## Requirements

- JDK 17 or newer (`java -version` must work; Maven is downloaded by the wrapper)
- Node.js 20+ and npm (only needed to build or develop the frontend; a pre-built frontend is already bundled)

## Build

One command does "build frontend -> copy into backend resources -> build jar":

```bash
./scripts/build.sh          # macOS / Linux / Git Bash
```

```powershell
./scripts/build.ps1         # Windows PowerShell
```

The artifact is `server/target/personal-space.jar`. The equivalent manual steps are:

```bash
cd web && npm ci && npm run build
rm -rf ../server/src/main/resources/static && cp -R dist ../server/src/main/resources/static
cd ../server && ./mvnw -q clean package
```

## Run

```bash
java -jar server/target/personal-space.jar
# open http://127.0.0.1:8787
```

| Flag | Environment variable | Default | Meaning |
| --- | --- | --- | --- |
| `--host <addr>` | `PSPACE_HOST` | `127.0.0.1` | listen address |
| `-p, --port <port>` | `PSPACE_PORT` | `8787` | listen port |
| `--db <file>` | `PSPACE_DB` | `data/personal-space.db` | SQLite database file |
| `--static-dir <dir>` | `PSPACE_STATIC_DIR` | none | read the frontend from a directory on disk instead (for development; defaults to the resources inside the jar) |
| | `PSPACE_GITHUB_TOKEN` / `GITHUB_TOKEN` | none | optional GitHub token, raises the rate limit when reading repo info (used server-side only, never sent to the browser) |
| `-h, --help` | | | show usage |

The database is created (with its schema) if it does not exist, and `seed/projects.json` (bundled inside the jar) is imported whenever the projects table is empty.

### Development mode (frontend and backend split, hot reload)

```bash
java -jar server/target/personal-space.jar --static-dir web/dist   # terminal 1: backend on :8787
cd web && npm run dev                                              # terminal 2: Vite on :5173, /api proxied to :8787
```

## Link rules (GitHub repo / demo URL)

Every project has two link fields: `repoUrl` (the GitHub repository, **required**) and `siteUrl` (the live demo URL, optional).

- **The GitHub repository is required**: leaving it empty returns 400 `validation_error` with the message `repoUrl（GitHub 仓库） 不能为空`; filling in only the demo URL and no repository is rejected in exactly the same way.
- **The demo URL is optional**: repo only, or repo + demo, are both valid.
- With only `repoUrl` the card and detail page show a single "repository" entry point; the "preview now" / "open demo" buttons only appear once `siteUrl` is set.
- Both links must start with `http://` or `https://` and contain a hostname; any other scheme (e.g. `ftp://`) returns 400.
- The demo URL may point at a page that **requires a login**, such as GitHub or Google (e.g. `https://github.com/login`, `https://accounts.google.com/signin`). Those pages refuse to be framed, so the UI automatically turns into an "open demo" button that jumps straight to the site in a new tab instead of waiting 8 seconds for nothing (see "Demo preview fallback" below).
- When `repoUrl` points at github.com, pasting it automatically pulls in the repository description (see the next section). Other domains still save fine, they just have no auto-fill.
- `validateForm` in `web/src/features/projects/lib/form.ts` mirrors the backend rule `Validate.requireUrl` so invalid input is caught in the browser first, avoiding a round trip; POST and PUT share the same validation.

## Pasting a GitHub URL auto-fills the summary

After pasting `https://github.com/owner/repo` into the "GitHub repository" field (a `www.` prefix, a `.git` suffix or extra segments such as `/tree/main` are all recognised):

- the frontend debounces for 500ms and calls `GET /api/github/repo?url=...`; the backend reads `https://api.github.com/repos/owner/repo` and caches the result in memory for 10 minutes;
- when the summary is **empty** the repository description is filled in automatically; anything you have written yourself is **never overwritten**;
- a "GitHub 上的简介" suggestion card appears above the summary field, and clicking "use" applies it;
- with the cursor in the **summary field**, `Enter` accepts the suggestion and `Shift+Enter` inserts a newline (IME composition does not trigger it by accident), and the confirmation toast offers an undo;
- when the repository has **no description set**, the backend falls back to the README and uses its **first real paragraph** as the suggestion (headings, badges, images, code fences, language switchers and bare links are skipped), and the suggestion card is labelled "GitHub README 的第一段";
- when neither source has anything usable you get an explicit hint that the summary has to be written by hand, instead of simply nothing happening;
- every time the new/edit form opens it starts from a clean state: a summary auto-filled in a previous round never leaks into the next one, and the suggestion is discarded the moment the URL field no longer matches it; once you have typed your own summary (or cleared the field by hand) nothing is filled in again;
- if the lookup fails (private repo, offline, rate limited) you simply get one hint — typing and saving are unaffected; transient failures such as a reset connection are retried once by the backend (12 second timeout).

Optionally set `PSPACE_GITHUB_TOKEN` (or `GITHUB_TOKEN`) to a GitHub personal access token to raise the anonymous rate limit. The request is made by the server, so the token never reaches the browser.

Response fields: `{owner, name, fullName, htmlUrl, description, summarySuggestion, summarySource, homepage, language, defaultBranch, license, pushedAt, archived, stars, forks, openIssues, topics, fetchedAt}`; `summarySource` is `description` (the repository description was used) or `readme` (the README's first paragraph was used), and the field is omitted when there is no suggestion at all.

## API

Base URL `http://127.0.0.1:8787`; requests and responses are UTF-8 JSON.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | health check: status, version, project count, snippet count, uptime, database path |
| GET | `/api/projects` | list projects; supports `q` (title / summary / language / tags / code content / filename), `tag`, `language`, `status`, `pinned` |
| POST | `/api/projects` | create a project, returns 201 with a `Location` header |
| GET | `/api/projects/:id` | one project, including its code snippets |
| PUT | `/api/projects/:id` | full update, same validation as POST (including "the GitHub repo is required") |
| DELETE | `/api/projects/:id` | delete, returns `{ok: true, id}` |
| PATCH | `/api/projects/order` | reorder after drag and drop, body `{"ids": ["p_a", "p_b"]}` |
| GET | `/api/github/repo` | fetch GitHub repo info on the app's behalf (`?url=https://github.com/owner/repo`), used for auto-filling the summary; non-github.com -> 400, missing repo -> 404, rate limited -> 429, fetch failure -> 502 |
| GET | `/api/tags` | tags and their usage counts |
| GET | `/api/settings` | global settings (theme / accent / view / sort / density / demo viewport) |
| PUT | `/api/settings` | partial update of the settings |
| POST | `/api/assets` | upload a cover image (Content-Type image/png, image/jpeg, image/gif, image/webp, image/svg+xml, image/avif, up to 4 MB), returns `{id, url, ...}` |
| GET | `/api/assets/:id` | serve a cover image (with ETag and long-lived caching) |

Errors always use the same shape:

```json
{ "error": "validation_error", "message": "repoUrl（GitHub 仓库） 不能为空" }
```

Status codes: 400 invalid input, 404 not found, 405 method not allowed, 415 unsupported media type, 500 internal error.

Example request body for creating a project (`siteUrl` may be omitted; without it the card only shows the "repository" entry point):

```json
{
  "title": "httplite",
  "summary": "A dependency-free C++17 HTTP server library",
  "repoUrl": "https://github.com/example/httplite",
  "siteUrl": "https://httplite.example.dev/",
  "tags": ["C++", "networking"],
  "language": "C++",
  "status": "active",
  "stars": 642,
  "demoLogin": false,
  "pinned": true,
  "snippets": [{ "filename": "examples/hello.cpp", "language": "cpp", "code": "int main() {}\n" }]
}
```

`status` must be one of `active / wip / paused / archived / idea`; `stars` ranges from 0 to 1000000; at most 12 tags of up to 24 characters each; at most 30 code snippets per project; `demoLogin` (default `false`) marks a demo that needs a login — when `true` the frontend never frames it and always opens it in a new tab.

## Tests and acceptance

```bash
./scripts/smoke-test.sh                 # macOS / Linux / Git Bash
./scripts/smoke-test.ps1                # Windows PowerShell
```

The scripts use curl to cover every endpoint, including "no GitHub repo -> 400", "repo only -> 201", "repo + demo -> 201", "demo marked as requiring login -> 201", "PUT clearing the repo -> 400", "invalid scheme -> 400", "`/api/github/repo` without arguments -> 400, non-github.com -> 400" and more, and clean up their test data afterwards (on restricted networks the real GitHub fetch is reported as SKIP instead of FAIL). To run against an already running server:

```bash
java -jar server/target/personal-space.jar &
BASE_URL=http://127.0.0.1:8787 ./scripts/smoke-test.sh
```

The item-by-item checklist lives in `scripts/acceptance-checklist.md` (English: `scripts/acceptance-checklist.en.md`).

The frontend also has a vitest layer (URL rules, form validation, the summary auto-fill rules and a form regression that covers "closing and reopening the dialog never leaks the previous summary"). It runs without a backend:

```bash
cd web && npm test
```

## Theme customisation

All colour tokens live in `web/src/index.css`, exposed as CSS variables (RGB triples); the theme is switched through `data-theme`:

```css
[data-theme="midnight"] {
  --c-bg: 11 13 18;
  --c-surface: 20 23 31;
  --c-accent: 124 156 255;
}
```

Six themes ship in the box: `minimal` (clean light), `midnight` (dark), `glass` (glassmorphism), `terminal` (green terminal), `paper` (warm paper) and `neon` (cyber neon).

When you pick a custom accent colour the frontend:

1. writes it to `PUT /api/settings` as `accent` (6-digit hex, e.g. `#7c5cff`);
2. mirrors it into localStorage under `pspace:settings`;
3. sets `data-accent="custom"` on `documentElement` and overrides `--c-accent`.

An inline script in `web/index.html` reads localStorage and applies the colours before the first paint, so there is **no white flash**, and themes keep working even when the backend is down.

To add a theme: add a `[data-theme="name"]` variable block in `web/src/index.css`, register it in `THEMES` in `web/src/lib/theme.ts`, and add the id to `Settings.THEMES` in the backend (otherwise saving settings returns 400).

## Demo preview fallback

"Preview now" embeds the demo URL in an iframe, with desktop / tablet / phone viewports, refresh, copy link and open-in-new-tab. If the target site refuses to be framed via `X-Frame-Options` or CSP, or does not finish loading within 8 seconds, the preview falls back to a cover-image placeholder with a link to open it — that is the browser's same-origin policy at work, and no frontend technique can get around it.

### URLs that need a login or forbid framing: open directly

For hosts such as `github.com`, `accounts.google.com`, `x.com` and `youtube.com`, and for any path containing `login` / `signin` / `auth` / `oauth` / `sso` (the tables are `NO_FRAME_HOSTS` and `LOGIN_PATH` in `web/src/features/demo/lib/embed.ts`), framing can only ever produce a blank page, so the app **does not even try**:

- the button on the card changes from "preview now" to "open demo" and jumps straight to the site in a new tab;
- the detail page shows the cover placeholder plus the reason and an "open ..." button, hiding the viewport switcher and refresh;
- if you insist, "try framing anyway" still embeds it and stops warning you;
- for your own demo site that needs a GitHub / Google login, tick "this demo needs a login" in the form (backend field `demoLogin`) for exactly the same behaviour.

Anything unrecognised is treated as embeddable and left to the iframe failure fallback.

## Implementation notes

This round the backend is Java 17 (confirmed acceptable). The REST contract, the `web/` frontend and the `seed/` data are identical to the C++17 plan: if you ever want to switch to C++17 (cpp-httplib + nlohmann/json + embedded SQLite + a CMake single binary), only the `server/` directory needs replacing — the frontend and the seed data can be reused as they are.
