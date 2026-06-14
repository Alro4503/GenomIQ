import { NextRequest, NextResponse } from 'next/server';

const NCBI_API_KEY = process.env.NCBI_API_KEY;
const NCBI_TOOL = process.env.NCBI_TOOL_NAME || 'GenomIQ-Demo';
const NCBI_EMAIL = process.env.NCBI_EMAIL || 'demo@genomiq.cat';
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb';

function ncbiParams(extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ tool: NCBI_TOOL, email: NCBI_EMAIL, ...extra });
  if (NCBI_API_KEY) params.set('api_key', NCBI_API_KEY);
  return params.toString();
}

async function fetchNcbiSequence(id: string, db: string): Promise<string> {
  const rettype = db === 'protein' ? 'fasta' : 'fasta';
  const url = `${NCBI_BASE}/efetch.fcgi?${ncbiParams({ db, id, rettype, retmode: 'text' })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`NCBI fetch failed: ${res.status}`);
  const text = await res.text();
  // Extract sequence from FASTA (skip header lines starting with >)
  const lines = text.split('\n');
  const seqLines = lines.filter(l => !l.startsWith('>') && l.trim().length > 0);
  return seqLines.join('').toUpperCase();
}

async function fetchUniprotSequence(id: string): Promise<string> {
  const url = `${UNIPROT_BASE}/${id}.fasta`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`UniProt fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');
  const seqLines = lines.filter(l => !l.startsWith('>') && l.trim().length > 0);
  return seqLines.join('').toUpperCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const database = searchParams.get('database') || 'dna';

  if (!id.trim()) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    let sequence: string;

    // Detect UniProt accession pattern (e.g., P12345, Q9Y478)
    const isUniprotId = /^[A-Z][0-9][A-Z0-9]{3}[0-9]$|^[OPQ][0-9][A-Z0-9]{3}[0-9]$/.test(id.toUpperCase());

    if (isUniprotId || database === 'protein') {
      try {
        sequence = await fetchUniprotSequence(id);
      } catch {
        // Fallback to NCBI protein db
        sequence = await fetchNcbiSequence(id, 'protein');
      }
    } else {
      const ncbiDb = database === 'rna' ? 'nuccore' : 'nuccore';
      sequence = await fetchNcbiSequence(id, ncbiDb);
    }

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    return NextResponse.json({ sequence });
  } catch (error: any) {
    console.error('Sequence fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch sequence' }, { status: 500 });
  }
}
