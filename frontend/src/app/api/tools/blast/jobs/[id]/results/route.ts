import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '../../../_store';

const NCBI_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';

async function fetchNcbiBlastResults(rid: string) {
  const url = `${NCBI_BLAST_URL}?CMD=Get&FORMAT_TYPE=JSON2&RID=${rid}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`NCBI results fetch failed: ${res.status}`);

  const data = await res.json();

  // Parse NCBI JSON2 format
  const report = data?.BlastOutput2?.[0]?.report;
  if (!report) throw new Error('Unexpected NCBI response format');

  const search = report.results?.search;
  const hits = search?.hits || [];

  const parsedHits = hits.slice(0, 50).map((hit: any) => {
    const hsp = hit.hsps?.[0] || {};
    return {
      id: hit.description?.[0]?.accession || hit.num?.toString() || 'unknown',
      title: hit.description?.[0]?.title || 'Unknown',
      length: String(hit.len || 0),
      bit_score: String(Math.round(hsp.bit_score || 0)),
      evalue: String(hsp.evalue || 0),
      identity: hsp.identity && hsp.align_len
        ? `${Math.round((hsp.identity / hsp.align_len) * 100)}%`
        : '0%',
    };
  });

  return {
    summary: {
      hit_count: hits.length,
      hits: parsedHits,
    },
    format: 'json',
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Return cached results if available
  if (job.results) {
    return NextResponse.json({
      job_id: job.id,
      task_id: job.rid,
      status: 'completed',
      results: job.results,
    });
  }

  try {
    const results = await fetchNcbiBlastResults(job.rid);
    updateJob(id, { status: 'completed', results });

    return NextResponse.json({
      job_id: job.id,
      task_id: job.rid,
      status: 'completed',
      results,
    });
  } catch (error: any) {
    console.error('BLAST results error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch BLAST results' },
      { status: 500 }
    );
  }
}
