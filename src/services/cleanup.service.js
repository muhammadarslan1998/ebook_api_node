import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { rmSafe } from '../utils/files.js';
import { jobs } from './jobs.service.js';

export async function deleteJobFiles(job){ if(!job)return; await Promise.all([rmSafe(job.inputPath),rmSafe(job.outputPath),rmSafe(job.workPath)]); }
export async function cleanupJob(id){ const job=jobs.get(id); if(!job)return false; await deleteJobFiles(job); jobs.delete(id); return true; }
async function cleanDir(dir,cutoff){ for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){ const p=path.join(dir,e.name); const st=await fs.stat(p).catch(()=>null); if(st&&st.mtimeMs<cutoff) await rmSafe(p); } }
export async function cleanupExpired(){ const cutoff=Date.now()-env.ttlMs; let count=0; for(const job of jobs.values()){ if(new Date(job.createdAt).getTime()<cutoff){ await cleanupJob(job.id); count++; } } await Promise.all([cleanDir(env.uploads,cutoff),cleanDir(env.outputs,cutoff),cleanDir(env.tmp,cutoff)]); return count; }
