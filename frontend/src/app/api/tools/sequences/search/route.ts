import { NextRequest, NextResponse } from 'next/server';

const NCBI_API_KEY = process.env.NCBI_API_KEY;
const NCBI_TOOL = process.env.NCBI_TOOL_NAME || 'GenomIQ-Demo';
const NCBI_EMAIL = process.env.NCBI_EMAIL || 'demo@genomiq.cat';
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb';

function ncbiParams(extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    tool: NCBI_TOOL,
    email: NCBI_EMAIL,
    retmode: 'json',
    ...extra,
  });
  if (NCBI_API_KEY) params.set('api_key', NCBI_API_KEY);
  return params.toString();
}

async function searchNcbi(query: string, db: string, retmax = 8) {
  try {
    const searchUrl = `${NCBI_BASE}/esearch.fcgi?${ncbiParams({ db, term: query, retmax: String(retmax) })}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(20000) });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids: string[] = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const summaryUrl = `${NCBI_BASE}/esummary.fcgi?${ncbiParams({ db, id: ids.join(',') })}`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(20000) });
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    const uids: string[] = summaryData.result?.uids || [];

    const seqType = db === 'protein' ? 'protein' : db === 'nuccore' ? 'dna' : 'dna';

    return uids.map((uid: string) => {
      const entry = summaryData.result[uid];
      // Use accessionversion (e.g. "NM_001234.3") as ID — more reliable for efetch than numeric UID
      const accession = entry?.accessionversion || entry?.caption || uid;
      return {
        id: accession,
        name: entry?.title || entry?.caption || `${db}:${uid}`,
        organism: entry?.organism || 'Unknown',
        length: entry?.slen || entry?.length || 0,
        type: seqType,
        preview: entry?.title?.substring(0, 100) || '',
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchUniprot(query: string, retmax = 5) {
  try {
    const url = `${UNIPROT_BASE}/search?query=${encodeURIComponent(query)}&format=json&size=${retmax}&fields=accession,protein_name,organism_name,sequence`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((entry: any) => ({
      id: entry.primaryAccession,
      name: entry.proteinDescription?.recommendedName?.fullName?.value ||
            entry.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
            entry.primaryAccession,
      organism: entry.organism?.scientificName || 'Unknown',
      length: entry.sequence?.length || 0,
      type: 'protein',
      preview: entry.primaryAccession,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const type = searchParams.get('type') || 'all';

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const tasks: Promise<any[]>[] = [];

    if (type === 'nucleotide' || type === 'all') {
      tasks.push(searchNcbi(query, 'nuccore', 8));
    }
    if (type === 'protein' || type === 'all') {
      tasks.push(searchNcbi(query, 'protein', 5));
      tasks.push(searchUniprot(query, 5));
    }

    const results = await Promise.all(tasks);
    const merged = results.flat();

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = merged.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return NextResponse.json({ results: unique.slice(0, 15) });
  } catch (error: any) {
    console.error('Sequence search error:', error);
    return NextResponse.json({ results: [] });
  }
}
