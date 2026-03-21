/**
 * Represents a biological sequence (DNA, RNA, or protein)
 */
export interface Sequence {
  id: string;
  name: string;
  content: string;
}

/**
 * Parameters for controlling the multiple sequence alignment algorithm
 */
export interface AlignmentParams {
  method: 'clustal' | 'muscle' | 'mafft';
  gapOpenPenalty: number;
  gapExtensionPenalty: number;
  substitutionMatrix: 'BLOSUM62' | 'BLOSUM45' | 'BLOSUM80' | 'PAM250' | 'PAM30';
}

/**
 * Results from a multiple sequence alignment
 */
export interface AlignmentResult {
  alignedSequences: Sequence[];
  consensusSequence: string;
  newickTree: string;
  treeImage: string | null; // Base64 encoded SVG or URL to tree image
  alignmentScore: number;
  conservedRegions: { start: number; end: number }[];
  method: string;
}

/**
 * Represents a node in a phylogenetic tree
 */
export interface TreeNode {
  name: string;
  length: number;
  children: TreeNode[];
}

/**
 * Represents MSA visualization settings
 */
export interface MSAViewerOptions {
  colorScheme: 'clustal' | 'zappo' | 'taylor' | 'hydrophobicity' | 'helix' | 'strand' | 'turn';
  showConsensus: boolean;
  showConservation: boolean;
  showSequenceLogos: boolean;
}

/**
 * Web Worker message types for alignment
 */
export enum AlignmentWorkerMessageType {
  START_ALIGNMENT = 'START_ALIGNMENT',
  ALIGNMENT_PROGRESS = 'ALIGNMENT_PROGRESS',
  ALIGNMENT_COMPLETE = 'ALIGNMENT_COMPLETE',
  ALIGNMENT_ERROR = 'ALIGNMENT_ERROR'
}

/**
 * Web Worker message for alignment progress
 */
export interface AlignmentWorkerMessage {
  type: AlignmentWorkerMessageType;
  payload: any;
}