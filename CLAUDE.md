# Paperscape: rules for Claude Code

Two people build this repo in parallel, each with their own Claude session. The full plan, task IDs, API contract and data model are in `docs/PROJECT_PLAN.md`. Read the relevant section before coding.

## Hard constraints (graded; violating them costs points)

- **ESM only.** `"type": "module"`, `import`/`export`. Never use `require`.
- **No Mongoose. No template engines** (EJS, Pug, Handlebars…). Use the native `mongodb` driver only.
- **No frontend frameworks or libraries.** Vanilla JS ES modules + Fetch, client-side rendering. SVG drawn by hand (no D3/Leaflet).
- **Dependencies are fixed:** `express`, `mongodb`, `dotenv`. Dev: `eslint`, `@eslint/js`, `globals`, `prettier`. Ask the user before adding anything.
- **Never commit secrets.** Config comes from `.env` (gitignored); document new keys in `.env.example`.
- Use **standard HTML elements**: `<button>` for actions, `<a>` for navigation, `<dialog>` for modals, `<form>`/`<label>` for inputs. Never put a click handler on a `div`/`span`.
- **CSS is modular:** shared tokens/components live in `public/css/base.css`, `layout.css`, `components/*.css`; each page has its own file in `public/css/pages/`.
- **No leftover code:** no unused files/functions, no `console.log` debugging, no commented-out code.

## File ownership: only edit files you own

| Owner           | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ayush (A)       | `db/conferences.js`, `db/submissionPlans.js`, `db/linkReports.js`, `routes/conferences.js`, `routes/plans.js`, `routes/reports.js`, `scripts/seed-conferences.js`, `scripts/track-conferences.js`, `scripts/lib/`, `scripts/build-world-map.js`, `scripts/data/`, `.github/workflows/`, `public/index.html`, `public/conferences.html`, `public/plans.html`, `public/js/home.js`, `public/js/planner/`, `public/css/pages/{home,conferences,map,timeline,plans}.css`, `public/assets/` |
| Harshitha (H)   | `db/reviews.js`, `db/reviewEntries.js`, `db/papers.js`, `routes/reviews.js`, `routes/entries.js`, `routes/papers.js`, `scripts/seed-papers.js`, `public/reviews.html`, `public/review.html`, `public/js/review/`, `public/css/pages/{reviews,review}.css`, `docs/DESIGN.md`, `docs/mockups/`, `README.md`                                                                                                                                                                              |
| Shared (frozen) | `server.js`, `package.json`, `eslint.config.js`, `.prettierrc`, `db/connection.js`, `db/indexes.js`, `lib/`, `middleware/`, `public/js/shared/`, `public/css/base.css`, `public/css/layout.css`, `public/css/components/`                                                                                                                                                                                                                                                              |

If a task seems to need a change to a shared or other-owner file, **stop and tell the user**. Shared changes go in a separate `shared:` PR.

## Conventions

- **Backend layering:** `routes/*` validate input and shape responses; `db/*` hold all MongoDB queries; `lib/validation.js` holds helpers.
- Every query on an owned collection filters by `ownerId: req.ownerId` (set by `middleware/owner.js` from the `X-Owner-Id` header). If the doc is not the user's, return 404.
- Errors are JSON `{ error, details? }` with status codes 400/404/409/500 as in the plan §7.
- **Frontend:** call the API only via `public/js/shared/api.js`. Build DOM with `el()` from `dom.js`, and put user data in with `textContent`, never `innerHTML`. Use `ui.js` for toasts/dialogs/empty states and `format.js` for dates. Deadlines are AoE (`aoeEndOfDay`).
- Each page script keeps one `state` object and a `render()` function.
- Use CSS custom properties from `base.css` (`--accent`, `--surface`, `--radius`, `--space-*`, `--area-<id>`); never hard-code colours in page CSS.
- Research areas come from `public/js/shared/areas.js`. Don't invent new area ids.
- `scripts/data/*.json` is written by scripts; don't hand-format it (it's excluded from Prettier).

## Commands

```
npm run dev              # node --watch server.js
npm run lint             # must be 0 errors before committing
npm run format           # prettier --write .
npm run seed:conferences
npm run track:conferences  # conference data refresh (runs daily in GitHub Actions)
npm run seed:papers
```

## Workflow

- Work on a branch `a/<task-id>-…` or `h/<task-id>-…`, one task per PR, and `git pull --rebase origin main` before the PR.
- Before finishing a task: run `npm run lint` and `npm run format`, then tick the task's checkboxes in `docs/PROJECT_PLAN.md`.
- Do not commit or push unless the user asks.
