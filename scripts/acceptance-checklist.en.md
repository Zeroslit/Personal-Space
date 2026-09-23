# Acceptance checklist

> English · [中文版](acceptance-checklist.md)

## Before you start

1. Build: `./scripts/build.sh` (Windows: `./scripts/build.ps1`) -> produces `server/target/personal-space.jar`
2. Run: `java -jar server/target/personal-space.jar`, then open <http://127.0.0.1:8787>
3. Automated checks:
   - `./scripts/smoke-test.sh` (or `smoke-test.ps1`) -> everything should PASS
   - `cd web && npm test` -> 37 cases pass (16 form validation + 13 search/filter + 8 embed decision)

## 1. Link rules

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 1 | GitHub repo required | Create a project with only a title | Submission is blocked, the repo field shows "GitHub 仓库地址必填" |
| 2 | Repo only | Fill in only `repoUrl` | Saves; the card shows only the "repository" entry point, no "preview now" |
| 3 | Repo + demo | Fill in both | Saves; both "repository" and "preview now" are present |
| 4 | Demo without repo | Fill in only `siteUrl` | Also blocked (a demo URL cannot replace the repository) |
| 5 | Invalid scheme | Enter `ftp://example.com` or `example.com` | Message says it must start with `http://` / `https://` and contain a hostname |
| 6 | Same rule on the backend | `curl -X POST .../api/projects -d '{"title":"x"}'` | 400 + `{"error":"validation_error","message":"repoUrl（GitHub 仓库） 不能为空"}` |
| 7 | Clearing while editing | Edit a project, clear the repo URL and save | Also blocked (`PUT` shares the same validation) |

## 1b. GitHub summary auto-fill and direct open

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 47 | Summary auto-fill | Create a project and paste a public repo URL (e.g. `https://github.com/openai/openai-python`) into "GitHub repository" | The summary fills in with the repo description and a "GitHub 上的简介" suggestion card appears above the summary field |
| 48 | Hand-written text wins | Write a summary first, then change the repo URL | Your summary is not overwritten; the GitHub description only shows up in the suggestion card |
| 49 | Enter accepts / Shift+Enter newline | With the cursor in the summary field press `Enter`, then `Shift+Enter` | `Enter` applies the suggestion and shows a toast with undo; `Shift+Enter` just inserts a newline |
| 50 | Failure is only a hint | Enter a repo that does not exist (`https://github.com/example/nope-nope-nope`) | A "could not read the GitHub summary" hint; writing and saving still work |
| 51 | Lookup endpoint | `curl "http://127.0.0.1:8787/api/github/repo?url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai-python"` | 200 + `summarySuggestion`; non-github.com -> 400, missing `url` -> 400, unknown repo -> 404 |
| 52 | Login-only site opens directly | Give a project the demo URL `https://github.com/login` (or tick "this demo needs a login") | The card button becomes "open demo" and jumps in a new tab; the detail page shows the cover placeholder and the reason, with no viewport switcher or refresh |
| 53 | Sites that forbid framing | Set the demo URL to `https://accounts.google.com/signin` | Same as above: no framing attempt, an "open accounts.google.com" button is offered; only "try framing anyway" really embeds it |
| 60 | Repository without a description | Paste a repo that has no GitHub description but does have a README (e.g. `https://github.com/Zeroslit/University-Book-Trading-Market`) | The README's first paragraph is suggested, the card is labelled "GitHub README 的第一段", and `summarySource` in the API response is `readme` |
| 61 | Neither source available | Paste a repo with no description and no usable README body | The hint below the summary field says the summary has to be written by hand — nothing silently does nothing |

