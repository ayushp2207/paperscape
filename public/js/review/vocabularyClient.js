import { api } from '../shared/api.js';

let request;

// Topic phrases for title, keyword and area suggestions, fetched the first time a review form
// is used (then cached by the browser for a day). Optional: if the request fails, forms still
// suggest from the question's own words.
export function loadVocabulary() {
  request ??= api
    .get('/papers/topics')
    .then((rows) => rows.map(([phrase, count, area]) => ({ phrase, count, area })))
    .catch(() => []);
  return request;
}
