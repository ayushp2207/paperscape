// Topic vocabulary: real research phrases mined from the seeded papers, and matching of a
// research question against them. Pure functions, shared by the server (which builds the
// vocabulary once) and the browser (which matches questions as the user types).
import { AREAS } from '../shared/areas.js';

export const STOP_WORDS = new Set(
  (
    'a an and are as at be been being between beyond by can could do does doing done for from ' +
    'has have how if in into is it its more most of on or over should so such than that the ' +
    'their them then there these they this those through to under up use used using vs versus ' +
    'was what when where whether which while who why will with within without would ' +
    'affect affects change changes compare compared help helps impact impacts improve improves ' +
    'make makes matter matters need needed needs perform performs trade trades vary varies ' +
    'work works ' +
    // Words common in paper titles and abstracts that never name a topic on their own.
    'achieve achieves achieved approach approaches based comprehensive demonstrate demonstrates ' +
    'existing experiment experiments experimental extensive framework furthermore however ' +
    'introduce introduces key method methods new novel overview paper perspective perspectives ' +
    'present presents propose proposed proposes recent result results review revisited show ' +
    'shows significant significantly state-of-the-art studies study survey toward towards various via ' +
    // Abstract boilerplate: pronouns, connectives, links and structured-abstract headings.
    'all also background both but com conclusion conclusions doi e each eg et etc finally first ' +
    'g github here http https i ie its may methods not objective objectives one only org other ' +
    'our results second three two us we well www ' +
    // Vague qualifiers that pair with anything ("wide range", "future research").
    'available core currently future practical range substantial unique wide ' +
    // Verbs and adjectives that questions use around a topic ("make X fast", "can robots learn").
    'better best detect detects emerge emerges enable enables fast faster generalise generalize ' +
    'good handle handles happen happens increase increases learn learns outperform outperforms reduce reduces ' +
    'slow worse'
  ).split(' '),
);

const MIN_PAPERS = 4;
const MAX_TOPICS = 600;

export const isAcronym = (word) => /^[A-Z][A-Z0-9-]+$/.test(word);

// Acronyms and mixed-case names (RLHF, ViT, GPT-4) keep their case; other words are lowercased.
const display = (word) => (/[A-Z]/.test(word.slice(1)) ? word : word.toLowerCase());

// Matching key: lowercase, simple plural folded, so "Vision Transformers" = "vision transformer".
export const keyOf = (word) => {
  const lower = word.toLowerCase();
  return lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')
    ? lower.slice(0, -1)
    : lower;
};

// Splits text into runs of content words (stop words, punctuation and bare numbers end a run).
export function contentRuns(text) {
  const runs = [];
  // Possessives go first so "Alzheimer's disease" stays one phrase. Punctuation ends a run,
  // so "language models (LLMs)" gives "language models" and "LLMs", not one long phrase.
  for (const clause of text.replace(/['’]s\b/g, '').split(/[,;:()?!."“”[\]/]+/)) {
    let run = [];
    for (const raw of clause.split(/\s+/)) {
      const word = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      const breaksRun =
        !word || STOP_WORDS.has(word.toLowerCase()) || /^\d+([a-z]{0,2})?$/i.test(word);
      if (breaksRun) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push({ text: display(word), key: keyOf(word) });
      }
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

const joinText = (words) => words.map((word) => word.text).join(' ');
const joinKey = (words) => words.map((word) => word.key).join(' ');

// Candidate topics inside one run: every 2- and 3-word sequence, plus acronyms on their own.
function candidates(run) {
  const found = [];
  run.forEach((word, i) => {
    if (isAcronym(word.text)) found.push(run.slice(i, i + 1));
    for (const size of [2, 3]) if (i + size <= run.length) found.push(run.slice(i, i + size));
  });
  return found;
}

// Server side: phrases that appear in at least MIN_PAPERS papers (title or abstract), each with the
// research area most of those papers belong to. [{ phrase, count, area }], most common first.
export function buildVocabulary(papers) {
  const stats = new Map();
  for (const paper of papers) {
    const seen = new Set();
    for (const words of contentRuns(`${paper.title}. ${paper.abstract}`).flatMap(candidates)) {
      const key = joinKey(words);
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = stats.get(key) ?? { count: 0, variants: new Map(), areas: new Map() };
      entry.count++;
      const text = joinText(words);
      entry.variants.set(text, (entry.variants.get(text) ?? 0) + 1);
      for (const area of paper.areas) entry.areas.set(area, (entry.areas.get(area) ?? 0) + 1);
      stats.set(key, entry);
    }
  }
  const mostCommon = (map) => [...map].sort((a, b) => b[1] - a[1])[0][0];
  return [...stats]
    .filter(([, entry]) => entry.count >= MIN_PAPERS)
    .map(([, entry]) => ({
      phrase: mostCommon(entry.variants),
      count: entry.count,
      area: mostCommon(entry.areas),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOPICS);
}

const indexes = new WeakMap();
const indexOf = (vocabulary) => {
  if (!indexes.has(vocabulary)) {
    const entries = vocabulary.map((topic) => [
      contentRuns(topic.phrase).map(joinKey).join(' '),
      topic,
    ]);
    indexes.set(vocabulary, new Map(entries));
  }
  return indexes.get(vocabulary);
};

// Known topics in a question, in reading order. At each position the longest known phrase wins,
// so "vision transformers" beats "vision". [{ phrase, count, area, position }]
export function matchTopics(question, vocabulary) {
  if (!vocabulary?.length) return [];
  const index = indexOf(vocabulary);
  const matches = [];
  let position = 0;
  for (const run of contentRuns(question)) {
    for (let i = 0; i < run.length;) {
      const size = [3, 2, 1].find(
        (n) => i + n <= run.length && index.has(joinKey(run.slice(i, i + n))),
      );
      if (size) {
        matches.push({ ...index.get(joinKey(run.slice(i, i + size))), position: position + i });
        i += size;
      } else {
        i++;
      }
    }
    position += run.length;
  }
  return matches;
}

// Words in the areas' search phrases that are too generic to point at one area.
const SHARED_AREA_WORDS = new Set([
  'access',
  'deep',
  'large',
  'learning',
  'model',
  'network',
  'neural',
  'open',
  'system',
]);

// The research area a question is about. Votes: 1 per known topic (by its papers' area),
// 3 for an area's whole search phrase ("graph neural network"), 1 for one of its distinctive
// words ("diffusion", "robot").
export function detectArea(question, matches) {
  const votes = new Map();
  const vote = (area, weight) => votes.set(area, (votes.get(area) ?? 0) + weight);
  for (const match of matches) vote(match.area, 1);
  const keys = contentRuns(question)
    .flat()
    .map((word) => word.key);
  const questionKeys = ` ${keys.join(' ')} `;
  for (const area of AREAS) {
    const areaWords = contentRuns(area.query)
      .flat()
      .map((word) => word.key);
    if (questionKeys.includes(` ${areaWords.join(' ')} `)) vote(area.id, 3);
    const distinctive = areaWords.filter((word) => !SHARED_AREA_WORDS.has(word));
    if (distinctive.some((word) => keys.includes(word))) vote(area.id, 1);
  }
  const [best] = [...votes].sort((a, b) => b[1] - a[1]);
  return best?.[0] ?? null;
}
