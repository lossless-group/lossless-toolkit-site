// Wake-up receiver for lossless-hook-relay (decision recorded in
// client-portals-site: context-v/decisions/2026-10-08_Org-Wide-Webhook-Through-a-Hook-Relay.md).
//
// The relay forwards { repo, ref, before, after, forced }, signed with
// RELAY_FORWARD_SECRET. The body is a wake-up, not truth: we ask GitHub what
// changed, and if any of it is under tooling/ or vertical-toolkits/ we purge the
// `content` tag and warm the home page. The next render syncs the corpus itself.
export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { SOURCE, forgetHead } from '../../lib/corpus';
import { verify } from '../../lib/hook-signature';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const env = (k: string): string | undefined => (import.meta.env as any)[k] ?? process.env[k];

/** Whether a push touched the published areas. `true` when we can't tell. */
async function touchesCorpus(before?: string, after?: string): Promise<boolean> {
  if (!before || !after || /^0+$/.test(before) || /^0+$/.test(after)) return true;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'lossless-toolkit-site',
  };
  const t = env('GITHUB_TOKEN') ?? env('GITHUB_API_TOKEN');
  if (t) headers.Authorization = `Bearer ${t}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${SOURCE.repo}/compare/${before}...${after}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return true;
    const files = ((await res.json()).files ?? []) as { filename: string; previous_filename?: string }[];
    if (files.length >= 300) return true; // GitHub truncates compare at 300 files
    return files.some((f) =>
      [f.filename, f.previous_filename].some((p) => p && /^(tooling|vertical-toolkits)\//i.test(p)),
    );
  } catch {
    return true;
  }
}

export const POST: APIRoute = async (context) => {
  if (context.cache.enabled) context.cache.set(false);
  const raw = await context.request.text();
  if (!verify(raw, context.request.headers.get('x-relay-signature-256'), env('RELAY_FORWARD_SECRET'))) {
    return json(401, { error: 'bad signature' });
  }

  let body: { repo?: string; ref?: string; before?: string; after?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad json' });
  }

  if (body.repo?.toLowerCase() !== SOURCE.repo) return new Response(null, { status: 204 });
  if (body.ref && body.ref !== `refs/heads/${SOURCE.ref}`) return new Response(null, { status: 204 });
  if (!(await touchesCorpus(body.before, body.after))) return json(200, { purged: false });

  forgetHead();
  if (context.cache.enabled) await context.cache.invalidate({ tags: ['content'] });

  // Warm the front door so the first reader after a push doesn't pay for the
  // sync. The pause lets GitHub's API catch up with the push.
  const origin = new URL(context.request.url).origin;
  const warm = new Promise((r) => setTimeout(r, 1500)).then(() =>
    Promise.allSettled(['/', '/toolkit/'].map((p) => fetch(origin + p, { headers: { 'user-agent': 'content-hook-warmer' } }))),
  );
  try {
    waitUntil(warm);
  } catch {
    /* not on Vercel: let it run */
  }

  return json(202, { purged: true, cache: context.cache.enabled });
};
