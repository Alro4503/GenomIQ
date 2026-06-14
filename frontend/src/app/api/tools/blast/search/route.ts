import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '../_store';

const NCBI_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';

async function submitToNcbiBlast(
  sequence: string,
  program: string,
  database: string,
  evalue: number,
  maxHits: number
): Promise<string> {
  const params = new URLSearchParams({
    CMD: 'Put',
    PROGRAM: program,
    DATABASE: database,
    QUERY: sequence,
    EXPECT: String(evalue),
    HITLIST_SIZE: String(maxHits),
    FORMAT_TYPE: 'JSON2',
    MEGABLAST: program === 'blastn' ? 'on' : 'off',
  });

  const res = await fetch(NCBI_BLAST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`NCBI BLAST submission failed: ${res.status}`);

  const html = await res.text();

  // Extract RID from the HTML response
  const ridMatch = html.match(/RID\s*=\s*([A-Z0-9]+)/);
  if (!ridMatch?.[1]) throw new Error('Could not extract RID from NCBI BLAST response');

  return ridMatch[1];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sequence,
      program = 'blastn',
      database = 'nt',
      evalue = 0.01,
      max_hits = 10,
      output_format = 'json',
      use_remote_api = true,
    } = body;

    if (!sequence || sequence.trim().length < 10) {
      return NextResponse.json(
        { error: 'Sequence must be at least 10 characters' },
        { status: 400 }
      );
    }

    const rid = await submitToNcbiBlast(sequence.trim(), program, database, evalue, max_hits);

    const now = new Date().toISOString();
    const job = createJob({
      rid,
      sequence,
      database,
      program,
      evalue,
      max_hits,
      output_format,
      use_remote_api,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      id: job.id,
      user_id: 1,
      task_id: rid,
      sequence,
      database,
      program,
      evalue,
      max_hits,
      output_format,
      use_remote_api,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  } catch (error: any) {
    console.error('BLAST search error:', error);
    return NextResponse.json(
      { error: error.message || 'BLAST submission failed' },
      { status: 500 }
    );
  }
}

