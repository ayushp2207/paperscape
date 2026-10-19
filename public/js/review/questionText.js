// Turns a research question into title options, keyword suggestions and a research area.
// A title is a short name for the review; the question is the full sentence. Known topics come
// from the paper vocabulary (topics.js); phrases from the question itself fill the gaps.
import { contentRuns, detectArea, isAcronym, keyOf, matchTopics } from './topics.js';

const TITLE_WORDS = 4;
const TITLE_OPTIONS = 3;
const MAX_SUGGESTIONS = 6;
const MAX_PHRASE_WORDS = 3;
// Topics in this many papers or more ("AI", "deep learning") are too broad to name a review.
const BROAD_TOPIC = 50;

// Capitalises each word but leaves the rest alone, so acronyms like "ViT" or "RLHF" survive.
const titleCase = (text, maxWords = TITLE_WORDS) =>
  text
    .split(/\s+/)
    .slice(0, maxWords)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// Splits a run wherever a word is already covered by a known topic, so "federated learning
// privacy" (with "federated learning" known) leaves "privacy". Compared by matching key, so
// "LLM" covers "LLMs".
function uncoveredRuns(run, covered) {
  const runs = [[]];
  for (const word of run) {
    if (covered.has(word.key)) runs.push([]);
    else runs.at(-1).push(word.text);
  }
  return runs.filter((words) => words.length);
}

// The question's own phrases outside the known topics. Up to MAX_PHRASE_WORDS words stay one
// phrase; a longer run is split into pairs, since it usually holds several topics.
function questionPhrases(question, knownPhrases) {
  const covered = new Set(knownPhrases.flatMap((phrase) => phrase.split(/\s+/).map(keyOf)));
  return contentRuns(question)
    .flatMap((run) => uncoveredRuns(run, covered))
    .flatMap((words) => {
      if (words.length <= MAX_PHRASE_WORDS) return [words.join(' ')];
      const pairs = [];
      for (let i = 0; i < words.length; i += 2) pairs.push(words.slice(i, i + 2).join(' '));
      return pairs;
    });
}

// "trade accuracy for memory", "accuracy vs. memory" → "Accuracy vs Memory".
function contrastTitle(question) {
  const match =
    question.match(
      /\btrade(?:-?offs?)?\s+(?:off\s+)?(?:between\s+)?([\w\s-]+?)\s+(?:for|against|and|with)\s+([\w\s-]+?)(?=\s+(?:in|on|beyond|at|when|under|across|during|while)\b|[?.!,;]|$)/i,
    ) ?? question.match(/([\w-]+(?:\s+[\w-]+)?)\s+(?:vs\.?|versus)\s+([\w-]+(?:\s+[\w-]+)?)/i);
  if (!match) return null;
  const side = (text) =>
    contentRuns(text)
      .flat()
      .slice(-2)
      .map((word) => word.text)
      .join(' ');
  const [a, b] = [side(match[1]), side(match[2])];
  return a && b ? `${titleCase(a, 2)} vs ${titleCase(b, 2)}` : null;
}

// Known topics, most specific first in reading order: broad ones ("AI") only if nothing else.
function rankTopics(matches) {
  const specific = matches.filter((topic) => topic.count < BROAD_TOPIC);
  return specific.length ? specific : matches;
}

function titleOptions(question, keywords, topics) {
  const options = [];
  const add = (title) => {
    if (title && !options.some((option) => option.toLowerCase() === title.toLowerCase())) {
      options.push(title);
    }
  };
  const fallback = questionPhrases(
    question,
    topics.map((topic) => topic.phrase),
  );
  const strongFallback = fallback.filter((phrase) => phrase.includes(' ') || isAcronym(phrase));

  // Order: the user's keyword, the main subject, a contrast ("X vs Y"), then alternatives.
  if (keywords.length) add(titleCase(keywords[0]));
  add(topics[0] ? titleCase(topics[0].phrase) : strongFallback[0] && titleCase(strongFallback[0]));
  add(contrastTitle(question));
  if (topics.length >= 2) {
    add(`${titleCase(topics[0].phrase, 3)} for ${titleCase(topics[1].phrase, 3)}`);
  }
  for (const phrase of [...strongFallback, ...fallback]) add(titleCase(phrase));
  return options.slice(0, TITLE_OPTIONS);
}

// Keyword ideas: known topics first, then the question's own phrases that don't repeat them.
function keywordSuggestions(question, topics, exclude) {
  const known = topics.map((topic) => topic.phrase);
  const extra = questionPhrases(question, known);
  const taken = new Set(exclude.map((keyword) => keyword.toLowerCase()));
  const suggestions = [];
  for (const phrase of [...known, ...extra]) {
    const key = phrase.toLowerCase();
    if (phrase.length >= 3 && !taken.has(key)) {
      taken.add(key);
      suggestions.push(phrase);
    }
  }
  return suggestions.slice(0, MAX_SUGGESTIONS);
}

// Everything the review form derives from what the user typed, in one pass.
// → { titles: [best, …alternatives], suggestions: [phrase], area: areaId | null }
export function analyseQuestion(question, { keywords = [], vocabulary = [] } = {}) {
  if (!question.trim()) return { titles: [], suggestions: [], area: null };
  const matches = matchTopics(question, vocabulary);
  return {
    titles: titleOptions(question, keywords, rankTopics(matches)),
    suggestions: keywordSuggestions(question, matches, keywords),
    area: detectArea(question, matches),
  };
}
