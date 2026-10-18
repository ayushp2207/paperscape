import { getDb } from './connection.js';

const INDEXES = {
  conferences: [{ key: { startDate: 1 } }, { key: { ownerId: 1 } }, { key: { areas: 1 } }],
  submissionPlans: [{ key: { ownerId: 1, updatedAt: -1 } }],
  reviews: [{ key: { ownerId: 1, updatedAt: -1 } }],
  reviewEntries: [
    { key: { reviewId: 1, paperId: 1 }, unique: true },
    { key: { ownerId: 1, reviewId: 1 } },
  ],
  linkReports: [{ key: { status: 1, createdAt: 1 } }, { key: { ownerId: 1, conferenceId: 1 } }],
  papers: [
    { key: { openalexId: 1 }, unique: true },
    {
      key: { title: 'text', abstract: 'text' },
      weights: { title: 5, abstract: 1 },
      name: 'paper_text',
    },
    { key: { areas: 1, year: -1 } },
    { key: { citedByCount: -1 } },
  ],
};

export async function ensureIndexes() {
  const db = getDb();
  await Promise.all(
    Object.entries(INDEXES).map(([name, specs]) => db.collection(name).createIndexes(specs)),
  );
}
