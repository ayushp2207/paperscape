// Pulls deadline dates out of an "Important dates" style page (plain text from htmlToText).
// Conservative: a value is "confident" only when exactly one date sits on a line that names
// exactly one kind of deadline. Everything else is reported for a human to check.
const KEYWORDS = {
  abstract: /abstract\s+(registration|submission|deadline|due)/i,
  paper:
    /(full\s+)?paper\s+(submission|registration|deadline|due)|submission\s+deadline|manuscript\s+due/i,
  notification: /notification|acceptance\s+notice|author\s+notif|decision/i,
  cameraReady: /camera[\s-]*ready|final\s+(version|manuscript|paper)/i,
};

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const MONTH_INDEX = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const DATE_PATTERNS = [
  // July 31, 2026 · Jul. 31st 2026
  new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'gi'),
  // 31 July 2026
  new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})[a-z]*\\.?,?\\s+(20\\d{2})\\b`, 'gi'),
  // 2026-07-31
  /\b(20\d{2})-(\d{2})-(\d{2})\b/g,
];

const pad = (n) => String(n).padStart(2, '0');

function datesIn(line) {
  const found = new Set();
  for (const [i, pattern] of DATE_PATTERNS.entries()) {
    for (const match of line.matchAll(pattern)) {
      let year, month, day;
      if (i === 0)
        [year, month, day] = [match[3], MONTH_INDEX[match[1].slice(0, 3).toLowerCase()], match[2]];
      else if (i === 1)
        [year, month, day] = [match[3], MONTH_INDEX[match[2].slice(0, 3).toLowerCase()], match[1]];
      else [year, month, day] = [match[1], Number(match[2]), match[3]];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
        found.add(`${year}-${pad(month)}-${pad(day)}`);
    }
  }
  return [...found];
}

const LOOKAHEAD_LINES = 3;

// → { confident: { paper: 'YYYY-MM-DD', … }, unclear: ['label: dates', …] }
// Labels and dates are often on separate lines (tables, <dt>/<dd>), so each label also reads
// the next few lines up to the next label.
export function extractDeadlines(text, editionYear) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const kindsOf = (line) => Object.keys(KEYWORDS).filter((key) => KEYWORDS[key].test(line));
  // Deadlines fall in the edition's year or the year before.
  const relevant = (date) => {
    const year = Number(date.slice(0, 4));
    return year === editionYear || year === editionYear - 1;
  };

  const found = {}; // kind → Set of dates
  const unclear = [];
  lines.forEach((line, i) => {
    const kinds = kindsOf(line);
    if (kinds.length === 0) return;
    const block = [line];
    for (let j = i + 1; j <= i + LOOKAHEAD_LINES && j < lines.length; j += 1) {
      if (kindsOf(lines[j]).length) break;
      block.push(lines[j]);
    }
    const dates = [...new Set(block.flatMap(datesIn))].filter(relevant);
    if (dates.length === 0) return;
    if (kinds.length === 1 && dates.length === 1) {
      (found[kinds[0]] ??= new Set()).add(dates[0]);
    } else {
      // Several dates: usually an extension (old → new), several cycles, or several tracks.
      unclear.push(block.join(' ').slice(0, 200));
    }
  });

  const confident = {};
  for (const [kind, dates] of Object.entries(found)) {
    if (dates.size === 1) confident[kind] = [...dates][0];
    else unclear.push(`${kind}: several dates on the page (${[...dates].join(', ')})`);
  }
  return { confident, unclear: unclear.slice(0, 8) };
}
