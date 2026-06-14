import { NextResponse } from 'next/server';
import { listJobs } from '../_store';

function toApiJob(j: ReturnType<typeof listJobs>[number]) {
  return {
    id: j.id,
    user_id: 1,
    task_id: j.rid,
    sequence: j.sequence,
    database: j.database,
    program: j.program,
    evalue: j.evalue,
    max_hits: j.max_hits,
    output_format: j.output_format,
    use_remote_api: j.use_remote_api,
    status: j.status,
    created_at: j.created_at,
    updated_at: j.updated_at,
  };
}

export async function GET() {
  const jobs = listJobs();
  return NextResponse.json(jobs.map(toApiJob));
}
