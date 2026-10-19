// Review Workspace vocabulary and limits, shared by the API validators and the review pages.
export const STATUSES = [
  { id: 'to-read', label: 'To read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
];

// How a paper relates to the review's research question.
export const RELATIONS = [
  { id: 'unsure', label: 'Unsure' },
  { id: 'supports', label: 'Supports' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'method', label: 'Method' },
  { id: 'background', label: 'Background' },
];

export const STATUS_IDS = STATUSES.map((status) => status.id);
export const RELATION_IDS = RELATIONS.map((relation) => relation.id);

export const LIMITS = {
  title: 120,
  question: 500,
  description: 1000,
  keywords: 10,
  keyword: 40,
  notes: 5000,
  findings: 20,
  finding: 300,
  threadTitle: 80,
  threadNote: 500,
  minThreadPapers: 2,
  relevanceMin: 1,
  relevanceMax: 5,
};
