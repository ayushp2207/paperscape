// Review Workspace vocabulary and limits, shared by the API validators and the review pages.
export const STATUSES = [
  { id: 'to-read', label: 'To read' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
];

// The role a paper plays for the review's research question.
export const RELATIONS = [
  { id: 'unsure', label: 'Not sure yet' },
  { id: 'supports', label: 'Supports my question' },
  { id: 'challenges', label: 'Challenges my question' },
  { id: 'method', label: 'Gives a method I can use' },
  { id: 'background', label: 'Background reading' },
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
  // Relevance is a 5-star rating in half stars: 0.5, 1, … 5.
  relevanceMin: 0.5,
  relevanceMax: 5,
  relevanceStep: 0.5,
};
