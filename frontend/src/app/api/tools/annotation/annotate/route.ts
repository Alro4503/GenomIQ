import { NextRequest, NextResponse } from 'next/server';

const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb';
const INTERPRO_BASE = 'https://www.ebi.ac.uk/interpro/api';

// Map UniProt feature types to our annotation types
const FEATURE_TYPE_MAP: Record<string, 'domain' | 'motif' | 'modification' | 'variant'> = {
  'Domain': 'domain',
  'Region': 'domain',
  'Motif': 'motif',
  'Repeat': 'motif',
  'Modified residue': 'modification',
  'Glycosylation': 'modification',
  'Disulfide bond': 'modification',
  'Cross-link': 'modification',
  'Natural variant': 'variant',
  'Mutagenesis': 'variant',
  'Active site': 'motif',
  'Binding site': 'motif',
  'Site': 'motif',
  'Signal peptide': 'domain',
  'Transit peptide': 'domain',
  'Propeptide': 'domain',
  'Chain': 'domain',
  'Peptide': 'domain',
  'Zinc finger': 'domain',
  'DNA binding': 'domain',
  'Coiled coil': 'domain',
  'Compositional bias': 'motif',
  'Topological domain': 'domain',
  'Transmembrane': 'domain',
  'Intramembrane': 'domain',
};

const FEATURE_COLORS: Record<string, string> = {
  domain: '#4A90E2',
  motif: '#7ED321',
  modification: '#F5A623',
  variant: '#D0021B',
};

async function annotateByUniprotId(uniprotId: string, settings: any) {
  const url = `${UNIPROT_BASE}/${uniprotId}?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`UniProt fetch failed: ${res.status}`);
  const data = await res.json();

  const features: any[] = [];
  const rawFeatures = data.features || [];
  const sequence = data.sequence?.value || null;

  for (const feat of rawFeatures) {
    const featureType = feat.type || '';
    const mappedType = FEATURE_TYPE_MAP[featureType];
    if (!mappedType) continue;

    // Filter based on settings
    if (mappedType === 'domain' && !settings.showFeatures?.domains) continue;
    if (mappedType === 'motif' && !settings.showFeatures?.motifs) continue;
    if (mappedType === 'modification' && !settings.showFeatures?.modifications) continue;
    if (mappedType === 'variant' && !settings.showFeatures?.variants) continue;

    const start = feat.location?.start?.value || feat.location?.position?.value || 0;
    const end = feat.location?.end?.value || feat.location?.position?.value || start;
    const desc = feat.description || feat.evidences?.[0]?.source?.name || featureType;

    features.push({
      id: `${uniprotId}-${features.length}`,
      name: featureType,
      type: mappedType,
      start,
      end,
      description: desc,
      color: FEATURE_COLORS[mappedType],
      evidence: feat.evidences?.[0]?.code || 'experimental',
      source: 'UniProt',
    });
  }

  return { features, sequence };
}

async function annotateByInterPro(uniprotId: string, settings: any) {
  const url = `${INTERPRO_BASE}/protein/UniProt/${uniprotId}/entry/interpro/?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return [];
  const data = await res.json();

  const features: any[] = [];
  const entries = data.results || [];

  for (const entry of entries) {
    if (!settings.showFeatures?.domains) continue;
    const entryAccession = entry.metadata?.accession || '';
    const entryName = entry.metadata?.name || entryAccession;
    const source = entry.metadata?.source_database || 'InterPro';
    const locations = entry.proteins?.[0]?.entry_protein_locations || [];

    for (const loc of locations) {
      for (const fragment of loc.fragments || []) {
        features.push({
          id: `interpro-${entryAccession}-${features.length}`,
          name: entryName,
          type: 'domain',
          start: fragment.start || 0,
          end: fragment.end || 0,
          description: `${source}: ${entryName}`,
          color: '#4A90E2',
          score: loc.score,
          source,
        });
      }
    }
  }

  return features;
}

function detectUniprotId(input: string): string | null {
  // UniProt accession: starts with letter, 5-10 alphanumeric chars
  const match = input.trim().match(/^([A-Z][0-9][A-Z0-9]{3}[0-9]|[A-Z][0-9][A-Z0-9]{3}[0-9]-[0-9]+)$/i);
  return match ? match[1].toUpperCase() : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings, sequence: seqData } = body;
    const sequenceData: string | null = seqData?.sequence_data || null;
    const sequenceId: string | null = seqData?.sequence_id || null;
    const database = settings?.database || 'uniprot';

    let uniprotId = sequenceId ? detectUniprotId(sequenceId) : null;
    if (!uniprotId && sequenceData) {
      uniprotId = detectUniprotId(sequenceData.trim().split(/\s+/)[0]);
    }

    if (!uniprotId && !sequenceData) {
      return NextResponse.json(
        { error: 'Provide a UniProt accession ID or protein sequence for annotation.' },
        { status: 400 }
      );
    }

    if (!uniprotId) {
      // No UniProt ID available: return a demo response for raw sequences
      // (real InterPro sequence search requires async jobs)
      return NextResponse.json({
        features: [],
        sequence: sequenceData,
        message: 'For raw sequence annotation, please provide a UniProt accession ID (e.g., P12345). Direct sequence annotation is not available in this demo.',
      });
    }

    // Get UniProt annotations
    const { features: uniprotFeatures, sequence } = await annotateByUniprotId(uniprotId, settings);

    let interproFeatures: any[] = [];
    if (database === 'pfam' || database === 'prosite' || uniprotFeatures.length === 0) {
      try {
        interproFeatures = await annotateByInterPro(uniprotId, settings);
      } catch {
        // InterPro is optional
      }
    }

    const allFeatures = [...uniprotFeatures, ...interproFeatures];

    return NextResponse.json({
      features: allFeatures,
      sequence: sequence || sequenceData,
    });
  } catch (error: any) {
    console.error('Annotation error:', error);
    return NextResponse.json(
      { error: error.message || 'Annotation failed' },
      { status: 500 }
    );
  }
}
