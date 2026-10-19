import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { pageOf, pager } from './pager.js';

const TOP = 3;
const GROUPS_PER_PAGE = 8;
const LONE_PER_PAGE = 6;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Who cites whom inside one review, from the API's { nodes, edges } (edge: `from` cites `to`).
// → Map entryId → { cites: [entryId], citedBy: [entryId] }
export function citationIndex(graph) {
  const index = new Map(graph.nodes.map((node) => [node.entryId, { cites: [], citedBy: [] }]));
  for (const { from, to } of graph.edges) {
    index.get(from)?.cites.push(to);
    index.get(to)?.citedBy.push(from);
  }
  return index;
}

// The "Citations" tab: how the saved papers cite each other.
// Handlers: onOpenEntry(entryId) shows a paper in the reading list; onFindCiting(entryId) searches
// the library for papers that cite it.
export class CitationsView {
  #root;
  #handlers;
  #graph = { nodes: [], edges: [] };
  #direction = 'cites';
  #page = 1;
  #lonePage = 1;

  constructor(root, handlers) {
    this.#root = root;
    this.#handlers = handlers;
  }

  render(graph) {
    this.#graph = graph;
    const index = citationIndex(graph);
    const titles = new Map(graph.nodes.map((node) => [node.entryId, node]));
    const lone = graph.nodes.filter((node) => {
      const links = index.get(node.entryId);
      return links.cites.length === 0 && links.citedBy.length === 0;
    });

    if (graph.nodes.length === 0) {
      this.#root.replaceChildren(
        this.#emptyState('No papers yet', 'Save some papers and their citation links appear here.'),
      );
      return;
    }

    this.#root.replaceChildren(
      el(
        'div',
        { class: 'citations' },
        el(
          'div',
          { class: 'citations__intro' },
          el(
            'p',
            { class: 'citations__stat' },
            el('strong', { class: 'mono' }, String(graph.edges.length)),
            ` citation ${graph.edges.length === 1 ? 'link' : 'links'} among `,
            el('strong', { class: 'mono' }, String(graph.nodes.length)),
            ' saved papers',
          ),
          el(
            'p',
            { class: 'muted' },
            'An arrow A → B means paper A lists paper B in its references.',
          ),
        ),
        graph.edges.length === 0
          ? this.#emptyState(
              'No citation links yet',
              'None of your saved papers cite each other yet. Try adding papers from the same thread of work.',
            )
          : [this.#foundations(index, titles), this.#links(index, titles)],
        lone.length > 0 && graph.edges.length > 0 && this.#lonePapers(lone),
      ),
    );
  }

  #paperButton(node) {
    return el(
      'button',
      {
        class: 'citation-link',
        type: 'button',
        on: { click: () => this.#handlers.onOpenEntry(node.entryId) },
      },
      node.title,
      el('span', { class: 'citation-link__year muted' }, ` · ${node.year}`),
    );
  }

  #findCitingButton(node, label = 'Find papers that cite this') {
    return el(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        'aria-label': `Find library papers that cite ${node.title}`,
        on: { click: () => this.#handlers.onFindCiting(node.entryId) },
      },
      icon('search', { size: 14 }),
      label,
    );
  }

  #emptyState(title, text) {
    return el(
      'div',
      { class: 'empty-state' },
      icon('link', { size: 32, className: 'empty-state__icon' }),
      el('h3', { class: 'empty-state__title' }, title),
      el('p', { class: 'muted' }, text),
    );
  }

  // The papers the rest of the review builds on.
  #foundations(index, titles) {
    const top = [...index]
      .filter(([, links]) => links.citedBy.length > 0)
      .sort((a, b) => b[1].citedBy.length - a[1].citedBy.length)
      .slice(0, TOP);
    return el(
      'section',
      { class: 'citations__section', 'aria-labelledby': 'foundations-title' },
      el('h3', { id: 'foundations-title' }, 'Foundations: most cited in this review'),
      el(
        'ol',
        { class: 'most-cited' },
        top.map(([entryId, links], i) =>
          el(
            'li',
            { class: 'card most-cited__item' },
            el('span', { class: 'most-cited__rank mono', 'aria-hidden': 'true' }, String(i + 1)),
            el(
              'div',
              { class: 'most-cited__body' },
              this.#paperButton(titles.get(entryId)),
              el(
                'span',
                { class: 'badge badge--accent' },
                `cited by ${plural(links.citedBy.length, 'saved paper')}`,
              ),
              this.#findCitingButton(titles.get(entryId)),
            ),
          ),
        ),
      ),
    );
  }

  // Every link, grouped by the citing paper ("A → B, C") or by the cited one ("B ← A, C").
  #links(index, titles) {
    const citing = this.#direction === 'cites';
    const groups = [...index]
      .map(([entryId, links]) => [entryId, citing ? links.cites : links.citedBy])
      .filter(([, others]) => others.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    const { items, page, pages } = pageOf(groups, this.#page, GROUPS_PER_PAGE);

    const toggle = (direction, label) =>
      el(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(this.#direction === direction),
          on: {
            click: () => {
              this.#direction = direction;
              this.#page = 1;
              this.render(this.#graph);
            },
          },
        },
        label,
      );

    return el(
      'section',
      { class: 'citations__section', 'aria-labelledby': 'links-title' },
      el(
        'div',
        { class: 'citations__head' },
        el('h3', { id: 'links-title' }, 'Links'),
        el(
          'div',
          { class: 'chip-list', role: 'group', 'aria-label': 'Group links by' },
          toggle('cites', 'Cites →'),
          toggle('cited-by', '← Cited by'),
        ),
      ),
      el(
        'ul',
        { class: 'citation-groups' },
        items.map(([entryId, others]) =>
          el(
            'li',
            { class: 'citation-group' },
            el('div', { class: 'citation-group__from' }, this.#paperButton(titles.get(entryId))),
            el(
              'span',
              { class: 'citation-group__verb' },
              citing ? `cites ${others.length} →` : `← cited by ${others.length}`,
            ),
            el(
              'ul',
              { class: 'citation-group__to' },
              others.map((other) => el('li', {}, this.#paperButton(titles.get(other)))),
            ),
          ),
        ),
      ),
      pager({
        page,
        pages,
        label: 'Citation link pages',
        onPage: (n) => {
          this.#page = n;
          this.render(this.#graph);
        },
      }),
    );
  }

  // Papers with no link to any other: a hint about where to look next.
  #lonePapers(lone) {
    const { items, page, pages } = pageOf(lone, this.#lonePage, LONE_PER_PAGE);
    return el(
      'section',
      { class: 'citations__section', 'aria-labelledby': 'lone-title' },
      el('h3', { id: 'lone-title' }, `Not connected yet · ${lone.length}`),
      el(
        'p',
        { class: 'muted' },
        'These papers neither cite nor are cited by another saved paper. Papers that cite them may bridge the gap.',
      ),
      el(
        'ul',
        { class: 'lone-papers' },
        items.map((node) =>
          el('li', {}, this.#paperButton(node), this.#findCitingButton(node, 'Find citing papers')),
        ),
      ),
      pager({
        page,
        pages,
        label: 'Unconnected paper pages',
        onPage: (n) => {
          this.#lonePage = n;
          this.render(this.#graph);
        },
      }),
    );
  }
}
