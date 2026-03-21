export interface AnnotationSettings {
  sequenceType: 'dna' | 'protein';
  database: 'uniprot' | 'pfam' | 'genbank' | 'prosite';
  showFeatures: {
    domains: boolean;
    motifs: boolean;
    modifications: boolean;
    variants: boolean;
  };
}

export interface AnnotationFeature {
  id: string;
  name: string;
  type: 'domain' | 'motif' | 'modification' | 'variant';
  start: number;
  end: number;
  description: string;
  color: string;
  evidence?: string;
  score?: number;
  source?: string;
}

// Interfaces para tipado de respuestas API (no utilizadas directamente en el frontend)
export interface ApiResponseUniprot {
  entry: {
    accession: string[];
    entryType: string;
    id: string;
    proteinDescription: {
      recommendedName: {
        fullName: {
          value: string;
        };
      };
    };
    organism: {
      scientificName: string;
    };
    sequence: {
      length: number;
      value: string;
    };
    features: Array<{
      type: string;
      location: {
        start: {
          value: number;
        };
        end: {
          value: number;
        };
      };
      description?: {
        value: string;
      };
      evidence?: Array<{
        code: string;
      }>;
    }>;
  };
}

export interface ApiResponsePfam {
  results: Array<{
    match_id: string;
    match_description: string;
    location: {
      start: number;
      end: number;
      score?: number;
    };
  }>;
}

export interface ApiResponseProsite {
  matches: Array<{
    signature_id: string;
    signature_desc: string;
    locations: Array<{
      start: number;
      end: number;
      fragments: Array<{
        dc?: {
          score?: number;
        };
      }>;
    }>;
  }>;
}

export interface ApiResponseGenBank {
  features: Array<{
    feature_key: string;
    location: {
      start: number;
      end: number;
    };
    qualifiers: Array<{
      qualifier_name: string;
      qualifier_value: string;
    }>;
  }>;
}

// Interfaces para las respuestas del backend
export interface AnnotationJob {
  id: number;
  title: string;
  description?: string;
  sequence_type: 'dna' | 'protein';
  database: 'uniprot' | 'pfam' | 'genbank' | 'prosite';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  sequence_id?: string;
  file_name?: string;
  file_size?: number;
}

export interface AnnotationJobWithFeatures extends AnnotationJob {
  features: AnnotationFeature[];
}