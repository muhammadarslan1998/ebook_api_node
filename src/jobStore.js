'use strict';
/**
 * In-memory job store for async conversion tracking & automated cleanup.
 *
 * Shape of a job:
 * {
 *   id:         string (uuid),
 *   status:     'queued' | 'processing' | 'done' | 'failed',
 *   sourceFile: string (original filename),
 *   from:       string (source format),
 *   to:         string (target format),
 *   outputFile: string | null,
 *   error:      string | null,
 *   createdAt:  Date,
 *   updatedAt:  Date,
 * }
 */

const fs   = require('fs');
const path = require('path');

const jobs = new Map();

function createJob(data) {
  const job = {
    id:         data.id,
    status:     'queued',
    sourceFile: data.sourceFile,
    from:       data.from,
    to:         data.to,
    outputFile: null,
    error:      null,
    createdAt:  new Date(),
    updatedAt:  new Date(),
  };
  jobs.set(job.id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date() });
  return job;
}

function getAllJobs() {
  return [...jobs.values()];
}

/** Clean up files in a directory older than ttlMs */
function cleanDirectory(dirPath, ttlMs) {
  let deletedCount = 0;
  let deletedBytes = 0;

  if (!fs.existsSync(dirPath)) return { deletedCount, deletedBytes };
  const now = Date.now();

  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const filePath = path.join(dirPath, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs >= ttlMs) {
          deletedBytes += stat.size || 0;
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          deletedCount++;
        }
      } catch (_) {}
    }
  } catch (_) {}

  return { deletedCount, deletedBytes };
}

/** Remove jobs older than ttlMs and delete their files from disk */
function pruneOldJobs(ttlMs) {
  const cutoff = Date.now() - ttlMs;
  let prunedJobsCount = 0;

  for (const [id, job] of jobs) {
    if (job.createdAt.getTime() <= cutoff) {
      if (job.outputFile) {
        try {
          if (fs.existsSync(job.outputFile)) {
            const stat = fs.statSync(job.outputFile);
            if (stat.isDirectory()) fs.rmSync(job.outputFile, { recursive: true, force: true });
            else fs.unlinkSync(job.outputFile);
          }
        } catch (_) {}
      }
      jobs.delete(id);
      prunedJobsCount++;
    }
  }

  // Also sweep uploads and converted directories for orphaned files
  const config = require('./config');
  const uploadsStats   = cleanDirectory(config.upload.dir, ttlMs);
  const convertedStats = cleanDirectory(config.output.dir, ttlMs);

  return {
    prunedJobs:       prunedJobsCount,
    uploadsDeleted:   uploadsStats.deletedCount,
    convertedDeleted: convertedStats.deletedCount,
    totalFilesDeleted: uploadsStats.deletedCount + convertedStats.deletedCount,
    bytesFreed:       uploadsStats.deletedBytes + convertedStats.deletedBytes,
  };
}

module.exports = { createJob, getJob, updateJob, getAllJobs, pruneOldJobs, cleanDirectory };
