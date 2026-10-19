// Seeds the shared, read-only `papers` collection from OpenAlex (PROJECT_PLAN §10.6).
// Random papers almost never cite each other, so each area is seeded as a citation cluster:
// its most-cited recent papers (anchors), recent papers that cite each anchor, and a recent fill.
// Re-runnable: upserts by OpenAlex id and never deletes (reviews reference papers by _id).
import dotenv from 'dotenv';

import { closeDb, connectDb } from '../db/connection.js';
import { ensureIndexes } from '../db/indexes.js';
import { citationStats, upsertMany } from '../db/papers.js';
import { AREAS } from '../public/js/shared/areas.js';

dotenv.config({ quiet: true });

const ANCHORS_PER_AREA = 10;
const CITERS_PER_ANCHOR = 15;
const FILL_PER_AREA = 50;
const MIN_PAPERS = 1000;
const MAX_AUTHORS = 10;

const FIELDS = [
  'id',
  'doi',
  'title',
  'publication_year',
  'publication_date',
  'abstract_inverted_index',
  'authorships',
  'primary_location',
  'cited_by_count',
  'referenced_works',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Thin OpenAlex /works client: adds credentials, keeps under the rate limit, retries politely.
class OpenAlexClient {
  static BASE_URL = 'https://api.openalex.org/works';
  static PAUSE_MS = 150;
  static MAX_ATTEMPTS = 5;

  #apiKey;
  #email;
  #lastRequestAt = 0;
  requestCount = 0;

  constructor({ apiKey, email }) {
    if (!apiKey && !email) {
      throw new Error('Set OPENALEX_API_KEY or OPENALEX_EMAIL in .env (see .env.example).');
    }
    this.#apiKey = apiKey;
    this.#email = email;
  }

  async works({ search, filter, sort, perPage }) {
    const params = new URLSearchParams({
      filter,
      per_page: String(perPage),
      select: FIELDS.join(','),
    });
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    if (this.#apiKey) params.set('api_key', this.#apiKey);
    if (this.#email) params.set('mailto', this.#email);
    const { results } = await this.#get(`${OpenAlexClient.BASE_URL}?${params}`);
    return results;
  }

  async #get(url) {
    for (let attempt = 1; ; attempt++) {
      await this.#pace();
      this.requestCount++;
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch((err) => ({
        ok: false,
        status: 0,
        statusText: err.message,
      }));
      if (response.ok) return response.json();

      const retryable = response.status === 0 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === OpenAlexClient.MAX_ATTEMPTS) {
        throw new Error(`OpenAlex request failed: ${response.status} ${response.statusText}`);
      }
      await sleep(1000 * 2 ** attempt);
    }
  }

  async #pace() {
    const wait = this.#lastRequestAt + OpenAlexClient.PAUSE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.#lastRequestAt = Date.now();
  }
}

const shortId = (url) => url?.split('/').pop();

// OpenAlex stores abstracts as { word: [positions] }; put each word back in its place.
function rebuildAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter(Boolean).join(' ').trim();
}

// Titles can carry inline markup such as <i>…</i>; the UI shows plain text.
const plainText = (text) =>
  (text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Some sources list several aliases joined by "/"; keep the first.
const venueName = (work) =>
  work.primary_location?.source?.display_name?.split('/')[0].trim() || null;

function toPaper(work, areaId) {
  const title = plainText(work.title);
  const abstract = rebuildAbstract(work.abstract_inverted_index);
  if (!title || !abstract) return null;

  const openalexId = shortId(work.id);
  return {
    openalexId,
    doi: work.doi ?? null,
    title,
    abstract,
    year: work.publication_year,
    publicationDate: work.publication_date ? new Date(work.publication_date) : null,
    authors: (work.authorships ?? []).slice(0, MAX_AUTHORS).map((authorship) => ({
      name: authorship.author?.display_name ?? 'Unknown',
      institution: authorship.institutions?.[0]?.display_name ?? null,
    })),
    venue: venueName(work),
    areas: [areaId],
    citedByCount: work.cited_by_count ?? 0,
    referencedWorks: (work.referenced_works ?? []).map(shortId),
    openalexUrl: `https://openalex.org/${openalexId}`,
  };
}

async function fetchArea(client, area) {
  const recent = 'has_abstract:true,from_publication_date:2024-01-01';
  const anchors = await client.works({
    search: area.query,
    filter: 'has_abstract:true,from_publication_date:2022-01-01',
    sort: 'cited_by_count:desc',
    perPage: ANCHORS_PER_AREA,
  });

  const works = [...anchors];
  for (const anchor of anchors) {
    const citers = await client.works({
      filter: `cites:${shortId(anchor.id)},${recent}`,
      sort: 'cited_by_count:desc',
      perPage: CITERS_PER_ANCHOR,
    });
    works.push(...citers);
  }
  works.push(
    ...(await client.works({ search: area.query, filter: recent, perPage: FILL_PER_AREA })),
  );

  return works.map((work) => toPaper(work, area.id)).filter(Boolean);
}

async function main() {
  const client = new OpenAlexClient({
    apiKey: process.env.OPENALEX_API_KEY,
    email: process.env.OPENALEX_EMAIL,
  });

  await connectDb();
  await ensureIndexes();

  for (const area of AREAS) {
    const papers = await fetchArea(client, area);
    const { upsertedCount, modifiedCount } = await upsertMany(papers);
    console.log(
      `${area.label.padEnd(24)} ${String(papers.length).padStart(4)} fetched · ` +
        `${upsertedCount} new · ${modifiedCount} updated`,
    );
  }

  const { total, linked } = await citationStats();
  const percent = total ? Math.round((linked / total) * 100) : 0;
  console.log(
    `\n${total} papers in the collection · ${linked} (${percent}%) cite another paper in it · ` +
      `${client.requestCount} OpenAlex requests`,
  );
  if (total < MIN_PAPERS) throw new Error(`Expected at least ${MIN_PAPERS} papers, got ${total}.`);
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
