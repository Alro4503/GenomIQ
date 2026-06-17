import { NextRequest, NextResponse } from 'next/server';
import { getJob, deleteJob } from '../../_store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    user_id: 1,
    task_id: job.rid,
    sequence: job.sequence,
    database: job.database,
    program: job.program,
    evalue: job.evalue,
    max_hits: job.max_hits,
    output_format: job.output_format,
    use_remote_api: job.use_remote_api,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  deleteJob(id);
  return NextResponse.json({ message: 'Job deleted' });
}
