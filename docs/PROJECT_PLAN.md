# Paperscape: Project Plan & Task List

> Plan your ML submissions and run your literature review in one place.

**Team:** Ayush Nimeshkumar Patel (**A**) · Harshitha Seetharaman (**H**)
**Budget:** 3 days × 5 h/day × 2 people = **30 person-hours**. Both of you use Claude Code.
**Hard rule:** code freeze is **24 h before class**. The end of Day 3 is the freeze.

How to use this doc:

- Every task has an ID (`S0-x` shared, `A-x` Ayush, `H-x` Harshitha, `F-x` final, `X-x` stretch).
- Tick the checkbox `[x]` in your PR when a task is done.
- To start a Claude session, say: _"Read CLAUDE.md and docs/PROJECT_PLAN.md, then implement task H-5."_

---

## Table of contents

1. [Feature list (from the approved proposal)](#1-feature-list)
2. [Feature tiers: Core / Planned / Stretch](#2-feature-tiers)
3. [Tech stack & constraints (rubric-driven)](#3-tech-stack--constraints)
4. [Repository structure & file ownership](#4-repository-structure--file-ownership)
5. [Collaboration rules (how not to break each other)](#5-collaboration-rules)
6. [Data model (MongoDB collections)](#6-data-model)
7. [API contract](#7-api-contract)
8. [Frontend architecture & design system](#8-frontend-architecture--design-system)
9. [Page-by-page UI spec](#9-page-by-page-ui-spec)
10. [Key algorithms (map, timeline, warnings, citations, seeding)](#10-key-algorithms)
11. [Schedule: Day 1 / Day 2 / Day 3](#11-schedule)
12. [Task list: Shared (S0)](#12-task-list--shared-sprint-0)
13. [Task list: Ayush (A)](#13-task-list--ayush)
14. [Task list: Harshitha (H)](#14-task-list--harshitha)
15. [Final submission tasks (F)](#15-final-submission-tasks)
16. [Stretch backlog (X)](#16-stretch-backlog)
17. [Rubric → where it's satisfied](#17-rubric-mapping)
18. [Risks & mitigations](#18-risks--mitigations)
19. [Definition of Done & manual test checklist](#19-definition-of-done--manual-test-checklist)

---

## 1. Feature list

From the approved proposal. Everything here is promised to the instructor, so all of it must ship.

### Conference Planner (persona: Nadia, 1st-year PhD)

| #   | User story                                                                                                                                                                  | Owner |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| P1  | See upcoming ML conferences on a **world map** and **timeline**, filtered by **research area** and **month**                                                                | A     |
| P2  | **Add, edit, delete** conference entries (dates, location, deadlines, research areas)                                                                                       | A     |
| P3  | Create **submission plans** with a **target venue + backup**, **custom milestones**, and a **countdown** to each deadline                                                   | A     |
| P4  | **Edit/delete** plans; get warned on **deadline clashes** (2 deadlines in the same week) and **travel squeeze** (< 6 weeks between acceptance notification and conference start) | A     |

### Review Workspace (persona: Leo, MS thesis)

| #   | User story                                                                                                                  | Owner |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| R1  | **Create, edit, delete** literature reviews, each built around a **research question**                                      | H     |
| R2  | **Search** recent papers by **keyword, research area, year**, read **abstracts**, **add** them to a review                  | H     |
| R3  | Record each saved paper's **reading status, notes, key findings** relative to the question; **edit/remove** saved papers | H     |
| R4  | Link papers into **ordered threads**; see **which saved papers cite each other**                                         | H     |

### Shared / platform

| #   | Feature                                                                                      | Owner |
| --- | -------------------------------------------------------------------------------------------- | ----- |
| C1  | `papers` collection seeded from **OpenAlex** with **1,000+** recent ML papers (read-only)    | H     |
| C2  | **Anonymous ID**: each browser gets an ID; users only see/edit their own plans and reviews | A     |
| C3  | App shell: nav, theme (dark/light), design system, home page with **usage instructions**   | A     |
| C4  | Conference seed data (public listings)                                                       | A     |
| C5  | Optional extra: papers from `papers` that appeared at a selected conference                  | A (stretch) |

---

## 2. Feature tiers

**Core (M)** must ship by Day 3, because the rubric gives 15 pts for "accomplishes all requirements approved".
**Planned (P)** is polish we expect to fit.
**Stretch (X)** is attempted only after everything Core is merged and deployed.

| Tier | Conference Planner (A)                                                                                    | Review Workspace (H)                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| M    | Conference CRUD (dialog form), list view with filters                                                     | Review CRUD (dialog form), list view                                                 |
| M    | World map with pins (static SVG + our own projection maths), click a pin → detail panel                      | Paper search (keyword, area, year range) + paginated results + abstract expand      |
| M    | Hand-drawn SVG timeline (deadline ◆, notification ●, conference bar ▬, "today" line)                     | Add paper → review; reading status, relation, relevance, notes, findings; edit/remove |
| M    | Area chips + month filter shared by map, timeline, list                                                   | Threads: create/rename/delete, add/remove entries, reorder with ↑/↓ buttons         |
| M    | Submission plan CRUD: target + backup, milestones repeater, status, notes                                 | Citation links: list "A cites B" among saved papers + per-paper badges              |
| M    | Live countdown chips (updates every 60 s), deadlines in **AoE**                                           | Review cards show progress bar by status                                             |
| M    | Clash warning (≤ 7 days apart) + travel warning (< 42 days notification→start)                            | Delete review cascades its entries                                                   |
| P    | Home dashboard: next deadline, plan count, review count, "how to use"                                     | Filter reading list by status; sort by year/relevance                                |
| P    | "Plan for this venue" button → prefilled plan form                                                        | "Already added ✓" state in search results                                            |
| P    | "Backup deadline passes before target notification" warning                                               | Empty states + skeleton loaders on all her pages                                     |
| P    | Duplicate a seeded conference into an editable copy                                                     | Paper detail drawer (authors, venue, DOI link, cited-by count)                        |
| X    | Papers at this conference (C5)                                                                            | Citation **graph** in SVG (circular layout → force-directed)                         |
| X    | `.ics` calendar export of a plan                                                                          | Drag-and-drop thread reordering (HTML5 DnD)                                          |
| X    | Map zoom/pan + pin clustering                                                                             | "Suggested papers": cite ≥ 2 of your saved papers                                    |
| X    | Filters synced to URL query string                                                                        | Export review to Markdown / BibTeX                                                   |

---

## 3. Tech stack & constraints

| Layer    | Choice                                                                         | Notes / rubric                                                               |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Runtime  | **Node.js 20+** (use 22 LTS)                                                   | Needed for `import.meta.dirname`, `node --watch`, `crypto.randomUUID`        |
| Server   | **Express 4/5**                                                                | Rubric: node + express (5)                                                   |
| DB       | **MongoDB Atlas (M0 free)** + **native `mongodb` driver**                      | **No Mongoose** (−20). At least 2 collections with CRUD (15). 1,000+ records (5) |
| Modules  | **ESM only**: `"type": "module"`, `import`/`export`                            | **No `require`** (10)                                                        |
| Frontend | **HTML5 + CSS3 + vanilla JS ES modules + Fetch**                               | Client-side rendering only (15). **No template engines** (−20), no React     |
| Viz      | Hand-written **SVG** (timeline, map markers); static public-domain world SVG  | No D3, no Leaflet                                                            |
| Config   | **dotenv** (approved)                                                          | No secrets in git (10)                                                       |
| Quality  | **ESLint** (flat config) + **Prettier**                                        | Lint 0 errors (5), Prettier formatted (5)                                    |
| Data     | **OpenAlex API**, one-time seed script                                         |                                                                              |
| Deploy   | **Render** web service (free) + Atlas                                          | Public & working (5)                                                         |
| Fonts    | Inter + JetBrains Mono via Google Fonts `<link>`                               | Only CSS, no JS library                                                      |
| Icons    | Inline SVG (copy from Lucide, ISC license) in a `icons.js` module              | No icon library dependency                                                   |

**Allowed dependencies (final list, nothing else without asking each other):**

```
dependencies:    express, mongodb, dotenv
devDependencies: eslint, @eslint/js, globals, prettier
```

Anonymous ID is implemented **without cookie-parser**. The browser makes a UUID with `crypto.randomUUID()`, stores it in `localStorage`, and sends it as an `X-Owner-Id` header on every request. This means no extra dependency.

---

## 4. Repository structure & file ownership

Legend: **[S]** shared (built in Sprint 0 by A, then changed only via a `shared:` PR), **[A]** Ayush, **[H]** Harshitha.

```
paperscape/
├── server.js                         [S] express app, static, mounts ALL routers (pre-wired)
├── package.json                      [S] scripts + deps (only A edits)
├── eslint.config.js                  [S]
├── .prettierrc / .prettierignore     [S]
├── .env.example                      [S] MONGODB_URI, DB_NAME, PORT, OPENALEX_API_KEY, OPENALEX_EMAIL
├── LICENSE                           ✓ already MIT
├── README.md                         [H] (F-task)
├── CLAUDE.md                         [S] conventions for both Claude sessions
│
├── db/
│   ├── connection.js                 [S] connect once, export getDb(), closeDb()
│   ├── indexes.js                    [S] ensureIndexes() for all 5 collections
│   ├── conferences.js                [A] data-access functions
│   ├── submissionPlans.js            [A]
│   ├── reviews.js                    [H]
│   ├── reviewEntries.js              [H]
│   └── papers.js                     [H] read-only queries
│
├── lib/
│   └── validation.js                 [S] isNonEmptyString, isObjectIdString, toObjectId, parseDate, pick...
│
├── middleware/
│   ├── owner.js                      [S] reads X-Owner-Id → req.ownerId
│   └── errors.js                     [S] notFound + errorHandler (JSON)
│
├── routes/
│   ├── conferences.js                [A]  (stub in S0 → A fills)
│   ├── plans.js                      [A]
│   ├── reviews.js                    [H]  (includes threads + citations sub-routes)
│   ├── entries.js                    [H]
│   └── papers.js                     [H]
│
├── scripts/
│   ├── seed-conferences.js           [A]
│   ├── data/conferences.json         [A]
│   ├── build-world-map.js            [A] Natural Earth GeoJSON → public/assets/world.svg (run once)
│   └── seed-papers.js                [H] OpenAlex → papers
│
├── docs/
│   ├── PROJECT_PLAN.md               (this file)
│   ├── DESIGN.md                     [H] description, personas, stories, mockups (50 pts!)
│   └── mockups/*.png                 [H] (A reviews planner mockups)
│
└── public/
    ├── index.html                    [A] home / dashboard / how-to-use
    ├── conferences.html              [A]
    ├── plans.html                    [A]
    ├── reviews.html                  [H]
    ├── review.html                   [H] detail page (?id=…)
    ├── favicon.svg                   [S]
    ├── assets/world.svg              [A]
    ├── css/
    │   ├── base.css                  [S] reset, tokens, themes, typography
    │   ├── layout.css                [S] header/nav, container, page grid, footer
    │   ├── components/
    │   │   ├── buttons.css           [S]
    │   │   ├── forms.css             [S]
    │   │   ├── cards.css             [S]
    │   │   ├── dialog.css            [S]
    │   │   ├── toast.css             [S]
    │   │   ├── chips.css             [S]  (area chips, status badges, countdown chips)
    │   │   └── tabs.css              [S]
    │   └── pages/
    │       ├── home.css              [A]
    │       ├── conferences.css       [A]
    │       ├── map.css               [A]
    │       ├── timeline.css          [A]
    │       ├── plans.css             [A]
    │       ├── reviews.css           [H]
    │       └── review.css            [H]
    └── js/
        ├── shared/                   [S] FROZEN after S0
        │   ├── api.js                fetch wrapper, adds X-Owner-Id, JSON, throws ApiError
        │   ├── owner.js              getOwnerId()
        │   ├── dom.js                el(), clear(), qs() — safe DOM building
        │   ├── ui.js                 toast(), confirmDialog(), openDialog(), emptyState(), skeleton()
        │   ├── format.js             dates, AoE helpers, countdown(), relative time
        │   ├── areas.js              AREAS taxonomy (ids, labels, colours), shared by both modules
        │   ├── icons.js              inline SVG icon strings
        │   └── nav.js                active link, theme toggle, mobile menu
        ├── home.js                   [A]
        ├── planner/                  [A]
        │   ├── conferencesPage.js    entry for conferences.html
        │   ├── filters.js
        │   ├── map.js
        │   ├── timeline.js
        │   ├── conferenceDetail.js
        │   ├── conferenceForm.js
        │   ├── plansPage.js          entry for plans.html
        │   ├── planForm.js
        │   ├── countdown.js
        │   └── warnings.js           pure functions, no DOM
        └── review/                   [H]
            ├── reviewsPage.js        entry for reviews.html
            ├── reviewForm.js
            ├── reviewPage.js         entry for review.html (tabs)
            ├── readingList.js
            ├── entryCard.js
            ├── search.js
            ├── threads.js
            └── citations.js
```

**Why this structure prevents collisions:**

1. `server.js` mounts all 5 routers in Sprint 0 using stub files, so **neither of you ever edits `server.js` again**.
2. All 5 HTML pages exist from Sprint 0 with the nav already filled in, so nav links never conflict.
3. `db/indexes.js` already declares indexes for every collection, including Harshitha's.
4. `areas.js` (the taxonomy) is frozen early, and both modules colour-code with it.
5. Each person's code lives in their own folders (`planner/` vs `review/`, own route/db/css files).

---

## 5. Collaboration rules

### Git workflow

- `main` is protected: PR + 1 approval, no force push.
- Branch names: `a/<task-id>-short-name`, `h/<task-id>-short-name` (e.g. `h/H-5-paper-search`).
- **One task (or 2 small ones) per PR.** Small PRs merge fast and conflict less.
- Before starting work each session: `git checkout main && git pull && git checkout -b <branch>`.
- Before opening a PR: `git pull --rebase origin main`, then `npm run lint && npm run format:check`.
- Commit style: `feat(planner): …`, `feat(review): …`, `fix: …`, `docs: …`, `chore: …`, `shared: …`.
- **Review SLA:** approve the other's PR within ~30 min while you're both working. Review by actually running it (`npm run dev`).
- **Shared file change?** Open a separate tiny PR titled `shared: …`, message the other person, and merge it first. Never bundle shared changes into a feature PR.
- **Never commit `.env`.** Run `git status` before every commit.

### Contracts frozen after Sprint 0

- API URL shapes in §7 and JSON shapes in §6.
- `public/js/shared/*` function signatures.
- CSS tokens (`--color-*`, `--space-*`, `--radius-*`) and component class names (`.btn`, `.card`, `.chip`, …).
- `AREAS` ids.

To change a contract: agree in chat → `shared:` PR → both pull.

### Where overlap will happen (and the plan for it)

| Overlap                                               | Plan                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| H needs a new shared UI helper (e.g. a tabs component) | Already included in S0 (`tabs.css`). If something else is needed, a `shared:` PR by whoever needs it |
| `package.json` scripts                                | A pre-adds all scripts in S0 (`seed:papers` included)                                 |
| `db/indexes.js`                                       | Pre-declared in S0; H reviews it during the S0 PR                                     |
| Both touch `README.md` / `DESIGN.md`                  | H owns both files; A sends planner sections/screenshots via PR or chat               |
| Final lint/format pass                                | Done **once**, by A, in F-1 after both features are merged                            |

### Using Claude Code safely as a pair

- `CLAUDE.md` at the repo root holds the rules. Both Claude sessions load it automatically.
- Always tell Claude the **task ID** and say **"only edit files you own per §4"**.
- Ask Claude to run `npm run lint` and `npm run format` before you commit.
- Review Claude's diff yourself before pushing. You're graded on understanding it (video + code review).

---

## 6. Data model

All documents have `createdAt`, `updatedAt` (Date). `ownerId` is the anonymous UUID string.

### `conferences` [A]

```js
{
  _id: ObjectId,
  ownerId: null | "uuid",          // null = seeded (visible to all, read-only in UI)
  name: "Neural Information Processing Systems",
  acronym: "NeurIPS",
  year: 2027,
  areas: ["general", "theory", "genai"],   // AREAS ids
  website: "https://neurips.cc",
  location: { city: "…", country: "…", lat: 45.5, lng: -73.6, venue: "…" },
  startDate: Date, endDate: Date,
  deadlines: {
    abstract: Date | null,          // stored as AoE 23:59 → UTC instant
    paper: Date,
    notification: Date | null,
    cameraReady: Date | null
  },
  datesConfirmed: true | false,     // false → UI shows "estimated" badge
  isSeed: true | false,
  createdAt, updatedAt
}
```

Visibility rule: `GET` returns `{ $or: [{ ownerId: null }, { ownerId: req.ownerId }] }`.
Edit/delete is allowed only where `ownerId === req.ownerId`. Seeded ones offer **Duplicate** in the UI instead.

### `submissionPlans` [A]

```js
{
  _id, ownerId: "uuid",
  paperTitle: "Sparse attention for long-context retrieval",
  targetConferenceId: ObjectId,
  backupConferenceId: ObjectId | null,
  status: "drafting" | "submitted" | "accepted" | "rejected" | "withdrawn",
  milestones: [ { id: "uuid", label: "Experiments done", dueDate: Date, done: false } ],
  notes: "",
  createdAt, updatedAt
}
```

### `reviews` [H]

```js
{
  _id, ownerId: "uuid",
  title: "Thesis: efficient long-context LMs",
  question: "How do sparse attention methods trade off accuracy vs memory beyond 32k tokens?",
  description: "",
  keywords: ["sparse attention", "long context"],
  threads: [
    { id: "uuid", title: "From Longformer to ring attention", note: "", entryIds: [ObjectId, …] }  // ORDERED
  ],
  createdAt, updatedAt
}
```

### `reviewEntries` [H]

```js
{
  _id, ownerId: "uuid",
  reviewId: ObjectId,
  paperId: ObjectId,                       // → papers._id
  status: "to-read" | "reading" | "read" | "skipped",
  relation: "supports" | "challenges" | "method" | "background" | "unsure",  // vs research question
  relevance: 1..5,
  notes: "",
  findings: ["Achieves 2x memory reduction at 64k", …],
  createdAt, updatedAt
}
// unique index { reviewId: 1, paperId: 1 }
```

### `papers` (read-only) [H seeds]

```js
{
  _id, openalexId: "W4385245566",          // unique
  doi: "https://doi.org/…" | null,
  title, abstract,                          // abstract rebuilt from abstract_inverted_index
  year: 2025, publicationDate: Date,
  authors: [ { name, institution } ],       // first 10
  venue: "NeurIPS" | "arXiv" | …,           // primary_location.source.display_name
  areas: ["nlp"],                           // from the seed query that found it
  citedByCount: 123,
  referencedWorks: ["W…", "W…"],            // OpenAlex ids, used for citation links
  openalexUrl: "https://openalex.org/W…"
}
```

### Indexes (`db/indexes.js`, created at server start; idempotent)

| Collection        | Index                                                   |
| ----------------- | ------------------------------------------------------- |
| conferences       | `{ startDate: 1 }`, `{ ownerId: 1 }`, `{ areas: 1 }`    |
| submissionPlans   | `{ ownerId: 1, updatedAt: -1 }`                         |
| reviews           | `{ ownerId: 1, updatedAt: -1 }`                         |
| reviewEntries     | `{ reviewId: 1, paperId: 1 }` **unique**, `{ ownerId: 1, reviewId: 1 }` |
| papers            | `{ openalexId: 1 }` unique, text `{ title: "text", abstract: "text" }` (weights title 5), `{ areas: 1, year: -1 }`, `{ citedByCount: -1 }` |

---

## 7. API contract

Conventions:

- All routes are under `/api`, and all require the header `X-Owner-Id: <uuid v4>`. A missing or invalid header → `400`.
- Request/response bodies are JSON. `_id`s are serialised as strings.
- Error shape: `{ "error": "Human readable message", "details"?: { field: "msg" } }`.
- Status codes: `200` OK, `201` created (returns doc), `204` deleted, `400` validation, `404` not found / not yours, `409` conflict.
- Every query on owned collections **includes `ownerId: req.ownerId`**. That is the whole security model.
- `GET /api/health` → `{ ok: true }` (no owner header needed; used by Render).

### Conferences [A]

| Method | URL                                   | Body / query                                    | Returns                          |
| ------ | ------------------------------------- | ----------------------------------------------- | -------------------------------- |
| GET    | `/api/conferences`                    | `?area=nlp,cv&month=2027-03&q=neur&past=false`  | `[conference]` sorted by next deadline |
| GET    | `/api/conferences/:id`                |                                                 | `conference`                     |
| POST   | `/api/conferences`                    | conference fields (no `_id`, `ownerId`)         | `201 conference`                 |
| PUT    | `/api/conferences/:id`                | full editable fields                            | `conference` (404 if seed/not yours) |
| DELETE | `/api/conferences/:id`                |                                                 | `204`; `409` if used by your plans |
| POST   | `/api/conferences/:id/duplicate`      |                                                 | `201` your editable copy (P)     |
| GET    | `/api/conferences/:id/papers`         |                                                 | `[paper]` (X, C5)                |

`month=YYYY-MM` matches if **any** deadline or the conference itself falls in that month.

### Submission plans [A]

| Method | URL                | Body                                                                         | Returns                                         |
| ------ | ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| GET    | `/api/plans`       |                                                                              | `[plan + target + backup]` (conference docs embedded via `$lookup`) |
| GET    | `/api/plans/:id`   |                                                                              | same shape, one                                 |
| POST   | `/api/plans`       | `{ paperTitle, targetConferenceId, backupConferenceId?, status, milestones[], notes }` | `201`                                  |
| PUT    | `/api/plans/:id`   | same                                                                         | updated                                         |
| PATCH  | `/api/plans/:id/milestones/:mid` | `{ done }`                                                     | updated (checkbox toggle)                       |
| DELETE | `/api/plans/:id`   |                                                                              | `204`                                           |

Validation: target ≠ backup; both conferences must be visible to the owner; milestone labels non-empty; dates valid.
**Warnings are computed client-side** in `warnings.js`, which is pure and easy to demo.

### Reviews + threads + citations [H]

| Method | URL                                          | Body / query                                  | Returns                                   |
| ------ | -------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| GET    | `/api/reviews`                               |                                               | `[review + counts{to-read,reading,read,skipped,total}]` |
| GET    | `/api/reviews/:id`                           |                                               | `review`                                  |
| POST   | `/api/reviews`                               | `{ title, question, description?, keywords? }` | `201`                                    |
| PUT    | `/api/reviews/:id`                           | same                                          | updated                                   |
| DELETE | `/api/reviews/:id`                           |                                               | `204` (also deletes its entries)          |
| POST   | `/api/reviews/:id/threads`                   | `{ title, note? }`                            | `201 thread`                              |
| PUT    | `/api/reviews/:id/threads/:threadId`         | `{ title?, note?, entryIds? }` (ordered)      | updated thread                            |
| DELETE | `/api/reviews/:id/threads/:threadId`         |                                               | `204`                                     |
| GET    | `/api/reviews/:id/citations`                 |                                               | `{ nodes:[{entryId,paperId,title,year}], edges:[{from,to}] }` (from cites to) |

### Review entries [H]

| Method | URL                                  | Body                                                      | Returns                         |
| ------ | ------------------------------------ | --------------------------------------------------------- | ------------------------------- |
| GET    | `/api/reviews/:id/entries`           | `?status=read`                                            | `[entry + paper summary]` (`$lookup`) |
| POST   | `/api/reviews/:id/entries`           | `{ paperId }`                                             | `201`; `409` if already added   |
| PUT    | `/api/entries/:entryId`              | `{ status, relation, relevance, notes, findings[] }`      | updated                         |
| DELETE | `/api/entries/:entryId`              |                                                           | `204` (also `$pull` from threads) |

### Papers (read-only) [H]

| Method | URL                 | Query                                                  | Returns                                   |
| ------ | ------------------- | ------------------------------------------------------ | ----------------------------------------- |
| GET    | `/api/papers`       | `q, area, yearFrom, yearTo, page=1, limit=20 (max 50)` | `{ items:[paper w/o referencedWorks], total, page, pages }` |
| GET    | `/api/papers/:id`   |                                                        | full paper                                |

With `q`, use `$text` and sort by `{ score: { $meta: "textScore" } }`. Without `q`, sort by `citedByCount: -1`.

---

## 8. Frontend architecture & design system

### Principles

- **Multi-page app, client-side rendered.** Each HTML page is a static shell plus a `<script type="module" src="js/…Page.js">`. The JS fetches JSON and builds the DOM.
- **Build DOM with `el()`** from `dom.js`, and put user data in via `textContent` only. Never put user text in `innerHTML` (XSS). The only `innerHTML` allowed is for trusted static strings (icons, map SVG file).
- **Standard elements** (rubric 5 pts):
  - `<button>` for every action, `<a>` for navigation.
  - `<dialog>` for modals, `<form>` + `<label>` for inputs.
  - `<details>/<summary>` for expanders, `<input type="checkbox">` for milestone toggles, `<select>` for status.
  - Never put `onclick` on a `div` or `span`.
- **Forms:** native validation attributes (`required`, `min`, `max`, `type="date"`, `type="url"`) plus server validation. Show server `details` messages next to their fields.
- **One timer:** each page with countdowns uses a single `setInterval(60_000)` that re-renders the countdown chips only.
- **Loading / empty / error states** on every list: skeleton → content | empty state with CTA | error toast + retry button.
- **Accessibility:**
  - Visible focus rings, `aria-label` on icon-only buttons, `aria-live="polite"` on the toast region.
  - SVG pins are `<button>`-equivalent: each is wrapped in `<a href="#" role="button">` with a `<title>`. Better: a parallel accessible list (the List view).
  - Colour is never the only signal; chips carry text.
  - Respect `prefers-reduced-motion`.

### Visual design: "modern academic"

Dark-first with a light theme toggle; the theme is saved in `localStorage` and defaults to `prefers-color-scheme`.

```css
/* base.css tokens (dark) */
--bg: #0b1020;            --surface: #121933;       --surface-2: #1a2342;
--border: rgb(255 255 255 / 0.08);                  --text: #e7eaf3;
--text-muted: #9aa3bd;    --accent: #7c6cff;        --accent-2: #2dd4bf;
--success: #22c55e;       --warning: #f5a524;       --danger: #f04438;
--radius-sm: 8px; --radius: 14px; --radius-lg: 20px;
--space-1: 4px … --space-8: 48px;
--shadow: 0 8px 24px rgb(0 0 0 / 0.25);
--font: "Inter", system-ui, sans-serif;  --mono: "JetBrains Mono", ui-monospace, monospace;
/* light: --bg #f6f7fb, --surface #ffffff, --surface-2 #eef1f8, --text #0f172a, --text-muted #5b6478, --border rgb(15 23 42 / 0.08) */
```

Look and feel:

- A sticky glass header (`backdrop-filter: blur(12px)`) and a subtle radial-gradient hero on home.
- Cards have a 1px border, `--radius`, and a soft hover lift (`translateY(-2px)`, 150 ms).
- Pill-shaped chips; countdown numbers in `--mono`.
- Area colours (`areas.js` + CSS vars `--area-<id>`):

| id         | label                     | colour    |
| ---------- | ------------------------- | --------- |
| general    | General ML                | `#94a3b8` |
| nlp        | NLP                       | `#7c6cff` |
| cv         | Computer Vision           | `#2dd4bf` |
| rl         | Reinforcement Learning    | `#f5a524` |
| genai      | Generative Models         | `#f472b6` |
| theory     | Theory & Optimization     | `#60a5fa` |
| graphs     | Graph Learning            | `#a3e635` |
| robotics   | Robotics                  | `#fb923c` |
| datamining | Data Mining & IR          | `#22d3ee` |

- Countdown chip colour: > 30 days `--success`, 7–30 `--warning`, < 7 `--danger`, passed → muted + "closed".
- Status badges: to-read (muted), reading (accent), read (success), skipped (strikethrough muted).

### Shared JS API (frozen after S0)

```js
// api.js
export const api = { get(path, params), post(path, body), put(path, body), patch(path, body), del(path) };
export class ApiError extends Error { status; details; }

// dom.js
export function el(tag, attrs = {}, ...children)   // attrs: class, dataset, on:{click}, aria-*, etc.
export function clear(node); export const qs = (s, root=document) => root.querySelector(s);

// ui.js
export function toast(message, type = "info");      // info|success|warning|error
export function confirmDialog({ title, message, confirmText = "Delete", danger = true }) // → Promise<boolean>
export function openDialog(dialogEl); export function closeDialog(dialogEl);
export function emptyState({ icon, title, text, actionLabel, onAction });
export function skeleton(count = 3, variant = "card");
export function showFieldErrors(formEl, details);    // maps server details → field messages

// format.js
export function aoeEndOfDay("2027-01-28") /* → Date (23:59 UTC-12) */;
export function toDateInputValue(date);  export function formatDate(date, opts);
export function countdown(date) /* → { days, hours, minutes, passed, label: "12d 4h" } */;
export function urgency(date) /* → "ok" | "soon" | "urgent" | "passed" */;
export function daysBetween(a, b);

// areas.js
export const AREAS = [{ id, label, color, query }];  export const areaById = (id) => …;
```

---

## 9. Page-by-page UI spec

### Global shell (all pages) [S]

```
┌───────────────────────────────────────────────────────────────────────┐
│ ◈ Paperscape   Conferences  Plans  Reviews            [☾/☀]  [≡ mobile] │
├───────────────────────────────────────────────────────────────────────┤
│ <main class="container">  page content                                 │
├───────────────────────────────────────────────────────────────────────┤
│ © 2026 Ayush Patel · Harshitha Seetharaman · CS5610 · GitHub · MIT     │
└───────────────────────────────────────────────────────────────────────┘
```

### `index.html`: Home [A]

- Hero: "Plan your ML submissions. Run your literature review." plus two CTAs (Open Planner / Open Reviews).
- Live stat cards (fetched): **Next deadline** (countdown, venue), **Active plans**, **Reviews**, **Papers in library** (total).
- **How to use Paperscape** section (rubric "instructions"): 3 steps per module with small icons, plus a note that data is tied to this browser (anonymous ID) and clearing storage resets it.

### `conferences.html`: Conference Planner [A]

```
┌ Filters: [area chips… ] [Month ▾] [Search 🔍] [☐ show past]   [+ Add conference] ┐
├ Tabs: ( Map | Timeline | List )                                                  ┤
│ ┌────────────────────────────── map / timeline ───────────────┐ ┌─ Detail ─────┐ │
│ │  world SVG, pins coloured by first area, size by #areas      │ │ NeurIPS 2027 │ │
│ │  hover → tooltip (acronym, city, next deadline)              │ │ 📍 city      │ │
│ │  click → detail panel                                        │ │ deadlines +  │ │
│ └──────────────────────────────────────────────────────────────┘ │ countdowns   │ │
│                                                                  │ [Plan for    │ │
│                                                                  │  this venue] │ │
│                                                                  │ [Edit][Del]  │ │
│                                                                  └──────────────┘ │
```

- Filters apply to all three views at the same time (one `state` object → `render()`).
- **List view:** cards sorted by next upcoming deadline. This is also the accessible view.
- **Add/Edit dialog form:**
  - Fields: name, acronym, year, areas (checkbox group), website, city, country, lat, lng, venue, start/end date, abstract/paper/notification/camera-ready deadlines, "dates confirmed" checkbox.
  - Client checks: end ≥ start, paper ≥ abstract, notification ≥ paper, start ≥ notification.
- Seeded conferences show a "Seeded" badge and a **Duplicate** button instead of Edit/Delete.

### `plans.html`: Submission Plans [A]

```
┌ ⚠ Warnings (2)  ▸ "ICML abstract & ACL ARR deadline are 4 days apart"           ┐
│                 ▸ "CVPR 2027: only 5 weeks between notification and conference" │
├ [+ New plan] ────────────────────────────────────────────────────────────────── ┤
│ ┌ Plan card ─────────────────────────┐ ┌ Plan card ─────────────┐             │
│ │ "Sparse attention for …"   drafting│ │ …                      │             │
│ │ 🎯 ICML 2027   ⟲ backup NeurIPS   │ │                        │             │
│ │ Paper deadline  ⏱ 104d 6h  (AoE)   │ │                        │             │
│ │ Milestones ▓▓▓░░ 3/5               │ │                        │             │
│ │ ☑ Lit review   Nov 1               │ │                        │             │
│ │ ☐ Experiments  Dec 10   ⏱ 55d     │ │                        │             │
│ │ ⚠ travel squeeze                   │ │                        │             │
│ │ [Edit] [Delete]                    │ │                        │             │
│ └────────────────────────────────────┘ └────────────────────────┘             │
```

- **Plan dialog form:**
  - Paper title, target `<select>` (upcoming conferences, grouped by month), backup `<select>`, status, notes.
  - A **milestones repeater** (label + date + remove button; "+ Add milestone").
  - Quick-fill button: "Suggest milestones" generates 4 defaults back-scheduled from the target deadline: −8w lit review, −4w experiments, −2w draft, −3d final polish.
- `plans.html?target=<id>` opens the dialog prefilled (from the conference detail panel).
- Milestone checkboxes `PATCH` immediately (optimistic UI, revert on error).

### `reviews.html`: Reviews list [H]

- Grid of review cards: title, research question (italic, 2-line clamp), progress bar segmented by status, "12 papers · 3 threads", updated relative time, and an **Open** link.
- "+ New review" `<dialog>` form with title, research question (textarea, required), description, keywords (comma separated).
- Edit and Delete on each card; delete uses `confirmDialog` and warns "this also removes N saved papers".

### `review.html?id=…`: Review detail [H]

```
┌ ← Reviews   "Thesis: efficient long-context LMs"                 [Edit] [Delete] ┐
│ ❝ How do sparse attention methods trade off accuracy vs memory…? ❞               │
│ ▓▓▓▓▓░░░ 7 read · 3 reading · 5 to-read                                          │
├ Tabs: ( Reading list | Find papers | Threads | Citations ) ─────────────────────┤
```

- **Reading list:**
  - Status filter chips plus sort (added / year / relevance).
  - Each entry is a card with `<details>`. The summary shows title, authors, year, venue, status badge, relevance, "cited by 2 in review" badge.
  - The expanded form has status `<select>`, relation `<select>`, relevance (5 radio stars), notes `<textarea>`, findings list (add/remove `<li>`), **Save**, **Remove from review**.
  - Abstract is shown collapsed.
- **Find papers:**
  - Search input, area `<select>`, year from/to `<input type="number">`, **Search** button (a `<form>`).
  - Results: title, authors, year, venue, cited-by, "Show abstract" toggle, **Add to review**, or a disabled "Added ✓".
  - Pagination: Prev/Next buttons + "page 2 of 14".
- **Threads:**
  - "+ New thread" form (title, note).
  - Each thread is a numbered vertical stepper of papers with ↑ ↓ ✕ buttons.
  - An "Add paper to thread" `<select>` lists saved entries not in the thread.
  - Thread rename/delete.
- **Citations:**
  - Stats: "9 citation links among 15 saved papers".
  - Grouped list: "**Paper A** cites → Paper B, Paper C".
  - "Most cited within your review" top-3.
  - Stretch: SVG graph.

---

## 10. Key algorithms

### 10.1 World map (A-6)

1. **Get an equirectangular map.**
   - Recommended: `scripts/build-world-map.js` downloads Natural Earth 110m countries GeoJSON (public domain, e.g. `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson`).
   - It projects each polygon with the formula below into `<path d="…">` with `viewBox="0 0 1000 500"`, then writes `public/assets/world.svg` (commit the output).
   - Fallback: a public-domain **equirectangular** SVG from Wikimedia Commons. Check the projection, because Robinson or Mercator would make pins land in the wrong places.
2. **Projection:**

   ```
   x = (lng + 180) / 360 * 1000
   y = (90 - lat) / 180 * 500
   ```

3. `map.js` fetches `world.svg` as text and injects it once (trusted static file). It then appends a `<g id="pins">` holding a `<circle>` per conference (r = 6, fill = area colour, stroke = `--bg`) plus a pulsing ring for deadlines < 14 days away.
4. **Overlapping pins** (same city): offset by `i * 8px` in a small spiral. Real clustering is stretch.
5. **Tooltip:** an absolutely positioned HTML `<div>`, positioned with `getBoundingClientRect` + `svg.getScreenCTM()`.

### 10.2 Timeline (A-7)

- Domain: `today − 1 month` → `today + 12 months`. Use `scale(date) = margin + (date − d0) / (d1 − d0) * width`.
- One row per conference (filtered), sorted by next deadline. Row height 28px. SVG height = rows × 28 + axis.
- **Marks:**
  - Abstract deadline `◇` (outline diamond).
  - Paper deadline `◆` (filled diamond, area colour).
  - Notification `●`.
  - Conference span: rounded `<rect>` from start to end.
  - A dashed thin line connects the paper deadline → conference start.
- Month gridlines + labels on top. A vertical **today** line in `--accent`.
- Build it all with `document.createElementNS("http://www.w3.org/2000/svg", …)`. Each row is a `<g>` with a `<title>` for native tooltips, plus the custom tooltip on hover.
- Horizontal scroll on small screens (`overflow-x: auto` wrapper, min-width 900px).

### 10.3 Warnings (A-9), `warnings.js`, pure functions

```js
// events = for each plan: target.deadlines.abstract/paper + undone milestones (with plan label)
export function findClashes(plans, windowDays = 7)  // pairs of events from DIFFERENT plans within ≤ 7 days, future only
export function findTravelSqueeze(plans, minDays = 42) // target/backup where startDate − notification < 42 days
export function findBackupGap(plans)                  // (P) backup paper deadline < target notification → backup unreachable
```

Sort events by date and compare neighbours with a sliding window, which is O(n log n). Return `{ type, severity, message, planIds }` objects. The page shows them in the top banner and as a ⚠ on each affected card.

### 10.4 Deadlines & AoE

ML deadlines are "Anywhere on Earth" (UTC−12). Forms use `<input type="date">`. Save with `aoeEndOfDay(dateStr) = new Date(\`${dateStr}T23:59:00-12:00\`)`. Display in local time with an "AoE" tag. The server stores `Date`.

### 10.5 Citation links (H-9)

```
entries  = reviewEntries.find({ reviewId, ownerId })
papers   = papers.find({ _id: { $in: entries.map(e => e.paperId) } })
idToEntry = Map(paper.openalexId → entry._id)
edges    = for each paper P, for each ref in P.referencedWorks: if idToEntry.has(ref) → { from: entry(P), to: idToEntry.get(ref) }
```

This is O(total refs), which is tiny. Return nodes + edges; the UI groups edges by `from`.

### 10.6 Seeding papers from OpenAlex (H-2)

**Problem:** 1,000 random papers almost never cite each other, which would leave the Citations tab empty.
**Fix:** seed in **citation clusters** per area.

For each area in `AREAS` (each has a `query`, e.g. nlp → "large language model", cv → "image segmentation", rl → "reinforcement learning", genai → "diffusion model", theory → "optimization convergence", graphs → "graph neural network", robotics → "robot learning", datamining → "recommender system", general → "deep learning"):

1. **Anchors:** `GET /works?search=<query>&filter=from_publication_date:2022-01-01,has_abstract:true&sort=cited_by_count:desc&per_page=10`.
2. **Citers of each anchor:** `GET /works?filter=cites:<anchorId>,from_publication_date:2024-01-01,has_abstract:true&sort=cited_by_count:desc&per_page=15`.
3. **Fill:** `GET /works?search=<query>&filter=from_publication_date:2024-01-01,has_abstract:true&per_page=50`.

Settings for every request:

- Always add `&select=id,doi,title,publication_year,publication_date,abstract_inverted_index,authorships,primary_location,cited_by_count,referenced_works`.
- Authentication: add `&api_key=${OPENALEX_API_KEY}` if you have one, or `&mailto=${OPENALEX_EMAIL}` (polite pool).
- Pacing: sleep 150 ms between requests and retry on 429 with backoff.

Processing:

- Rebuild the abstract: place each word at its positions from `abstract_inverted_index`, then join with spaces.
- Upsert by `openalexId` (`bulkWrite` with `updateOne … upsert: true`). For papers found under several areas, `$addToSet` the area.
- Target **≈ 1,200–1,600** papers (9 areas × (10 + 150 + 50)). Print a count at the end and assert it is ≥ 1,000.
- Skip the paper if the title or abstract is missing. Strip ids to the `W…` form.

---

## 11. Schedule

Each day is 5 focused hours. Times are hours from the session start.

### Day 1: Foundation + first CRUD

| Hour      | Ayush (A)                                                                | Harshitha (H)                                                                 |
| --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 0:00–0:20 | **S0-1 Kickoff together**: read this doc, agree on contracts               | **S0-1 Kickoff together**                                                     |
| 0:20–2:00 | **S0-2 Scaffold** (everything marked [S]) → PR → H reviews → merge       | **H-1 Design doc text** (0:45) → **H-2 Seed papers script** (on its own branch, touches only `scripts/seed-papers.js`) |
| 2:00–2:45 | **A-1 Conference seed data + script**                                    | H-2 continue: run seed against Atlas, verify ≥ 1,000                         |
| 2:45–3:45 | **A-2 Conferences API**                                                  | **H-3 Reviews API** (CRUD + counts)                                           |
| 3:45–5:00 | **A-3 Conferences page: list + filters + dialog CRUD**                   | **H-4 Mockups** (all 5 pages)                                                 |

**End of Day 1:** scaffold merged, papers + conferences seeded, conference CRUD works end-to-end, reviews API works (tested with curl or the Thunder Client extension), mockups done.

### Day 2: Core features

| Hour      | Ayush (A)                                                         | Harshitha (H)                                                         |
| --------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| 0:00–1:15 | **A-4 Plans API**                                                 | **H-5 Reviews page (list + dialog CRUD)**                             |
| 1:15–2:30 | **A-5 Plans page: cards, dialog, milestones, countdown**          | **H-6 Papers search API + Find-papers tab**                           |
| 2:30–3:45 | **A-6 World map**                                                 | **H-7 Entries API**                                                   |
| 3:45–5:00 | **A-7 Timeline**                                                  | **H-8 Reading list tab (entry cards, edit, remove)**                  |

**End of Day 2:** every Core feature except warnings, threads and citations works locally.

### Day 3: Finish core, deploy, polish, submit → **FREEZE**

| Hour      | Ayush (A)                                                                 | Harshitha (H)                                                     |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0:00–0:30 | **A-8 Deploy to Render** (deploy early to find surprises)                  | **H-9 Threads tab**                                               |
| 0:30–1:30 | **A-9 Warnings**                                                          | H-9 continue (till ~1:15) → **H-10 Citations tab**                |
| 1:30–2:30 | **A-10 Home dashboard + how-to-use**                                      | H-10 continue → **H-11 Polish own pages** (empty/loading states)  |
| 2:30–3:30 | **A-11 Polish pass** (responsive, a11y, Planned items) + stretch if green | **F-3 README** + **F-4 slides** + finish DESIGN.md with screenshots |
| 3:30–5:00 | **F-1 Lint/format/cleanup**, **F-2 redeploy + smoke test**, **F-5 video** (together), **F-6 Google Form**, **F-7 freeze tag** | same, together                         |

**Rule:** if Day 3 at hour 2:30 has any Core item unfinished, **skip stretch and polish**. Core first.

**Load balance:** A ≈ 15 h on the harder items (scaffold, SVG map/timeline, warnings, deploy). H ≈ 15 h on more linear CRUD/UI work plus the docs, which are worth 50 + 10 pts, so this is high-value work.

---

## 12. Task list: Shared (Sprint 0)

### S0-1 Kickoff (both, 20 min)

- [ ] Both finished [`docs/SETUP.md`](SETUP.md) §9 "Ready to build" checklist.
- [ ] Both read this doc + `CLAUDE.md`.
- [ ] Both have: Node 22, Atlas access (A adds H as a project member, or shares the `.env` values **privately**, never in git or the class Slack), the OpenAlex key/email, and VS Code with ESLint + Prettier ("format on save" on).
- [ ] Confirm the area taxonomy (§8) and API shapes (§7). Changes are made now, not later.

### S0-2 Scaffold (A, ~1.7 h) → PR `shared: scaffold`

- [ ] `npm init`; `"type": "module"`; `"engines": { "node": ">=20" }`; install deps from §3.
- [ ] Scripts:
  ```json
  "start": "node server.js",
  "dev": "node --watch server.js",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "seed:conferences": "node scripts/seed-conferences.js",
  "seed:papers": "node scripts/seed-papers.js",
  "build:map": "node scripts/build-world-map.js"
  ```
- [ ] `eslint.config.js` (flat): `@eslint/js` recommended; Node globals for root/server files; browser globals for `public/**`; ignore `node_modules`, `public/assets`.
- [ ] `.prettierrc`: `{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }`; `.prettierignore`: `node_modules`, `public/assets/world.svg`, `package-lock.json`.
- [ ] `.vscode/settings.json`: `editor.formatOnSave: true`, `editor.defaultFormatter: "esbenp.prettier-vscode"`, ESLint validate on.
- [ ] `.env.example` with all keys (empty values). Create your local `.env`.
- [ ] `db/connection.js`:
  - Read `MONGODB_URI`, `DB_NAME`, create one `MongoClient`.
  - Export `connectDb()`, `getDb()`, `closeDb()`.
  - Fail fast with a clear message if the URI is missing.
- [ ] `db/indexes.js` with all indexes from §6; called after connect.
- [ ] `lib/validation.js` helpers.
- [ ] `middleware/owner.js` (UUID regex, 400 if missing, skip `/api/health`). `middleware/errors.js` (404 JSON for `/api/*`, 500 handler that logs and hides stack traces).
- [ ] `server.js`:
  - `import 'dotenv/config'`, `express.json()`, `express.static('public')`.
  - `/api/health`, owner middleware on `/api`.
  - **Mount all 5 routers.**
  - Error middleware, `connectDb()` then `listen(PORT)`.
- [ ] Stub routers: `routes/{conferences,plans,reviews,entries,papers}.js`, each exporting a `Router()` with one `GET /` returning `[]`. They are filled in later by their owner.
- [ ] Empty db modules `db/{conferences,submissionPlans,reviews,reviewEntries,papers}.js` exporting nothing yet (or a `collection()` getter).
- [ ] All 5 HTML pages with:
  - `<head>`: meta viewport, title, favicon, Google Fonts, css links (base, layout, components/*, own page css).
  - Shared header/nav/footer markup, a `<main>` with a page heading, `<div id="toast-region" aria-live="polite">`, and a module script.
- [ ] `public/js/shared/*` per §8 signatures, working (not stubs).
- [ ] CSS `base.css`, `layout.css`, `components/*.css` with tokens and both themes; the theme toggle works.
- [ ] `favicon.svg` (simple ◈ mark in accent colour).
- [ ] Verify: `npm run dev` → all 5 pages load, nav works, theme toggles, `GET /api/health` ok, `npm run lint` 0 errors, `npm run format:check` passes.
- [ ] H reviews + merges. **From here on, `shared/` is frozen.**

---

## 13. Task list: Ayush

### A-1 Conference seed data (45 min)

- [ ] `scripts/data/conferences.json`: **~30 conferences**.
  - **Upcoming (2026–27):** NeurIPS, ICML, ICLR, CVPR, ICCV, ECCV (if in window), ACL, EMNLP, NAACL, AAAI, IJCAI, KDD, WWW, SIGIR, WSDM, AISTATS, UAI, COLT, CoRL, ICRA, IROS, RSS, WACV, BMVC, COLING, ECML-PKDD, MLSys, ICASSP, Interspeech, LoG.
  - **Include some with past deadlines**, so the "show past" toggle has something to filter.
- [ ] Each entry: all §6 fields, real `lat/lng` of the host city, areas from `AREAS`.
- [ ] **Accuracy:** use official dates where announced. Otherwise estimate from the previous year's pattern and set `datesConfirmed: false` (the UI shows "estimated"). Spot-check 5 big ones against official sites.
- [ ] `scripts/seed-conferences.js`: deletes only `isSeed: true` docs, inserts the JSON with `ownerId: null, isSeed: true`, converts deadline strings → AoE Dates, then prints the count.
- [ ] **Done when:** `npm run seed:conferences` is idempotent and Compass shows ~30 docs.

### A-2 Conferences API (1 h)

- [ ] `db/conferences.js`: `listVisible(ownerId, filters)`, `getVisible(id, ownerId)`, `create(ownerId, data)`, `updateOwned(id, ownerId, data)`, `deleteOwned(id, ownerId)`, `duplicate(id, ownerId)`, `countPlansUsing(id, ownerId)`.
- [ ] Filters: `area` (`$in`); `month` (`$or` across deadline fields + startDate within the month range); `q` (case-insensitive regex on name/acronym/city, with **escaped input**); `past=false` → only conferences whose endDate ≥ now.
- [ ] `routes/conferences.js`:
  - All endpoints from §7.
  - Validation: required fields, valid areas, lat ∈ [−90, 90], lng ∈ [−180, 180], date ordering, URL format.
  - Returns `{error, details}`.
- [ ] Delete → `409` with a message if any of your plans use the conference.
- [ ] **Done when:** curl/Thunder Client covers create → list → update → delete; editing a seed returns 404.

### A-3 Conferences page: list + filters + CRUD (1.25 h)

- [ ] `conferencesPage.js`:
  - A single `state = { conferences, filters, view, selectedId }`.
  - `load()` → `render()`.
  - Tabs Map | Timeline | List. Map/Timeline render a placeholder until A-6/A-7.
- [ ] `filters.js`: area chips (toggle buttons with `aria-pressed`), month `<select>` (next 12 months), text search (debounced 250 ms), show-past checkbox. Filters call the API with query params.
- [ ] List view cards: acronym + year, name, city/country flag emoji, area chips, next deadline with countdown chip, "estimated" badge.
- [ ] `conferenceDetail.js`: side panel (bottom sheet on mobile) with all deadlines + countdowns, website link, **Plan for this venue** → `plans.html?target=id`, Edit/Delete (own) or Duplicate (seed).
- [ ] `conferenceForm.js`: one `<dialog>` for create + edit, prefill on edit, client date-order validation, server error mapping via `showFieldErrors`, toast on success, refresh list.
- [ ] **Done when:** P2 fully works through the UI.

### A-4 Plans API (1.25 h)

- [ ] `db/submissionPlans.js`: list/get with `$lookup` into conferences for target + backup (unwind, preserve null), create/update/delete scoped by `ownerId`, `toggleMilestone(planId, mid, done, ownerId)` via `arrayFilters` or positional `$`.
- [ ] Validation: paperTitle 1–200 chars; target is required and visible to the owner; backup is optional, ≠ target, visible; status enum; milestones array ≤ 20 with label 1–100 and a valid date; the server assigns milestone `id` (`crypto.randomUUID()`) if missing.
- [ ] **Done when:** full CRUD + milestone toggle works via curl, and another owner ID gets 404.

### A-5 Plans page (1.25 h)

- [ ] `plansPage.js`: load plans + conferences (for selects), render a cards grid (empty state with "Create your first plan" CTA).
- [ ] `planForm.js`: `<dialog>` create/edit; selects show `ACRONYM YEAR · paper deadline date` (upcoming only, sorted); milestones repeater (add/remove rows); **Suggest milestones** button; `?target=` prefill.
- [ ] Card:
  - Status badge, target + backup chips.
  - **Next deadline countdown** (nearest of abstract/paper for target).
  - Milestones list with checkboxes (`PATCH`) and a progress bar.
  - Edit/Delete (confirm dialog).
- [ ] `countdown.js`: one 60 s interval that updates every `[data-countdown]` element from its `data-date`.
- [ ] **Done when:** P3 + edit/delete from P4 work.

### A-6 World map (1.25 h)

- [ ] Run/write `scripts/build-world-map.js` (§10.1) → commit `public/assets/world.svg`.
  - Style land `fill: var(--surface-2)`, `stroke: var(--border)`, ocean = page bg.
  - Keep the file < 200 KB (110m resolution, round coords to 1 decimal).
- [ ] `map.js`:
  - `renderMap(container, conferences, { onSelect })`: inject the SVG once, then (re)draw the pins layer on every filter change.
  - Hover tooltip; click → `onSelect(id)`; selected pin enlarged + ring.
  - Pins of urgent (< 14 d) deadlines pulse via CSS animation (disabled under reduced-motion).
- [ ] Legend: area colour swatches (only areas present).
- [ ] **Done when:** NeurIPS lands on the right city, and filters update the pins live.

### A-7 Timeline (1.25 h)

- [ ] `timeline.js`: `renderTimeline(container, conferences, { onSelect })` per §10.2.
- [ ] Legend for the mark types. Clicking a row selects the conference (same detail panel).
- [ ] Rows with `datesConfirmed:false` use a dashed conference bar.
- [ ] **Done when:** the month filter visibly narrows rows, the "today" line is correct, and it scrolls horizontally on mobile.

### A-8 Deploy (30 min)

- [ ] Render → New Web Service → connect `ayushp2207/paperscape`.
  - Settings: runtime Node, build `npm ci`, start `npm start`, health check `/api/health`.
  - Env vars: `MONGODB_URI`, `DB_NAME`, `NODE_VERSION=22`.
- [ ] Atlas Network Access must include `0.0.0.0/0`.
- [ ] Smoke test the deployed URL (all pages, create/delete a plan). Note the URL in README.
- [ ] Note: the free tier sleeps after idle and the first request takes ~50 s. **Open it 2 min before the demo/video.**

### A-9 Warnings (1 h)

- [ ] `warnings.js` pure functions per §10.3 (+ `findBackupGap` as Planned).
- [ ] Top-of-page collapsible warnings banner (`<details open>`) + ⚠ badge on affected cards with the message in a tooltip/`title`.
- [ ] Recompute on every plans change.
- [ ] **Self-check:** create two plans with deadlines 3 days apart → clash appears; pick a conference with notification 5 weeks before start → travel warning appears. **Put such a conference in the seed data so the demo is easy.**

### A-10 Home dashboard (45 min)

- [ ] `index.html` + `home.js` + `home.css` per §9.
- [ ] Stat cards fetch `/api/plans`, `/api/reviews`, `/api/papers?limit=1` (for `total`).
- [ ] **How to use** section (rubric). Footer links: GitHub, class page, design doc.

### A-11 Polish pass, own pages (1 h)

- [ ] Responsive: 360px, 768px, 1280px. Detail panel → bottom sheet on mobile.
- [ ] Keyboard: tab through filters, open/close dialogs with Esc, focus returns to the trigger.
- [ ] Planned items if time: Duplicate seed, backup-gap warning, `?target=` prefill.
- [ ] Remove `console.log`s and unused functions.

---

## 14. Task list: Harshitha

### H-1 Design doc text (45 min) → `docs/DESIGN.md`

- [ ] **Project description:** expand the proposal paragraph (problem, solution, who it's for).
- [ ] **User personas:** Nadia and Leo, each with a short bio, goals, frustrations, and tech comfort. Optionally a portrait placeholder.
- [ ] **User stories:** the 8 stories from §1, each with 2–3 acceptance criteria.
- [ ] Sections stubbed for: Mockups, Data model (copy §6 summary), Architecture diagram (simple box diagram: Browser ↔ Express ↔ MongoDB ↔ OpenAlex seed).

### H-2 Papers seed script (1.5 h)

- [ ] `scripts/seed-papers.js` per §10.6. **Order:** write the OpenAlex fetch + transform part first (log to console, no DB) while the scaffold PR is open. Once S0-2 merges (~hour 2), rebase and wire in `db/connection.js` to do the upserts. It reads `AREAS` queries. Duplicate the small query map inside the script if importing the browser module is awkward, or import `public/js/shared/areas.js` directly, since it is plain ESM.
- [ ] Logs progress per area; final summary: total papers, papers with ≥ 1 in-collection reference (a proxy for citation density).
- [ ] Run it against Atlas. **Done when:** ≥ 1,000 docs, the text index works (`db.papers.find({$text:{$search:"diffusion"}})` returns results), and ≥ 30 % of papers reference another paper in the collection.

### H-3 Reviews API (1 h)

- [ ] `db/reviews.js`:
  - `listWithCounts(ownerId)`: aggregate reviews + `$lookup` on reviewEntries grouped by status, or do a second query and merge.
  - `get`, `create`, `update`, `remove` (also `reviewEntries.deleteMany({reviewId})`).
- [ ] Validation: title 1–120, question 1–500, keywords ≤ 10 strings.
- [ ] `routes/reviews.js` with CRUD endpoints (threads + citations come in H-9/H-10, same file).
- [ ] **Done when:** curl CRUD works and other owners get 404.

### H-4 Mockups (1.25 h) → `docs/mockups/`

- [ ] Use **Excalidraw** (fastest) or Figma. Draw mid-fi mockups of all 5 pages following §9 layouts and the colour tokens in §8. Include a mobile view of at least 1 page.
- [ ] Export PNGs: `home.png`, `conferences.png`, `plans.png`, `reviews.png`, `review.png`, `mobile.png`. Embed them in DESIGN.md with captions explaining the interactions.
- [ ] A reviews the planner mockups (5 min).

### H-5 Reviews page (1.25 h)

- [ ] `reviewsPage.js` + `reviewForm.js` + `reviews.css` per §9.
- [ ] Card progress bar = 4 coloured segments by status counts (pure CSS flex with widths as %).
- [ ] Create/edit dialog, delete with confirm (shows entry count). Toasts. Skeleton on load. Empty state CTA.
- [ ] **Done when:** R1 fully works through the UI.

### H-6 Paper search API + Find-papers tab (1.25 h)

- [ ] `db/papers.js`: `search({ q, area, yearFrom, yearTo, page, limit })` returning `{ items, total, page, pages }`. Use a projection to exclude `referencedWorks`. Add `getById`.
- [ ] `routes/papers.js`: validate and clamp numbers (limit ≤ 50, page ≥ 1, years 2000–2030).
- [ ] `review.html` skeleton: header (title, question, progress), tabs (`<button role="tab">`). `reviewPage.js` loads the review + entries and owns `state`.
- [ ] `search.js`: search `<form>`, result cards, abstract toggle (`<details>`), **Add to review** (POST entry → button becomes "Added ✓"), pagination buttons.
- [ ] **Done when:** R2 fully works (search "diffusion", filter CV 2025, add 3 papers).

### H-7 Entries API (1.25 h)

- [ ] `db/reviewEntries.js`:
  - `listForReview(reviewId, ownerId, status?)` with `$lookup` papers (project title, authors, year, venue, abstract, doi, citedByCount, openalexUrl).
  - `add(reviewId, paperId, ownerId)`: verify the review is yours and the paper exists; catch the duplicate-key error → 409.
  - `update(entryId, ownerId, data)`.
  - `remove(entryId, ownerId)` + `$pull` the entryId from all threads in that review.
- [ ] `routes/entries.js`: `PUT/DELETE /api/entries/:entryId`.
- [ ] Nested `GET/POST /api/reviews/:id/entries`: put these in `routes/reviews.js` (her file), calling `db/reviewEntries.js`.
- [ ] Validation: status/relation enums, relevance 1–5, notes ≤ 5,000, findings ≤ 20 × 300 chars.

### H-8 Reading list tab (1.25 h)

- [ ] `readingList.js` + `entryCard.js` per §9: status filter chips, sort select, entry `<details>` cards with the edit `<form>` (status, relation, relevance radios, notes, findings add/remove), Save → PUT + toast, Remove → confirm + DELETE.
- [ ] Header progress bar updates after each change.
- [ ] **Done when:** R3 fully works.

### H-9 Threads tab (1.25 h)

- [ ] API in `routes/reviews.js` + `db/reviews.js`:
  - POST thread (server sets `id`).
  - PUT thread (validate every `entryId` belongs to this review).
  - DELETE thread with `$pull`.
- [ ] `threads.js`: new-thread form; each thread as an `<ol>` stepper with ↑ ↓ ✕ `<button>`s (each sends the new `entryIds` order via PUT); "Add paper" `<select>`; rename (inline form) and delete.
- [ ] **Done when:** R4a works: create a thread with 3 papers, reorder, reload, and the order persists.

### H-10 Citations tab (1 h)

- [ ] `GET /api/reviews/:id/citations` per §10.5.
- [ ] `citations.js`: stat line, grouped list "A cites → B, C" (click a title → switches to the Reading list and opens that entry), "Most cited in this review" top 3. Also add "cited by N in review" badges into `entryCard.js`.
- [ ] Empty-state copy: "None of your saved papers cite each other yet. Try adding papers from the same thread of work."
- [ ] **Demo tip:** find a seeded anchor paper + 3 of its citers and add them to a demo review.

### H-11 Polish own pages (30 min)

- [ ] Loading skeletons, empty states, error toasts with retry on reviews + review pages.
- [ ] Mobile check at 360px (tabs scroll horizontally, cards stack).
- [ ] Remove `console.log`s / unused code.

---

## 15. Final submission tasks

| ID  | Task                                                                                                                                                                                                                    | Owner | Time   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| F-1 | `npm run lint` → 0 errors; `npm run format`; delete unused files, stub code, `console.log`s, commented-out code; confirm no secrets: `git log -p \| grep -i "mongodb+srv"` returns nothing                              | A     | 20 min |
| F-2 | Merge, redeploy, full smoke test on the **deployed** URL using the §19 checklist                                                                                                                                       | A     | 20 min |
| F-3 | **README.md**: title + one-line pitch, **Authors**, **Class link** (CS5610 course page URL), **Project objective**, **Screenshot** (home + planner + review), **Live demo link**, **Video link**, **Design doc link**, features list, tech stack, **Instructions to build** (clone → `npm i` → `.env` from `.env.example` → `npm run seed:conferences` → `npm run seed:papers` → `npm run dev`), usage, license | H | 30 min |
| F-4 | **Slides** (5–6): problem, personas, demo screenshots, architecture, tech highlights (SVG map/timeline, citation clustering seed), what's next                                                                           | H     | 30 min |
| F-5 | **Narrated video**, 3–5 min, **public** (YouTube public/unlisted per instructor). Script: intro both (15 s) → A demos P1–P4 (90 s) → H demos R1–R4 (90 s) → code tour: modules, ESM, db layer, no Mongoose (30 s) → outro | both | 40 min |
| F-6 | **Google Form** submission: thumbnail = 16:9 screenshot of the home or map view (check it renders); links: repo, deployed app, video, design doc, slides. Test every link in an incognito window                         | H     | 10 min |
| F-7 | **Code freeze ≥ 24 h before class**: tag `git tag v1.0-freeze && git push --tags`. No pushes after                                                                                                                      | A     | 2 min  |
| F-8 | **Code review** (20 pts): after submission, each of you completes the assigned peer code reviews on time                                                                                                               | both  | later  |

---

## 16. Stretch backlog

Only start these when the **Core** row of every module is merged and deployed. Each goes on its own branch, so it can be abandoned without harm.

| ID   | Item                                                     | Owner | Est.  | Gotchas                                                                                                    |
| ---- | -------------------------------------------------------- | ----- | ----- | ---------------------------------------------------------------------------------------------------------- |
| X-1  | Papers at this conference (proposal's optional extra)   | A     | 1 h   | Match `papers.venue` regex on acronym/name + `year`. OpenAlex venue names are messy and arXiv dominates, so expect few hits. Seed may need venue-targeted queries |
| X-2  | `.ics` export of a plan's deadlines + milestones         | A     | 45 m  | Build the text in JS, `Blob` + `<a download>`. Use UTC `Z` times; escape commas/semicolons                     |
| X-3  | Map zoom/pan + pin clustering                            | A     | 1.5 h | Change `viewBox` on wheel/drag; cluster by screen-distance grid; touch events                              |
| X-4  | Filters synced to URL                                    | A     | 30 m  | `URLSearchParams` + `history.replaceState`; restore on load                                                |
| X-5  | "My deadlines" overlay on the timeline (from plans)      | A     | 45 m  | Needs `/api/plans` on the conferences page                                                                 |
| X-6  | Citation graph SVG                                       | H     | 1.5 h | Start with a **circular layout** (easy, deterministic); force-directed only if time. Arrowheads via `<marker>` |
| X-7  | Drag-and-drop thread reordering                          | H     | 1 h   | HTML5 DnD does not work on mobile, so **keep the ↑/↓ buttons** as the accessible fallback                    |
| X-8  | Suggested papers (cite ≥ 2 of your saved papers)         | H     | 1 h   | Query `papers.find({ referencedWorks: { $in: savedIds } })` then count overlaps; exclude already-saved      |
| X-9  | Export review → Markdown / BibTeX                        | H     | 45 m  | BibTeX keys need sanitising; authors "Last, First"                                                          |
| X-10 | Keyboard shortcuts (`/` focus search, `n` new item)      | both  | 30 m  | Ignore when focus is inside an input                                                                        |

---

## 17. Rubric mapping

| Rubric item (pts)                                         | Where / how                                                               | Owner |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| Design doc: description, personas, stories, mockups (50) | `docs/DESIGN.md` + `docs/mockups/`                                         | H     |
| Accomplishes approved requirements (15)                   | §1 features all Core                                                       | both  |
| Usable + instructions (5)                                 | Home "How to use", empty states with CTAs, README usage                    | A/H   |
| Useful (5)                                                | Real conference data, real OpenAlex papers, warnings                       | both  |
| ESLint config, 0 errors (5)                               | `eslint.config.js`, `npm run lint` in F-1                                  | A     |
| Code organised: pages, db, css folders (5)                | §4 structure                                                               | both  |
| JS in modules (15)                                        | `db/*`, `routes/*`, `public/js/shared/*`, `planner/*`, `review/*`          | both  |
| Client-side rendering, vanilla JS (15)                    | Static HTML shells + fetch + `el()`                                        | both  |
| At least 1 form (15)                                      | 6+ forms: conference, plan, review, entry edit, search, thread             | both  |
| Deployed + works (5)                                      | Render (A-8, F-2)                                                          | A     |
| ≥ 2 collections with CRUD (15)                            | conferences, submissionPlans, reviews, reviewEntries (4 with full CRUD)    | both  |
| > 1,000 records (5)                                       | `papers` seeded 1,200+                                                     | H     |
| Node + Express (5)                                        | `server.js`                                                                | A     |
| Prettier formatted (5)                                    | `.prettierrc`, `npm run format:check`                                      | A     |
| Standard tags, no div-buttons (5)                         | §8 principles; check in F-1                                                | both  |
| CSS by modules (5)                                        | `css/base`, `css/layout`, `css/components/*`, `css/pages/*`                | both  |
| README complete (10)                                      | F-3                                                                        | H     |
| No exposed credentials (10)                               | `.env` ignored, `.env.example` only, Render env vars, F-1 grep             | A     |
| package.json lists deps (5)                               | S0-2                                                                       | A     |
| MIT license (5)                                           | `LICENSE` ✓ already                                                        | done  |
| No leftover code (5)                                      | F-1 cleanup, no stub routes left                                           | A     |
| Google Form correct (5)                                   | F-6                                                                        | H     |
| Public narrated video (10)                                | F-5                                                                        | both  |
| Frozen on time; video/slides/deploy before class (5)      | F-7 tag                                                                    | A     |
| No CJS / `require` (10)                                   | `"type":"module"`; `grep -r "require(" --exclude-dir=node_modules .` → empty | A   |
| No Mongoose / template engines (−20)                      | deps list in §3                                                            | both  |
| Code review (20)                                          | F-8                                                                        | both  |

---

## 18. Risks & mitigations

| Risk                                                         | Mitigation                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Merge conflicts in shared files                              | All shared files built in S0 and frozen; routers + pages pre-wired; `shared:` PR rule             |
| Saved papers never cite each other → empty Citations tab     | Citation-cluster seeding (§10.6); demo review built from an anchor + citers                       |
| OpenAlex rate limit / API key changes                        | 150 ms pacing, retry on 429, `mailto` fallback; seed runs once and results stay in Atlas          |
| Conference dates for 2027 not yet announced                  | `datesConfirmed:false` + "estimated" badge; honest in the video                                   |
| Wrong map projection → pins in the ocean                     | Generate the SVG ourselves with the same formula as the pins (§10.1)                              |
| Timezone bugs (deadline shows the wrong day)                 | AoE helper in `format.js` used everywhere; store `Date`, display local + "AoE" tag                |
| Atlas blocks Render                                          | `0.0.0.0/0` in Network Access before A-8                                                          |
| Render cold start during demo                                | Warm it up 2 min before; mention in the video                                                     |
| Secrets leak                                                 | `.env` in `.gitignore` (already), never paste the URI in chat/Slack, F-1 grep. If leaked: rotate the Atlas password immediately |
| Claude edits files the person doesn't own                    | `CLAUDE.md` ownership table + task ID in every prompt + review diffs before commit                |
| Running out of time                                          | Core-first rule at Day 3 hour 2:30; stretch only on separate branches                             |
| XSS via notes/titles                                         | `textContent` only for user data (`el()` helper)                                                  |

---

## 19. Definition of Done & manual test checklist

**A task is done when:**

- It works in the browser with no console errors.
- `npm run lint` is clean and `npm run format` has been run.
- It uses only standard interactive elements.
- It has loading/empty/error states.
- It works with a **second browser profile** (different owner ID sees none of your data).
- It is merged to `main` and the box is ticked here.

**Final smoke test (local + deployed):**

- [ ] Home loads stats; theme toggle persists across pages.
- [ ] Conferences: filter by area + month updates map, timeline and list; click pin → detail; add/edit/delete own conference; seed can't be edited; delete-in-use shows 409 message.
- [ ] Plans: create with target + backup + 3 milestones; countdown ticks; toggle milestone; clash + travel warnings appear for the demo data; edit; delete.
- [ ] Reviews: create/edit/delete; open detail; search "transformer", filter area + years, page 2; add 5 papers; edit status/notes/findings; remove one.
- [ ] Threads: create, add 3 papers, reorder, reload, order persists; delete a thread.
- [ ] Citations: demo review shows ≥ 3 links.
- [ ] Incognito window (new owner ID): sees seeded conferences only, no plans/reviews.
- [ ] Mobile width 375px: nav, dialogs, map, timeline scroll, tabs all usable.
