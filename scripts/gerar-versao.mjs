// Gera version.json (a página recarrega sozinha quando esse valor muda).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
let sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local';
if (sha === 'local') try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
const agora = new Date().toISOString();
const v = { versao: `${sha}-${agora.replace(/[-:TZ.]/g, '').slice(0, 14)}`, commit: sha, gerado: agora };
fs.writeFileSync(new URL('../version.json', import.meta.url), JSON.stringify(v, null, 2) + '\n');
console.log('version.json →', v.versao);