## 9. Click to navigate

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 54 | Whole card is clickable | Click the cover or an empty spot in the card summary | The project detail page opens |
| 55 | Buttons do not trigger it | Click "preview now", "edit" or the drag handle on a card | Only that control reacts, no navigation to the detail page |
| 56 | List / timeline views | Click an empty spot on any row in those views | The detail page opens as well |
| 57 | External links | Click "repository" / "open demo" | The target opens in a new tab (`rel="noreferrer noopener"`) |
| 58 | Enter right after pasting | Paste a GitHub URL and press `Enter` while the repo field still has focus | The auto-filled summary is applied (same as #49); if the summary was edited by hand nothing happens and your text is never overwritten |

## 10. API and error handling (additional)

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 59 | `demoLogin` field | `curl -X POST ... -d '{"title":"x","repoUrl":"https://github.com/a/b","demoLogin":true}'` | 201 and `demoLogin` is `true` in the response; a non-boolean value -> 400 |

## 2. Project management

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 8 | All fields | New/edit panel | Title, summary, GitHub repo, demo URL, cover, tags, language, status, stars, pinned and code snippets are all editable |
| 9 | CRUD | Create, edit, delete and open the detail page | Every operation takes effect immediately and list/detail stay consistent |
| 10 | Drag-and-drop order | Drag cards in grid/list view | The order updates and survives a reload (`PATCH /api/projects/order`) |
| 11 | Optimistic updates | Pin / change status / delete and watch the UI | The UI changes first; on failure it rolls back and shows a toast |
| 12 | Undo delete | Delete any project | A toast offers undo for 5 seconds; clicking it restores the project exactly (position and snippets included) |
| 13 | Pinning | Pin / unpin | Pinned projects sort first |

## 3. Code snippets

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 14 | Multiple snippets | Add two or more snippets to a project | The detail page lists them in order with filename and language label |
| 15 | Syntax highlighting | Look at a snippet on the detail page | Coloured by language (highlight.js, bundled locally, no CDN) |
| 16 | One-click copy | Click the copy button | The content lands in the clipboard and a toast confirms it |

## 4. Live demo

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 17 | Preview inside the card | Click "preview now" on a card | An iframe expands inside the card and the button becomes "collapse preview" |
| 18 | Preview on the detail page | Same operation there | The demo URL is embedded in an iframe |
| 19 | Three viewports | Switch desktop / tablet / phone | The iframe width follows the selection |
| 20 | Refresh | Click refresh | The iframe reloads (a nonce busts the cache) |
| 21 | Copy link | Click copy link | The demo URL lands in the clipboard |
| 22 | Open in a new tab | Click the external-link icon | The browser opens the demo in a new tab |
| 23 | Cross-origin fallback | Use a demo site that sends `X-Frame-Options: DENY` | If it has not loaded successfully within 8 seconds, a cover placeholder plus an "open link" button appears — no white page, no error |
| 24 | Cover upload | Upload an image in the form | It returns `/api/assets/<id>` and shows up on the card / placeholder |

## 5. Themes

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 25 | Six themes | Cycle through the theme panel | Clean light, dark, glassmorphism, green terminal, warm paper and cyber neon all apply |
| 26 | Custom accent | Pick an accent colour | Accent colour, buttons and links all follow it |
| 27 | Persisted on the backend | Switch theme, restart the server | The theme is kept (`GET /api/settings` returns the chosen theme and accent) |
| 28 | localStorage | Stop the backend and open the page | It still renders with the last theme |
| 29 | No white flash | Hard refresh (Ctrl+F5) on a dark theme | The first frame is already dark, no white flash |
| 30 | Tokens | Look at `web/src/index.css` | All colours go through `--c-*` variables; themes switch via `data-theme` |

## 6. Interaction

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 31 | Search | Type keywords from titles, summaries, tags or snippet code | All of them match (backend SQL and frontend filtering agree) |
| 32 | Filters | Filter by tag, language, status, pinned | The result set narrows instantly and filters combine |
| 33 | Three views | Grid / list / timeline | The layout changes and the choice is remembered |
| 34 | Command palette | Press `Ctrl+K` / `Cmd+K` | The palette opens and can search, jump to projects and run commands such as "new project" or "switch theme" |
| 35 | Toasts | Any save/delete/copy action | Clear feedback, and undoable deletes offer an undo button |
| 36 | Empty & skeleton states | First load; or delete every project / filter down to nothing | A skeleton while loading, guidance and a button when there is nothing |
| 37 | Keyboard access | Use only Tab / Enter / Esc | Dialogs open and close, the form submits, project details are reachable; focus is always visible |

## 7. API and error handling

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 38 | Every endpoint | See the API table in the README | All seven required endpoints work (plus the asset upload) |
| 39 | Unified error shape | Send invalid input | `{"error": "...", "message": "..."}` |
| 40 | Status codes | Trigger 400 / 404 / 405 / 415 | Each returns the matching status code |
| 41 | Health check | `curl /api/health` | Returns status/version/project count/snippet count/database path |

## 8. Engineering and delivery

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 42 | One process, one artifact | Start only the jar | The same port serves both the API and the frontend; nothing else to deploy |
| 43 | No online dependencies | Open the page while offline | Styling, fonts, highlighting and icons all work (no CDN requests) |
| 44 | Cross-platform | Build on Windows / macOS / Linux | Both `build.ps1` and `build.sh` produce the same jar |
| 45 | Seed data | Delete `data/` and restart | The 5 projects from `seed/projects.json` are imported automatically |
| 46 | Documentation | Read `README.md` (or `README.en.md`) | Build, run, API, link rules, theme customisation and test steps are all covered |