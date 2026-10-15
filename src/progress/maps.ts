import { pack, unpack } from '../core/pack';
import type { ThemeId } from '../domain/theme';
import { store } from '../services/store';

/** Mapa desenhado no editor. `data` é a máscara codificada (encodeMask). */
export interface SavedMap {
  id: string;
  name: string;
  theme: ThemeId;
  data: string;
  at: number;
}

const MAX_MAPS = 12;

export function loadMaps(): SavedMap[] {
  return store.get<SavedMap[]>('maps', []);
}

export function saveMap(m: SavedMap): void {
  const list = loadMaps().filter((x) => x.id !== m.id);
  list.unshift(m);
  store.set('maps', list.slice(0, MAX_MAPS));
}

export function deleteMap(id: string): void {
  store.set(
    'maps',
    loadMaps().filter((x) => x.id !== id),
  );
}

export async function mapLink(m: SavedMap): Promise<string> {
  const code = await pack(JSON.stringify({ n: m.name, t: m.theme, d: m.data }));
  return `${location.href.split('#')[0]}#mapa-${code}`;
}

export async function mapFromUrl(): Promise<SavedMap | null> {
  const match = /#mapa-([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!match) return null;
  history.replaceState(null, '', location.pathname + location.search);
  const text = await unpack(match[1]);
  if (!text) return null;
  try {
    const o = JSON.parse(text) as { n: string; t: ThemeId; d: string };
    return { id: `m${Date.now().toString(36)}`, name: String(o.n).slice(0, 24), theme: o.t, data: o.d, at: Date.now() };
  } catch {
    return null;
  }
}
