// 跨版本测试入口：Node 18–24 都可用。
// 直接写 `node --test test/` 在 Node 22+ 的 Windows 上会报 MODULE_NOT_FOUND，而 glob 参数要 Node 21+，
// 所以这里自己列出 *.test.mjs 再交给 node --test。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(dir, f));
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
