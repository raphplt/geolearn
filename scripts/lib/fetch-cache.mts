import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(import.meta.dirname, '..', '.cache');

export async function fetchCached(url: string, hint?: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = hint ?? createHash('sha1').update(url).digest('hex').slice(0, 16);
  const file = join(CACHE_DIR, key);

  if (existsSync(file)) return readFileSync(file, 'utf8');

  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const body = await res.text();
  writeFileSync(file, body);
  return body;
}

export async function fetchJson<T>(url: string, hint?: string): Promise<T> {
  return JSON.parse(await fetchCached(url, hint)) as T;
}

export async function mapLimit<In, Out>(
  items: readonly In[],
  limit: number,
  fn: (item: In, index: number) => Promise<Out>,
): Promise<Out[]> {
  const out = new Array<Out>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function fetchCachedBuffer(url: string, hint?: string): Promise<Buffer> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = hint ?? createHash('sha1').update(url).digest('hex').slice(0, 16);
  const file = join(CACHE_DIR, key);

  if (existsSync(file)) return readFileSync(file);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, body);
  return body;
}
