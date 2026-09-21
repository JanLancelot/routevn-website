import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { prepare } from './prepare-directory.mjs';

prepare();
let timer;
const watcher = watch(new URL('../data/', import.meta.url), (_event, file) => {
  if (file !== 'directory.yaml') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { prepare(); } catch (error) { console.error(error.message); }
  }, 60);
});
const child = spawn('node', ['node_modules/rtgl/cli.js', 'sites', 'watch', '--output-path', '.rettangoli/preview', '--reload-mode', 'full', ...process.argv.slice(2)], { stdio: 'inherit' });
function stop() { clearTimeout(timer); watcher.close(); child.kill('SIGTERM'); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => { watcher.close(); process.exit(code ?? 0); });
