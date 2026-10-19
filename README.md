# Paperscape

Plan your ML and networking submissions and run your literature review in one place.

**Live demo:** https://paperscape-odl1.onrender.com

> Hosted on Render's free tier. The first load after a period of inactivity can take up to a minute while the server wakes up; the pages show a loading placeholder and say so.

![Paperscape home page](docs/mockups/screens/home.png)

## Authors

| Author                                                                     | Built                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Ayush Nimeshkumar Patel** · [@ayushp2207](https://github.com/ayushp2207) | Conference Planner, submission plans, home page, shared scaffold, hosting |
| **Harshitha Seetharaman** · [@Harshiacchu](https://github.com/Harshiacchu) | Review Workspace, paper library and search, design document and mockups   |

**Class:** [CS5610 Web Development, Northeastern University](https://johnguerra.co/classes/webDevelopment_online_summer_2026/index.html)

## Contents

[Objective](#project-objective) · [Features](#features) · [Screenshots](#screenshots) · [How to use](#how-to-use) · [Who built what](#who-built-what) · [Tech stack](#tech-stack) · [Project structure](#project-structure) · [Run locally](#build-and-run-locally) · [Quality](#quality) · [Documentation](#documentation)

## Project objective

Graduate students in machine learning and networking juggle two jobs in separate tools:

- **Getting a paper out on time:** deadlines are scattered across conference sites, written in "Anywhere on Earth" time and extended without notice; students need a target venue, a backup, and enough time after acceptance to get a visa.
- **Understanding a field:** a literature review starts as browser tabs and a spreadsheet; it is hard to see which papers matter for _your_ question, what you have read, and how the papers connect.

Paperscape brings both together on one site with no sign-up. The full problem statement, personas, user stories, mockups and design decisions are in the **[design document](docs/DESIGN.md)**.

## Features

### Conference Planner

- **Three views of every upcoming conference:** a hand-drawn SVG world map, a timeline and a filterable list, filtered by research area and month, with live countdowns to every deadline in AoE.
- **Always up to date:** a daily GitHub Action refreshes dates, venues and deadlines, adds new editions as they are announced and flags extended deadlines in a review pull request.
- **Add, edit, duplicate and delete** conferences; seeded ones are read-only and can be duplicated into an editable copy.
- **Submission plans:** a target venue and a backup, custom or suggested milestones, and warnings for clashing deadlines or too little time between notification and the conference.
- **Report a broken conference link** from the conference panel.

### Review Workspace

- **Question-first reviews:** type a research question; the title, research area and keywords are suggested from it (matched against 600 research phrases mined from the paper library, in the browser, with no extra requests) and can be changed. A live preview card builds as you type.
- **Find papers** in a library of 1,262 recent papers from OpenAlex: a search sentence ("Find papers about … in … from … to …") pre-filled from the review, server-side paging (5/10/50 per page), full details in a popup, and "find papers that cite this".
- **Reading list:** reading status, a half-star relevance rating, the paper's role for your question, notes in the margin that save on their own, and key findings.
- **Threads:** ordered paths through your papers, with read progress, citation evidence between stops and suggested next papers.
- **Citations:** which saved papers cite each other, the review's most cited "foundations", and papers not connected yet.
- **Orbit map:** your question at the centre and your papers orbiting it: closer means more relevant, colour shows reading status, arrows show who cites whom, and a thread is drawn as a path. It can be paused and respects "reduce motion".
- **Report a broken paper link**, with the paper's OpenAlex page offered as a backup link.

### Both halves

- **No sign-up:** each browser gets an anonymous id, and every plan and review is private to it.
- **Dark and light themes**, layouts for phones up to wide screens, and loading, empty and error states on every page.

## Screenshots

| Reviews: question-first composer                     | Review: orbit map                                       |
| ---------------------------------------------------- | ------------------------------------------------------- |
| ![Reviews page](docs/mockups/screens/reviews.png)    | ![Orbit map](docs/mockups/screens/review-map.png)       |
| **Conference Planner: world map**                    | **Review: reading list with margin notes**              |
| ![Conferences](docs/mockups/screens/conferences.png) | ![Reading list](docs/mockups/screens/review-list.png)   |
| **Review: find papers**                              | **Review: citations**                                   |
| ![Find papers](docs/mockups/screens/review-find.png) | ![Citations](docs/mockups/screens/review-citations.png) |

More screens, wireframes and the design exploration are in the [design document](docs/DESIGN.md#5-mockups).

## How to use

1. **Plan a submission:** open **Conferences**, filter by research area or month, and pick a venue on the map, timeline or list. Choose **Plan for this venue**, then on **Plans** add a backup and milestones; warnings appear if deadlines clash or travel time is short.
2. **Start a review:** on **Reviews**, type your research question and press Enter. Accept or change the suggested title, area and keywords.
3. **Gather papers:** on the review's **Find papers** tab, refine the search sentence and press **Add to review** on useful papers.
4. **Read and annotate:** on **Reading list**, set each paper's status and stars, write notes in the margin and add key findings.
5. **Connect:** build an ordered **Thread**, check **Citations** for who cites whom, and explore the **Map**.

The home page has the same guide, and every empty page explains what to do next.

## Who built what

The project is split into two halves of equal scope, each owned end to end (database, API, pages and styles), on top of a shared scaffold. Work landed through pull requests on feature branches; `main` is protected and deploys automatically.

| Area                | Ayush Nimeshkumar Patel                                                                                      | Harshitha Seetharaman                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Product**         | Conference Planner (map, timeline, list, filters, detail panel), submission plans and warnings, home page    | Review Workspace: reviews, reading list, paper search, threads, citations, orbit map                                                       |
| **Data**            | `conferences`, `submissionPlans`, `linkReports`; conference data from ccf-deadlines and official sites       | `papers` (1,262 papers seeded from OpenAlex as citation clusters), `reviews`, `reviewEntries`; topic vocabulary mined from the papers      |
| **API**             | 13 endpoints: conferences, plans, milestones, link reports                                                   | 17 endpoints: reviews, entries, threads, citations, paper search (text index, `cites` filter), topics, paper link reports                  |
| **Frontend**        | 12 planner modules: SVG world map and timeline, countdowns, warnings, plan and conference forms              | 22 review modules: composer, cards, review page and tabs, search, reading list, threads, citations, orbit map, pager, loading placeholders |
| **Platform**        | Scaffold (server, shared CSS and JS modules, nav, theme), Render deployment, daily conference-tracker Action | Transactions for cascading deletes, stale-tab recovery, URL-state for tabs and search                                                      |
| **Docs and design** | [Setup guide](docs/SETUP.md), [project plan](docs/PROJECT_PLAN.md)                                           | [Design document](docs/DESIGN.md) (personas, user stories, decisions), [wireframes and screens](docs/mockups/), this README                |

## Tech stack

- **Backend:** Node.js 20+, Express 5, MongoDB with the native driver (no Mongoose), ES modules only.
- **Frontend:** HTML, CSS and vanilla JavaScript ES modules; client-side rendering with a small `el()` helper; hand-drawn SVG for the world map, timeline and orbit map. No frameworks or template engines.
- **Data:** MongoDB Atlas; [OpenAlex](https://openalex.org) for papers (seed script only); [ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) and official sites for conferences.
- **Tooling:** ESLint, Prettier, GitHub Actions (daily conference tracker), Render hosting.
- **Dependencies:** `express`, `mongodb`, `dotenv` (dev: `eslint`, `@eslint/js`, `globals`, `prettier`).

## Project structure

```
server.js                 Express app: static files, /api routes, error handling
db/                       All MongoDB queries, one module per collection (+ connection, indexes)
routes/                   Input validation and response shaping, one router per resource
lib/  middleware/         Validation helpers; anonymous-owner and error middleware
public/
  *.html                  index, conferences, plans, reviews, review
  js/shared/              api, dom, ui, format, areas, icons, nav, owner
  js/planner/             Conference Planner modules
  js/review/              Review Workspace modules
  css/                    base, layout, components/, pages/ (one stylesheet per page)
scripts/                  seed-papers, seed-conferences, track-conferences, build-world-map
docs/                     DESIGN.md, SETUP.md, PROJECT_PLAN.md, mockups/
.github/workflows/        Conference tracker and data publishing
```

## Build and run locally

Requires Node.js 20.11+ and a MongoDB connection string (for example a free MongoDB Atlas cluster).

```bash
git clone https://github.com/ayushp2207/paperscape.git
cd paperscape
npm install
cp .env.example .env   # then fill in MONGODB_URI
npm run seed:conferences
npm run seed:papers    # needs OPENALEX_EMAIL (and optionally OPENALEX_API_KEY)
npm run dev            # http://localhost:3000
```

| Variable           | Needed for              | Notes                                           |
| ------------------ | ----------------------- | ----------------------------------------------- |
| `MONGODB_URI`      | The app and all scripts | Never committed; `.env` is gitignored           |
| `DB_NAME`          | Optional                | Defaults to `paperscape`                        |
| `PORT`             | Optional                | Defaults to `3000`; set by Render in production |
| `OPENALEX_EMAIL`   | `npm run seed:papers`   | Puts the seed in OpenAlex's polite pool         |
| `OPENALEX_API_KEY` | `npm run seed:papers`   | Optional                                        |

| Script                      | What it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run dev`               | Start the server and restart on changes                              |
| `npm start`                 | Start the server (production)                                        |
| `npm run seed:papers`       | Load ~1,260 recent papers from OpenAlex (re-runnable, never deletes) |
| `npm run seed:conferences`  | Load conferences from `scripts/data/conferences.json`                |
| `npm run track:conferences` | Refresh conference data (runs daily in GitHub Actions)               |
| `npm run lint` / `format`   | ESLint (0 errors) / Prettier                                         |

## Quality

- **Lint and format:** ESLint reports 0 errors and the whole repository passes Prettier.
- **Accessibility:** standard buttons, links, labels, fieldsets and dialogs; keyboard tabs; star ratings and statuses as radio groups; map papers reachable with Tab and Enter; motion can be paused and respects "reduce motion".
- **Responsive:** checked at 360, 768, 1280 and 1600 px wide, in dark and light themes, with no sideways scrolling.
- **Resilience:** loading placeholders and a "server waking up" note; retry on failure; optimistic saves that roll back; reload when data changed in another tab; corrected or ignored bad URL values; broken-link reports with backup links. The full list is in the [design document](docs/DESIGN.md#10-accessibility-performance-and-resilience).
- **Security:** every query on user data is scoped to the browser's anonymous id; user text is rendered with `textContent`, never `innerHTML`; secrets live only in environment variables.

## Documentation

- [Design document](docs/DESIGN.md): problem, personas, user stories, design decisions, mockups, data model, architecture, API
- [Setup guide](docs/SETUP.md): accounts, database, hosting and the day-to-day workflow
- [Project plan](docs/PROJECT_PLAN.md): task list, API contract and data model in detail

## Data sources

- Conference dates, locations and deadlines: [ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT License, © ccfddl contributors) and the conferences' official websites. Editions that haven't been announced yet are shown as "TBD".
- Papers: [OpenAlex](https://openalex.org) (CC0).

## License

[MIT](LICENSE)
