// In-memory store for BLAST jobs (persists within warm serverless instance)
// Sufficient for portfolio demo sessions

export interface BlastJobRecord {
  id: number;
  rid: string;
  sequence: string;
  database: string;
  program: string;
  evalue: number;
  max_hits: number;
  output_format: string;
  use_remote_api: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  results?: any;
}

const store = new Map<number, BlastJobRecord>();
let counter = 1;

export function createJob(data: Omit<BlastJobRecord, 'id'>): BlastJobRecord {
  const id = counter++;
  const job: BlastJobRecord = { id, ...data };
  store.set(id, job);
  return job;
}

export function getJob(id: number): BlastJobRecord | undefined {
  return store.get(id);
}

export function updateJob(id: number, patch: Partial<BlastJobRecord>): BlastJobRecord | undefined {
  const job = store.get(id);
  if (!job) return undefined;
  const updated = { ...job, ...patch, updated_at: new Date().toISOString() };
  store.set(id, updated);
  return updated;
}

export function listJobs(): BlastJobRecord[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function deleteJob(id: number): void {
  store.delete(id);
}
