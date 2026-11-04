import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/live-store.ts','lib/campaigns.ts','lib/push.ts','lib/official-indexes.ts','lib/catalog-identity.ts','lib/entry-conditions.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/tests',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const result=spawnSync(process.execPath,['--test','tests/live.test.mjs'],{stdio:'inherit'});process.exitCode=result.status??1;
