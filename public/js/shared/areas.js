// Research-area taxonomy shared by conferences and papers. Ids are a frozen contract.
// `query` is the OpenAlex search phrase the papers seed uses for that area.
export const AREAS = [
  { id: 'general', label: 'General ML', color: '#94a3b8', query: 'deep learning' },
  { id: 'nlp', label: 'NLP', color: '#7c6cff', query: 'large language model' },
  { id: 'cv', label: 'Computer Vision', color: '#2dd4bf', query: 'image segmentation' },
  { id: 'rl', label: 'Reinforcement Learning', color: '#f5a524', query: 'reinforcement learning' },
  { id: 'genai', label: 'Generative Models', color: '#f472b6', query: 'diffusion model' },
  {
    id: 'theory',
    label: 'Theory & Optimization',
    color: '#60a5fa',
    query: 'optimization convergence',
  },
  { id: 'graphs', label: 'Graph Learning', color: '#a3e635', query: 'graph neural network' },
  { id: 'robotics', label: 'Robotics', color: '#e879f9', query: 'robot learning' },
  { id: 'datamining', label: 'Data Mining & IR', color: '#facc15', query: 'recommender system' },
  {
    id: 'networking',
    label: 'Networking & Wireless',
    color: '#fda4af',
    query: 'open radio access network',
  },
];

export const AREA_IDS = AREAS.map((area) => area.id);

export const areaById = (id) => AREAS.find((area) => area.id === id);
