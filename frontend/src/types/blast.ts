export interface BlastJobCreate {
  sequence: string;
  database: string;
  program: BlastProgram;
  evalue: number;
  max_hits: number;
  output_format: 'xml' | 'json' | 'tabular';
  use_remote_api: boolean;
}

// Lista de posibles estados de trabajo BLAST
export type BlastJobStatusString = 
  | 'pending' 
  | 'running' 
  | 'queued' 
  | 'starting'
  | 'submitting'
  | 'downloading'
  | 'completed' 
  | 'complete'
  | 'failed'
  | 'error'
  | 'timeout';

export interface BlastJob extends BlastJobCreate {
  id: number;
  user_id: number;
  status: BlastJobStatusString | BlastJobStatus | string;
  task_id?: string;
  result_file?: string;
  created_at: string;
  updated_at: string;
}

export interface BlastJobStatus {
  id: number;
  task_id?: string;
  status: BlastJobStatusString | string;
  message?: string;
  completion_percent?: number;
  created_at: string;
  updated_at: string;
  sequence_preview?: string;
  results?: BlastResults;
}

export interface BlastResults {
  summary: BlastSummary;
  content?: string;
  format: string;
}

export interface BlastSummary {
  hit_count: number;
  hits: BlastHit[];
  error?: string;
}

export interface BlastHit {
  id: string;
  title: string;
  length: string;
  bit_score?: string;
  evalue?: string;
  identity?: string;
}

export type BlastDatabase = 
  | 'nt' 
  | 'nr' 
  | 'refseq_rna' 
  | 'refseq_protein' 
  | 'swissprot' 
  | 'pdbaa';

export type BlastProgram = 
  | 'blastn' 
  | 'blastp' 
  | 'blastx' 
  | 'tblastn' 
  | 'tblastx';

export const BlastDatabaseInfo: Record<BlastDatabase, { name: string, description: string, type: 'nucleotide' | 'protein' }> = {
  'nt': { 
    name: 'Nucleotide (nt)', 
    description: 'Nucleotide collection (nt)',
    type: 'nucleotide'
  },
  'nr': { 
    name: 'Protein (nr)', 
    description: 'Non-redundant protein sequences (nr)',
    type: 'protein'
  },
  'refseq_rna': { 
    name: 'RefSeq RNA', 
    description: 'NCBI RNA reference sequences',
    type: 'nucleotide'
  },
  'refseq_protein': { 
    name: 'RefSeq Protein', 
    description: 'NCBI Protein reference sequences',
    type: 'protein'
  },
  'swissprot': { 
    name: 'SwissProt', 
    description: 'Manually annotated and reviewed protein sequences',
    type: 'protein'
  },
  'pdbaa': { 
    name: 'PDB Proteins', 
    description: 'Protein Data Bank proteins',
    type: 'protein'
  }
};

export const BlastProgramInfo: Record<BlastProgram, { name: string, description: string, dbType: 'nucleotide' | 'protein' | 'both', queryType: 'nucleotide' | 'protein' }> = {
  'blastn': { 
    name: 'BLASTN', 
    description: 'Nucleotide vs. Nucleotide',
    dbType: 'nucleotide',
    queryType: 'nucleotide'
  },
  'blastp': { 
    name: 'BLASTP', 
    description: 'Protein vs. Protein',
    dbType: 'protein',
    queryType: 'protein'
  },
  'blastx': { 
    name: 'BLASTX', 
    description: 'Translated Nucleotide vs. Protein',
    dbType: 'protein',
    queryType: 'nucleotide'
  },
  'tblastn': { 
    name: 'TBLASTN', 
    description: 'Protein vs. Translated Nucleotide',
    dbType: 'nucleotide',
    queryType: 'protein'
  },
  'tblastx': { 
    name: 'TBLASTX', 
    description: 'Translated Nucleotide vs. Translated Nucleotide',
    dbType: 'nucleotide',
    queryType: 'nucleotide'
  }
};

export const isCompatible = (program: BlastProgram, database: BlastDatabase): boolean => {
  const programInfo = BlastProgramInfo[program];
  const databaseInfo = BlastDatabaseInfo[database];
  
  if (!programInfo || !databaseInfo) return false;
  
  return programInfo.dbType === 'both' || programInfo.dbType === databaseInfo.type;
};

export const getCompatibleDatabases = (program: BlastProgram): BlastDatabase[] => {
  const programInfo = BlastProgramInfo[program];
  if (!programInfo) return [];
  
  return Object.entries(BlastDatabaseInfo)
    .filter(([_, info]) => programInfo.dbType === 'both' || programInfo.dbType === info.type)
    .map(([key]) => key as BlastDatabase);
};

export const getCompatiblePrograms = (database: BlastDatabase): BlastProgram[] => {
  const databaseInfo = BlastDatabaseInfo[database];
  if (!databaseInfo) return [];
  
  return Object.entries(BlastProgramInfo)
    .filter(([_, info]) => info.dbType === 'both' || info.dbType === databaseInfo.type)
    .map(([key]) => key as BlastProgram);
};

export const validateSequence = (sequence: string, program: BlastProgram): { valid: boolean, message?: string } => {
  if (!sequence || sequence.trim().length < 10) {
    return { valid: false, message: 'La secuencia debe tener al menos 10 caracteres' };
  }
  
  const cleanSequence = sequence.replace(/\s/g, '').toUpperCase();
  const programInfo = BlastProgramInfo[program];
  
  if (!programInfo) {
    return { valid: false, message: 'Programa BLAST inválido' };
  }
  
  // Validación para secuencias de nucleótidos
  if (programInfo.queryType === 'nucleotide') {
    const validChars = new Set('ACGTN');
    const invalidChars = [...cleanSequence].filter(char => !validChars.has(char));
    
    if (invalidChars.length > 0) {
      return { 
        valid: false, 
        message: `La secuencia contiene caracteres inválidos para nucleótidos: ${[...new Set(invalidChars)].join(', ')}` 
      };
    }
  }
  
  // Validación para secuencias de proteínas
  if (programInfo.queryType === 'protein') {
    const validChars = new Set('ACDEFGHIKLMNPQRSTVWY');
    const invalidChars = [...cleanSequence].filter(char => !validChars.has(char));
    
    if (invalidChars.length > 0) {
      return { 
        valid: false, 
        message: `La secuencia contiene caracteres inválidos para proteínas: ${[...new Set(invalidChars)].join(', ')}` 
      };
    }
  }
  
  return { valid: true };
};