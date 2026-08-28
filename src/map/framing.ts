import type { Atlas, BBox, Territory } from '@/data/types';

const centerOf = (bbox: BBox): [number, number] => [
  (bbox[0] + bbox[2]) / 2,
  (bbox[1] + bbox[3]) / 2,
];

function frameAround(
  atlas: Atlas<Territory>,
  center: [number, number],
  width: number,
): BBox {
  const w = Math.min(atlas.width, Math.max(1, width));
  const h = w * (atlas.height / atlas.width);

  const x = Math.min(atlas.width - w, Math.max(0, center[0] - w / 2));
  const y = Math.min(atlas.height - h, Math.max(0, center[1] - h / 2));
  return [x, y, x + w, y + h];
}

export function assistFrame(
  atlas: Atlas<Territory>,
  territoryId: string,
  spread: number | null,
): BBox | undefined {
  if (spread === null || spread >= 1) return undefined;

  const territory = atlas.territories.find((t) => t.id === territoryId);
  if (!territory || territory.d === '') return undefined;

  const own = Math.max(territory.bbox[2] - territory.bbox[0], territory.bbox[3] - territory.bbox[1]);
  const width = Math.max(atlas.width * spread, own * 3.2);
  const height = width * (atlas.height / atlas.width);

  const center = centerOf(territory.bbox);
  const noise = hashOf(territoryId);
  const angle = (noise % 360) * (Math.PI / 180);
  const reach = 0.26 * (0.5 + ((noise >>> 9) % 100) / 200);

  return frameAround(
    atlas,
    [center[0] + Math.cos(angle) * width * reach, center[1] + Math.sin(angle) * height * reach],
    width,
  );
}

function hashOf(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function focusFrame(atlas: Atlas<Territory>, territoryId: string): BBox | undefined {
  const territory = atlas.territories.find((t) => t.id === territoryId);
  if (!territory || territory.d === '') return undefined;

  const own = Math.max(territory.bbox[2] - territory.bbox[0], territory.bbox[3] - territory.bbox[1]);
  return frameAround(atlas, centerOf(territory.bbox), Math.min(atlas.width, own * 2.6));
}

const SMALL_SHARE = 0.18;

export function highlightFrame(
  atlas: Atlas<Territory>,
  territoryId: string,
  spread: number | null,
): BBox | undefined {
  const territory = atlas.territories.find((t) => t.id === territoryId);
  if (!territory || territory.d === '') return assistFrame(atlas, territoryId, spread);

  const own = Math.max(
    territory.bbox[2] - territory.bbox[0],
    territory.bbox[3] - territory.bbox[1],
  );
  if (own / atlas.width >= SMALL_SHARE) return assistFrame(atlas, territoryId, spread);

  return frameAround(
    atlas,
    centerOf(territory.bbox),
    Math.max(own * 4, atlas.width * 0.18),
  );
}
