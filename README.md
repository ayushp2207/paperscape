# Paperscape

Plan your ML submissions and run your literature review in one place.

**Live demo:** https://paperscape-odl1.onrender.com

> Hosted on Render's free tier. The first load after a period of inactivity can take up to a minute while the server wakes up.

## Authors

- Ayush Nimeshkumar Patel
- Harshitha Seetharaman

**Class:** [CS5610 Web Development, Northeastern University](https://johnguerra.co/classes/webDevelopment_online_summer_2026/index.html)

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

- Conference dates, locations and deadlines: [ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT License, © ccfddl contributors), imported with `npm run import:conferences`. Editions that haven't been announced yet are shown as "TBD".
- Papers: [OpenAlex](https://openalex.org) (CC0).

## License

[MIT](LICENSE)
