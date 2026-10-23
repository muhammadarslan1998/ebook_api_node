import fs from 'node:fs/promises';
import path from 'node:path';
export const safeName = (name='book') => path.basename(name).replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^[-.]+/,'') || 'book';
export async function exists(p){ try { await fs.access(p); return true; } catch { return false; } }
export async function rmSafe(p){ if (p) await fs.rm(p,{recursive:true,force:true}); }
export async function ensureDirs(...dirs){ await Promise.all(dirs.map(d=>fs.mkdir(d,{recursive:true}))); }
