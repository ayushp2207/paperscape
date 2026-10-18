// Builds public/assets/world.svg from Natural Earth 1:110m countries (public domain).
// Equirectangular projection into a 1000×500 viewBox, the same formula the map pins use
// (public/js/planner/map.js), so pins land on the right cities. Antarctica is dropped and the
// viewBox is cropped to 84°N–60°S because no conference happens further south.
//
// Usage: npm run build:map (run once; the output file is committed)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const OUTPUT = path.join(import.meta.dirname, '..', 'public', 'assets', 'world.svg');
const WIDTH = 1000;
const HEIGHT = 500;
const NORTH = 84;
const SOUTH = -60;

const project = ([lng, lat]) => [((lng + 180) / 360) * WIDTH, ((90 - lat) / 180) * HEIGHT];
const round = (n) => Math.round(n * 10) / 10;

function ringToPath(ring) {
  const points = ring.map(project).map(([x, y]) => `${round(x)},${round(y)}`);
  // Drop consecutive duplicates created by rounding.
  const deduped = points.filter((point, i) => point !== points[i - 1]);
  return deduped.length > 2 ? `M${deduped.join('L')}Z` : '';
}

function geometryToPath({ type, coordinates }) {
  const polygons = type === 'Polygon' ? [coordinates] : coordinates;
  return polygons.flatMap((polygon) => polygon.map(ringToPath)).join('');
}

const response = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
const { features } = await response.json();

const land = features
  .filter((feature) => feature.properties.ADMIN !== 'Antarctica')
  .map((feature) => geometryToPath(feature.geometry))
  .join('');

const top = round(((90 - NORTH) / 180) * HEIGHT);
const bottom = round(((90 - SOUTH) / 180) * HEIGHT);
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top} ${WIDTH} ${round(bottom - top)}" ` +
  `preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map">` +
  `<path class="world-map__land" d="${land}"/></svg>\n`;

await writeFile(OUTPUT, svg);
console.log(
  `Wrote ${OUTPUT} (${(svg.length / 1024).toFixed(0)} KB, ${features.length - 1} countries)`,
);
