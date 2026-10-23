import { spawn } from 'node:child_process';
import { env } from '../config/env.js';

export function runCalibre(input, output, outputFormat) {
  const args = [input, output];
  if (['epub', 'azw3', 'pdf'].includes(outputFormat)) {
    args.push('--embed-all-fonts', '--subset-embedded-fonts');
  }
  if (outputFormat === 'pdf') args.push('--paper-size', 'a4');

  return new Promise((resolve, reject) => {
    const child = spawn(env.calibreBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) { settled = true; reject(new Error('Conversion timed out')); }
    }, env.timeout);
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', e => { clearTimeout(timer); if (!settled) { settled = true; reject(e); } });
    child.on('close', code => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `ebook-convert exited ${code}`));
    });
  });
}

export function calibreVersion() {
  return new Promise(resolve => {
    const c = spawn(env.calibreBin, ['--version']);
    let s = '';
    c.stdout.on('data', d => s += d);
    c.on('error', () => resolve(null));
    c.on('close', () => resolve(s.trim() || null));
  });
}
