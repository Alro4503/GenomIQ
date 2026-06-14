import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '../../../_store';

const NCBI_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';

async function checkNcbiBlastStatus(rid: string): Promise<{ status: string; message: string }> {
  const url = `${NCBI_BLAST_URL}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { status: 'running', message: 'Checking status...' };

  const text = await res.text();

  if (text.includes('Status=WAITING')) {
    return { status: 'running', message: 'BLAST search in progress...' };
  }
  if (text.includes('Status=READY')) {
    return { status: 'completed', message: 'BLAST search completed' };
  }
  if (text.includes('Status=FAILED')) {
    return { status: 'failed', message: 'BLAST search failed' };
  }
  if (text.includes('Status=UNKNOWN')) {
    return { status: 'failed', message: 'BLAST job expired or not found' };
  }

  return { status: 'running', message: 'Processing...' };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // If already in terminal state, return stored status
  if (['completed', 'complete', 'failed', 'error'].includes(job.status)) {
    return NextResponse.json({
      id: job.id,
      task_id: job.rid,
      status: job.status,
      message: job.status === 'completed' ? 'BLAST search completed' : 'BLAST search failed',
      completion_percent: job.status === 'completed' ? 100 : 0,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  }

  try {
    const { status, message } = await checkNcbiBlastStatus(job.rid);
    updateJob(id, { status });

    return NextResponse.json({
      id: job.id,
      task_id: job.rid,
      status,
      message,
      completion_percent: status === 'completed' ? 100 : 50,
      created_at: job.created_at,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      id: job.id,
      task_id: job.rid,
      status: 'running',
      message: 'Checking BLAST status...',
      completion_percent: 30,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  }
}
