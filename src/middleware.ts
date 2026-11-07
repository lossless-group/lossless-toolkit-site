// Bring the corpus up to the vault's head before any on-demand render. Cheap
// when nothing moved (one conditional GitHub request at most every 10 s per
// instance), and it never throws: a failed sync serves the last good snapshot.
import { defineMiddleware } from 'astro:middleware';
import { syncCorpus } from './lib/corpus';

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.isPrerendered) await syncCorpus();
  return next();
});
