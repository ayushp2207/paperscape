# Paperscape: one-time setup guide

Everything that has to be set up **by hand** before (and around) coding: accounts, cloud services, local tools, secrets, and hosting. Read it top to bottom once. Each section says **who** does it and **how long** it takes.

> **Ayush** owns the accounts (GitHub repo, Atlas cluster, Render service) and invites Harshitha.
> **Harshitha** follows the "Teammate" steps in each section.
> Total time: ~1 h for Ayush, ~30 min for Harshitha.

---

## Contents

0. [Overview: what lives where](#0-overview)
1. [Local tools (both)](#1-local-tools)
2. [GitHub: repo, access, branch rules (Ayush → Harshitha)](#2-github)
3. [MongoDB Atlas: database in the cloud (Ayush → Harshitha)](#3-mongodb-atlas)
4. [OpenAlex: paper data source (Harshitha)](#4-openalex)
5. [The `.env` file and sharing secrets safely (both)](#5-the-env-file--sharing-secrets)
6. [Render: hosting the website publicly (Ayush)](#6-render-hosting)
7. [Other tools: mockups, video, slides (both)](#7-other-tools)
8. [Working together day to day](#8-working-together-day-to-day)
9. ["Ready to build" checklist](#9-ready-to-build-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 0. Overview

```
             ┌───────────────────────────── GitHub (ayushp2207/paperscape) ─────────────────────────────┐
             │  main (protected)  ◄── PRs ── a/... branches (Ayush)   h/... branches (Harshitha)        │
             └───────────────┬──────────────────────────────────────────────────────────────────────────┘
                             │ auto-deploy on every merge to main
                             ▼
  Anyone on the internet ──► Render Web Service  (https://paperscape-xxxx.onrender.com)
                             │  Node + Express, env vars stored in Render
                             ▼
                        MongoDB Atlas M0 cluster  ◄── Ayush's laptop (npm run dev)
                          db: "paperscape"         ◄── Harshitha's laptop (npm run dev)
                             ▲
                             │ one-time seed (run locally by Harshitha)
                        OpenAlex API
```

| Thing         | Account owner | Teammate access                                   | Cost      |
| ------------- | ------------- | ------------------------------------------------- | --------- |
| GitHub repo   | Ayush         | Collaborator (write)                              | Free      |
| MongoDB Atlas | Ayush         | Own database user (+ optional read-only Atlas UI) | Free (M0) |
| OpenAlex      | Harshitha     | Not needed (seed runs once)                       | Free      |
| Render        | Ayush         | Sees deploy status on GitHub; uses public URL     | Free      |
| Excalidraw    | none          | Live collaboration link                           | Free      |
| YouTube       | either        | n/a                                               | Free      |

**Key idea:** you both use **one shared Atlas database**.

- That's safe because every plan, review and entry is tagged with the browser's anonymous `ownerId`. Your test data never shows up in each other's browser.
- The read-only `papers` and seeded `conferences` data is loaded **once** and shared.

---

## 1. Local tools

**Who:** both. **Time:** 15 min.

### 1.1 Node.js 22 LTS

- **macOS (recommended, via nvm):**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # restart the terminal, then:
  nvm install 22
  nvm alias default 22
  ```
  Or download the "LTS" installer from https://nodejs.org.
- **Windows:** install from https://nodejs.org (LTS, .msi), or use `nvm-windows`.
- **Verify:** `node -v` prints `v22.x.x` and `npm -v` prints `10.x`.

Node 20+ is required. We use `node --watch`, `import.meta.dirname` and `crypto.randomUUID()`.

### 1.2 Git

- macOS: `git --version`. If it isn't installed, macOS offers the Xcode command-line tools; accept.
- Windows: https://git-scm.com/download/win (defaults are fine).
- Set your identity once. It **must match your GitHub email** so commits count as yours, and the instructor can see who did what:
  ```bash
  git config --global user.name "Ayush Patel"
  git config --global user.email "patel.ayushn@northeastern.edu"   # Harshitha uses hers
  git config --global pull.rebase true
  git config --global init.defaultBranch main
  ```

### 1.3 GitHub authentication from the terminal

Easiest is the GitHub CLI:

```bash
# macOS
brew install gh
# Windows: winget install --id GitHub.cli
gh auth login     # → GitHub.com → HTTPS → "Login with a web browser"
```

After this, `git push` and `gh pr create` work without passwords.
_No Homebrew?_ Install it from https://brew.sh, or skip `gh` and use a personal access token when git asks for a password.

### 1.4 VS Code + extensions

Install VS Code, then these extensions:

| Extension                          | Why                                               |
| ---------------------------------- | ------------------------------------------------- |
| **ESLint** (Microsoft)             | Shows lint errors inline (rubric: 0 errors)       |
| **Prettier – Code formatter**      | Formats on save (rubric: Prettier formatted)      |
| **MongoDB for VS Code** (optional) | Browse the DB inside VS Code                      |
| **Thunder Client** (optional)      | Test API endpoints without writing frontend first |
| **Claude Code**                    | Your AI pair                                      |

Turn on format-on-save (Settings → search "format on save" → ✓). Set **Default Formatter** to Prettier.
The scaffold also adds `.vscode/settings.json` to the repo so this is automatic.

### 1.5 MongoDB Compass (optional but very useful)

Download it from https://www.mongodb.com/try/download/compass. It's a GUI for seeing documents, checking that seeds worked, and deleting junk test data. You'll connect it in §3.6.

---

## 2. GitHub

**Who:** Ayush (steps 2.1–2.4), Harshitha (2.5). **Time:** 10 min.

The repo already exists: **https://github.com/ayushp2207/paperscape** (MIT license ✓, Node `.gitignore` ✓).

### 2.1 Make sure the repo is public

Settings → General → scroll to **Danger Zone** → "Change repository visibility" → **Public**.

Why:

- The instructor and peer reviewers must open it.
- Free GitHub accounts only get branch protection on **public** repos. Private needs GitHub Pro, which is free with the Student Developer Pack at https://education.github.com/pack.

> Public is safe **as long as `.env` is never committed**. Section 5 covers this.

### 2.2 Invite Harshitha

1. Settings → **Collaborators** (left sidebar, under "Access") → **Add people**.
2. Type her GitHub username or email → **Add to repository**.
3. She gets an email/notification and must **accept** it (see 2.5).

### 2.3 Protect `main`

Settings → **Branches** → **Add classic branch protection rule**:

| Field                                                   | Value                                               |
| ------------------------------------------------------- | --------------------------------------------------- |
| Branch name pattern                                     | `main`                                              |
| ✓ Require a pull request before merging                 | on                                                  |
| └ ✓ Require approvals                                   | **1**                                               |
| └ ✓ Dismiss stale approvals when new commits are pushed | on                                                  |
| ✓ Require conversation resolution before merging        | on                                                  |
| ✗ Do not allow bypassing the above settings             | **leave off** (so Ayush can hotfix in an emergency) |
| Allow force pushes / deletions                          | off                                                 |

Click **Create**.

### 2.4 Repo housekeeping

Settings → General → **Pull Requests**:

- ✓ **Allow squash merging** (default message: "Pull request title"). Uncheck merge commits and rebase merging, so `main` stays one clean commit per PR.
- ✓ **Automatically delete head branches**, so merged branches disappear.

Optional (makes the repo look professional):

- About (gear icon on the repo home page) → description "Plan your ML submissions and run your literature review in one place". Add the website URL after §6 and topics `nodejs express mongodb vanilla-js openalex`.
- Projects tab → **New project → Board**. Add columns `Todo / In progress / In review / Done` and one card per task ID from `PROJECT_PLAN.md`.

### 2.5 Teammate (Harshitha)

1. Accept the invite: https://github.com/ayushp2207/paperscape/invitations (or from the email).
2. Clone:
   ```bash
   cd ~/where-you-keep-code
   git clone https://github.com/ayushp2207/paperscape.git
   cd paperscape
   ```
3. Do **not** push to `main` directly. It will be rejected, and that's expected. Always use a branch + PR (see §8).

---

## 3. MongoDB Atlas

**Who:** Ayush (3.1–3.5), Harshitha (3.6). **Time:** 15 min.

Atlas is MongoDB's hosted database. Both laptops **and** the Render server connect to the same cluster over the internet.

### 3.1 Create the account, project and cluster

1. Sign up at https://www.mongodb.com/cloud/atlas/register. Using "Sign in with Google" with your Northeastern account is fine.
2. Create a **Project** named `Paperscape` (top-left project dropdown → New Project).
3. **Create** a cluster → choose **M0 (Free)**:
   - Provider **AWS**, region **N. Virginia (us-east-1)**. This matches Render's "Virginia" region, so the deployed app gets low latency.
   - Name: `paperscape-cluster`.
   - Uncheck "Preload sample dataset". We don't want clutter.
4. Wait ~2 min for it to provision.

M0 limits: 512 MB storage, shared CPU. Our ~1,500 papers with abstracts are ~5–10 MB, so plenty of room.

### 3.2 Create database users (one per person + one for production)

Left sidebar → **Security → Database Access** → **Add New Database User**:

| Username        | Used by            | Role                               |
| --------------- | ------------------ | ---------------------------------- |
| `ayush-dev`     | Ayush's laptop     | **Read and write to any database** |
| `harshitha-dev` | Harshitha's laptop | Read and write to any database     |
| `render-prod`   | The Render server  | Read and write to any database     |

Settings for each user:

- Authentication method: **Password**.
- Click **Autogenerate Secure Password** and **copy it immediately** into a password manager or a private note. Autogenerated passwords are letters and digits only, which avoids URL-encoding problems.
- Leave everything else at defaults → **Add User**.

Why separate users? If one password leaks, or someone leaves, you delete just that user, and the deployed site keeps working.

### 3.3 Network access (who may connect)

Left sidebar → **Security → Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm.

Why "anywhere":

- Render's free tier has **no fixed outgoing IP**.
- Your laptops change IPs between home, campus and cafés.

Access is still protected by the username + password.

### 3.4 Get the connection string

Cluster card → **Connect** → **Drivers** → Driver **Node.js**, version latest → copy the string. It looks like:

```
mongodb+srv://<db_username>:<db_password>@paperscape-cluster.ab1cd.mongodb.net/?retryWrites=true&w=majority&appName=paperscape-cluster
```

Make one copy per user by filling in `<db_username>` and `<db_password>` (remove the `< >`). The database name is **not** in the string. We pass it separately as `DB_NAME=paperscape`.

### 3.5 Give Harshitha her connection string

Send her the **`harshitha-dev`** connection string **privately** (see §5.3 for how). Never post it in the class Slack, a GitHub issue/PR, or a commit.

_Optional:_ to let her browse data in the Atlas website too, go to Project → **Project Identity & Access** (or "Access Manager") → **Invite to Project** → her email → role **Project Read Only**. She still needs her DB user's string for the code and for Compass.

### 3.6 Teammate (Harshitha): verify you can connect

1. Open MongoDB Compass → **New connection** → paste your `harshitha-dev` string → **Connect**.
2. You should see the cluster. A `paperscape` database appears automatically the first time the app or a seed script writes to it, so it isn't there yet.
3. If it fails, see §10.

### 3.7 Who loads which data (once, from a laptop)

| Command                    | Who       | When             | Result                    |
| -------------------------- | --------- | ---------------- | ------------------------- |
| `npm run seed:conferences` | Ayush     | Day 1 (task A-1) | ~30 docs in `conferences` |
| `npm run seed:papers`      | Harshitha | Day 1 (task H-2) | 1,000+ docs in `papers`   |

Because the DB is shared, **each seed runs once**, and the other person's app sees the data immediately. The deployed site uses the same DB, so production is seeded too. Don't re-run the other person's seed without telling them.

---

## 4. OpenAlex

**Who:** Harshitha. **Time:** 5 min.

OpenAlex is a free, open catalog of scholarly papers. We call it **only from the seed script on a laptop**, never from the deployed site, so Render doesn't need these values.

1. Go to https://openalex.org and click **Sign up / Log in** (top right).
2. In your account settings, find **API key** and create or copy it. Put it in your `.env` as `OPENALEX_API_KEY`.
3. Also set `OPENALEX_EMAIL` to your email. OpenAlex uses it to put you in the faster "polite pool", and the seed script sends both.
4. If the signup flow looks different from these steps, check https://docs.openalex.org (section "Authentication" / "Rate limits"). OpenAlex has changed its access rules over time. The script works with just the email if there's no key.
5. Quick test in the browser (no key needed):
   https://api.openalex.org/works?search=diffusion%20model&per_page=1
   You should see JSON with a `results` array.

Limits to respect: stay ≤ 10 requests/second (the script sleeps 150 ms between calls). The daily quota is far above our ~250 requests.

---

## 5. The `.env` file & sharing secrets

**Who:** both. **Time:** 5 min (after the scaffold PR adds `.env.example`).

### 5.1 What goes in it

After the scaffold is merged, copy the template:

```bash
cp .env.example .env
```

Fill in your own values:

```dotenv
# .env  (NEVER committed; already in .gitignore)
MONGODB_URI=mongodb+srv://ayush-dev:XXXXXXXX@paperscape-cluster.ab1cd.mongodb.net/?retryWrites=true&w=majority&appName=paperscape-cluster
DB_NAME=paperscape
PORT=3000

# only needed by whoever runs the papers seed (Harshitha)
OPENALEX_API_KEY=
OPENALEX_EMAIL=you@northeastern.edu
```

| Variable       | Ayush           | Harshitha           | Render (prod)                    |
| -------------- | --------------- | ------------------- | -------------------------------- |
| `MONGODB_URI`  | `ayush-dev` URI | `harshitha-dev` URI | `render-prod` URI                |
| `DB_NAME`      | `paperscape`    | `paperscape`        | `paperscape`                     |
| `PORT`         | `3000`          | `3000`              | _(don't set; Render injects it)_ |
| `OPENALEX_*`   | optional        | **yes**             | not needed                       |
| `NODE_VERSION` | n/a             | n/a                 | `22`                             |

### 5.2 Rules

- `.env` is gitignored, but **run `git status` before every commit**. If you ever see `.env` listed, stop.
- `.env.example` **is** committed. It lists variable **names** with empty values. If you add a new variable, add it there in the same PR and tell your teammate.
- Don't paste real connection strings into Claude prompts, PR descriptions, screenshots or the demo video. Blur the terminal if needed.
- Rubric: "doesn't expose any secret credentials" is worth 10 pts.

### 5.3 How to send a secret to your teammate

Best to worst:

1. **One-time secret link:** Bitwarden Send (free) or https://onetimesecret.com. The link self-destructs after viewing.
2. A **direct message** (Teams/iMessage/WhatsApp) to just her, then delete the message after she confirms it's in her `.env`.
3. ✗ Never: class Slack channels, email threads with others CC'd, GitHub, Google Docs shared with the class.

### 5.4 If a secret leaks

1. Atlas → Database Access → that user → **Edit → Edit Password → Autogenerate** → Update. The old password stops working immediately.
2. Update `.env` (and Render env vars if it was `render-prod`).
3. Committed by mistake? Rotating the password is what matters. Removing the commit from history does **not** un-leak it, because GitHub is public and scraped by bots within minutes.

---

## 6. Render hosting

**Who:** Ayush. **When:** right after the scaffold PR (S0-2) is merged on Day 1. Deploy early, even when the app is just the skeleton, so surprises show up on Day 1 and not Day 3. **Time:** 15 min.

### 6.1 Why Render

- **Free tier**, runs a normal `node server.js` (Express needs no changes), deploys automatically from GitHub, and gives free HTTPS at `https://<name>.onrender.com`.
- Tradeoff: free services **sleep after ~15 min of no traffic**, and the next visitor waits **~30–60 s** for a cold start. Plan around it (§6.6).

### 6.2 Create the account

1. https://render.com → **Get Started** → **Sign up with GitHub** (use the account that owns the repo).
2. When GitHub asks which repos Render may access, choose **Only select repositories → `paperscape`**. You can change this later at GitHub → Settings → Applications → Render → Configure.

### 6.3 Create the Web Service

Render dashboard → **New + → Web Service** → pick `ayushp2207/paperscape` → fill in:

| Field              | Value                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Name               | `paperscape` (becomes `paperscape.onrender.com` if free; otherwise Render adds a suffix) |
| Region             | **Virginia (US East)** (same region as Atlas)                                            |
| Branch             | `main`                                                                                   |
| Root Directory     | _(leave empty)_                                                                          |
| Runtime / Language | **Node**                                                                                 |
| Build Command      | `npm ci`                                                                                 |
| Start Command      | `npm start`                                                                              |
| Instance Type      | **Free**                                                                                 |

**Environment Variables** (on the same page, "Add Environment Variable"):

| Key            | Value                                   |
| -------------- | --------------------------------------- |
| `MONGODB_URI`  | the **`render-prod`** connection string |
| `DB_NAME`      | `paperscape`                            |
| `NODE_VERSION` | `22`                                    |

**Advanced:**

| Field             | Value         |
| ----------------- | ------------- |
| Health Check Path | `/api/health` |
| Auto-Deploy       | **On Commit** |

Click **Create Web Service**. The first build takes 2–4 min. Watch the **Logs** tab and look for your "Server listening on …" line.

### 6.4 Requirements this puts on our code (already in the plan)

- `server.js` must listen on **`process.env.PORT`**. Render picks the port; hard-coding 3000 breaks deploys.
- `package.json` must have `"start": "node server.js"` and `"engines": { "node": ">=20" }`.
- `package-lock.json` must be committed. `npm ci` needs it.
- `GET /api/health` must answer `200` without needing the database or owner header.
- Every runtime dependency in `dependencies` (not `devDependencies`). Render installs dev deps too with `npm ci`, but stay correct anyway.

### 6.5 How deploys work for both of you

- **Every merge to `main` redeploys automatically** (~2–3 min). Nobody has to "deploy" by hand.
- Render reports deploy status back to GitHub (✓ / ✗ next to commits on `main`), so **Harshitha can see whether the site deployed without a Render account**.
- Free Render workspaces are single-user. Ayush owns the service; Harshitha uses the public URL and GitHub status checks. If a deploy fails, Ayush shares the log lines from the **Logs** tab.
- Manual redeploy (e.g. after changing env vars): service → **Manual Deploy → Deploy latest commit**.
- Roll back: service → **Events** → pick an older successful deploy → **Rollback**.

### 6.6 Sharing the site with people

1. **The URL:** `https://paperscape.onrender.com` (or whatever Render assigned). Put it in:
   - the GitHub repo **About → Website** field,
   - `README.md` (a "Live demo" link at the top),
   - the Google Form submission, the slides and the video description.
2. **Cold starts:** open the site **1–2 minutes before** you demo, present, or record the video. Say in the README: _"Hosted on Render's free tier; the first load after inactivity can take up to a minute."_
3. **Optional, during grading week only:** keep it awake with a free uptime pinger such as https://cron-job.org or UptimeRobot hitting `https://<your-app>.onrender.com/api/health` every 10 min. One always-on free service fits inside Render's monthly free hours. Turn it off afterwards.
4. **Each visitor gets a private sandbox** (anonymous ID in their browser). Anyone you share it with can try the planner and reviews without seeing anyone else's data. Clearing site data or using another browser gives a fresh empty workspace. Say this on the home page "How to use" section so testers aren't confused.
5. **Before sharing widely:** run the smoke test in `PROJECT_PLAN.md` §19 **on the deployed URL**, in an incognito window, and on a phone.

### 6.7 What if Render doesn't work out

Fallback with the same steps: **Koyeb** (free Node web service) or **Railway** (trial credits). Atlas stays the same; only `MONGODB_URI` etc. move to the new host's env settings. Don't switch unless Render is actually blocking you.

---

## 7. Other tools

| Need                  | Tool                                                                                                                              | How to collaborate                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mockups (Design doc)  | **Excalidraw** (https://excalidraw.com, no account)                                                                               | Click **Live collaboration → Start session** and send the link; both draw at once. Export PNGs to `docs/mockups/`. Also save the `.excalidraw` file so you can edit later |
| Mockups (alternative) | Figma (free education plan)                                                                                                       | Share the file with edit access                                                                                                                                           |
| World map data        | Natural Earth GeoJSON (public domain, no account)                                                                                 | Ayush's script downloads it once; output committed                                                                                                                        |
| Fonts                 | Google Fonts (Inter, JetBrains Mono)                                                                                              | Just a `<link>` tag, no account                                                                                                                                           |
| Icons                 | Lucide (https://lucide.dev, ISC license)                                                                                          | Copy SVG markup into `icons.js`                                                                                                                                           |
| Slides                | Google Slides                                                                                                                     | Share with edit access; link in README + form                                                                                                                             |
| Video                 | Record: QuickTime (Mac, File → New Screen Recording) or OBS / Loom. Host: **YouTube**, visibility **Public** (rubric says public) | One person uploads; both narrate their part                                                                                                                               |
| Chat                  | whatever you already use                                                                                                          | Make one thread just for "PR ready for review" pings                                                                                                                      |

---

## 8. Working together day to day

### 8.1 Start of every session

```bash
git checkout main
git pull                                  # get your teammate's merged work
npm install                               # in case package.json changed
git checkout -b a/A-6-world-map           # Harshitha: h/H-6-paper-search
npm run dev                               # http://localhost:3000
```

### 8.2 Finishing a task

```bash
npm run lint && npm run format            # must be clean
git status                                # make sure .env is NOT listed
git add -A
git commit -m "feat(planner): world map with conference pins (A-6)"
git pull --rebase origin main             # replay your work on top of latest main
git push -u origin HEAD
gh pr create --fill                       # or open the PR on github.com
```

Then message your teammate: _"PR ready: A-6 world map"_.

### 8.3 Reviewing your teammate's PR (≤ 30 min turnaround)

```bash
gh pr checkout <number>     # or: git fetch && git checkout h/H-6-paper-search
npm install && npm run dev
```

Click through the feature. Check that:

- they only touched files they own,
- there's no `.env` and no `console.log`,
- `npm run lint` passes.

Then on GitHub: **Files changed → Review changes → Approve → Squash and merge**.

### 8.4 Merge conflict?

Usually caused by both editing the same file, which the ownership rules prevent. If it still happens:

```bash
git pull --rebase origin main
# fix the files git lists, keep both sides where sensible
git add <file> && git rebase --continue
git push --force-with-lease
```

`--force-with-lease` is fine on **your own branch**. Never force-push `main` (it's protected anyway).

### 8.5 Using Claude Code side by side

- Each of you runs Claude Code in your **own clone**. `CLAUDE.md` loads automatically and tells Claude the rules and file ownership.
- Start prompts with the task ID: _"Implement task H-6 from docs/PROJECT_PLAN.md. Only edit files Harshitha owns."_
- Read the diff before committing. You'll be asked about your code in the video and code review.

---

## 9. "Ready to build" checklist

**Ayush**

- [ ] `node -v` ≥ 22, git identity set, `gh auth status` OK
- [ ] Repo public, Harshitha invited, `main` protected, squash-merge + auto-delete branches on
- [ ] Atlas: M0 cluster in us-east-1; users `ayush-dev`, `harshitha-dev`, `render-prod`; Network Access `0.0.0.0/0`
- [ ] Sent Harshitha her connection string privately
- [ ] Compass connects with `ayush-dev`
- [ ] Render account created and linked to the `paperscape` repo (create the service right after the scaffold merges)

**Harshitha**

- [ ] `node -v` ≥ 22, git identity set (her GitHub email), `gh auth status` OK
- [ ] Accepted the GitHub invite, cloned the repo
- [ ] Compass connects with `harshitha-dev`
- [ ] OpenAlex account + API key (or email ready)
- [ ] VS Code ESLint + Prettier installed, format-on-save on

**Both, after the scaffold PR merges**

- [ ] `cp .env.example .env`, filled in, `npm install`, `npm run dev` → http://localhost:3000 loads, http://localhost:3000/api/health → `{"ok":true}`
- [ ] Render URL shows the same skeleton

---

## 10. Troubleshooting

| Symptom                                                                 | Fix                                                                                                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MongoServerSelectionError` / timeout                                   | Atlas → Network Access must contain `0.0.0.0/0` (status "Active"). Wait 1–2 min after adding                                                                                               |
| `bad auth : authentication failed`                                      | Wrong username/password in the URI, or the `< >` brackets were left in. Reset the password in Atlas → Database Access                                                                      |
| `querySrv ENOTFOUND _mongodb._tcp…` (common on campus Wi-Fi / VPN)      | The network's DNS blocks SRV lookups. Switch to a hotspot, or set the DNS to `8.8.8.8`/`1.1.1.1`, or in Atlas → Connect → Drivers pick the older driver version to get a non-`+srv` string |
| Password has `@ : / ?` and connection fails                             | URL-encode it (`@` → `%40`) or autogenerate a letters-and-digits password                                                                                                                  |
| `git push` → "protected branch" rejected                                | Expected. Push a branch and open a PR                                                                                                                                                      |
| `git push` asks for a password                                          | Run `gh auth login`, or use a GitHub personal access token instead of your password                                                                                                        |
| Render build fails: `npm ci` can only install with an existing lockfile | Commit `package-lock.json`                                                                                                                                                                 |
| Render: "No open ports detected" / deploy times out                     | `server.js` must `listen(process.env.PORT)`                                                                                                                                                |
| Render: `SyntaxError: Cannot use import statement outside a module`     | `"type": "module"` missing in `package.json`, or Node version too old → set `NODE_VERSION=22`                                                                                              |
| Site works locally but deployed pages show no data                      | Env var missing or misspelled in Render → Environment; redeploy after fixing                                                                                                               |
| Deployed site takes ~1 min to load                                      | Free-tier cold start; expected. Warm it before demos (§6.6)                                                                                                                                |
| OpenAlex returns `429 Too Many Requests`                                | The script backs off automatically; if it keeps happening, increase the sleep to 500 ms                                                                                                    |
