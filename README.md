# Paperscape

Plan your ML and networking submissions and run your literature review in one place.

**Live demo:** https://paperscape-odl1.onrender.com

> Hosted on Render's free tier. The first load after a period of inactivity can take up to a minute while the server wakes up.

## Authors

- Ayush Nimeshkumar Patel
- Harshitha Seetharaman

**Class:** [CS5610 Web Development, Northeastern University](https://johnguerra.co/classes/webDevelopment_online_summer_2026/index.html)

## Features

- **Conference Planner:** upcoming ML and networking/wireless conferences on a world map, a timeline and a filterable list, with live countdowns to every deadline (Anywhere on Earth).
- **Always up to date:** dates, venues and deadlines refresh automatically, new editions appear as soon as they're announced, and extended deadlines are flagged.
- **Report a broken link:** spot a dead conference link? Report it from the conference panel and it gets fixed.
- **Submission plans:** pick a target venue and a backup, set your own milestones, and get warned about clashing deadlines or too little time to arrange travel.
- **Review Workspace:** organise a literature review around a research question; search recent papers, record findings, link papers into threads and see which ones cite each other.
- **No sign-up:** your plans and reviews are private to your browser.

## Build and run locally

Requires Node.js 20.11+ and a MongoDB connection string (e.g. a free MongoDB Atlas cluster).

```bash
git clone https://github.com/ayushp2207/paperscape.git
cd paperscape
npm install
cp .env.example .env   # then fill in MONGODB_URI
npm run dev            # http://localhost:3000
```

## Data sources

- Conference dates, locations and deadlines: [ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT License, © ccfddl contributors) and the conferences' official websites. Editions that haven't been announced yet are shown as "TBD".
- Papers: [OpenAlex](https://openalex.org) (CC0).

## License

[MIT](LICENSE)
