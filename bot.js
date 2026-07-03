// Sparkedhost's startup command is fixed to `node bot.js` (support ticket required to change
// it). This shim registers tsx's loader hook on the already-running
// node process, then hands off to the real TypeScript entry point. No compile step, nothing
// generated, no dist/ committed to git.
import { register } from 'tsx/esm/api';

register();
await import('./src/index.ts');
