/**
 * Thin by design. Schemas live next to the content they describe
 * (`src/content/<collection>/config.ts`), not in one file that becomes a
 * merge-conflict magnet nobody wants to open.
 *
 * This file does one thing: compose.
 */
import { tooling } from './content/tooling/config';
import { verticalToolkits } from './content/vertical-toolkits/config';

export const collections = {
  tooling,
  'vertical-toolkits': verticalToolkits,
};
