const jobStore = new Map();

export const jobs = {
  create(jobOrId, data = {}) {
    const job = typeof jobOrId === 'object' && jobOrId !== null
      ? { ...jobOrId }
      : { id: jobOrId, ...data };

    if (!job.id) throw new Error('Job id is required');

    job.jobId = job.id;
    job.createdAt = job.createdAt || new Date().toISOString();
    job.updatedAt = job.updatedAt || job.createdAt;
    jobStore.set(job.id, job);
    return job;
  },

  get(id) { return jobStore.get(id) || null; },

  update(id, data = {}) {
    const current = jobStore.get(id);
    if (!current) return null;
    const updated = { ...current, ...data, id, jobId: id, updatedAt: new Date().toISOString() };
    jobStore.set(id, updated);
    return updated;
  },

  delete(id) { return jobStore.delete(id); },
  has(id) { return jobStore.has(id); },
  values() { return jobStore.values(); },
  keys() { return jobStore.keys(); },
  entries() { return jobStore.entries(); },
  getAll() { return Array.from(jobStore.values()); },
  clear() { jobStore.clear(); },
  get size() { return jobStore.size; }
};
