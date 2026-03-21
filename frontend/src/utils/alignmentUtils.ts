import { Sequence, AlignmentParams } from '@/types/alignment';

/**
 * Performs a ClustalW-like alignment algorithm in the browser
 * 
 * @param sequences Input sequences to align
 * @param params Alignment parameters
 * @returns Aligned sequences
 */
export const performClustalAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  // This is a simplified implementation for browser-based MSA
  // In a real app, this would either use WebAssembly to run the actual algorithm
  // or make API calls to a backend service
  
  // For the demo, we'll implement a simple version of the progressive alignment
  
  // Step 1: Calculate pairwise distances
  const distanceMatrix = calculateDistanceMatrix(sequences);
  
  // Step 2: Generate guide tree
  const guideTree = generateGuideTree(distanceMatrix, sequences);
  
  // Step 3: Progressive alignment based on the guide tree
  const alignedSequences = progressiveAlignment(guideTree, sequences, params);
  
  // Return aligned sequences
  return alignedSequences;
};

/**
 * Performs a MUSCLE-like alignment algorithm in the browser
 */
export const performMuscleAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  // For demo purposes, we'll use a modified version of our clustal implementation
  // with some randomization to differentiate results
  
  const alignedSequences = await performClustalAlignment(sequences, params);
  
  // Apply some refinement iterations (simplified for demo)
  const refinedSequences = refineAlignment(alignedSequences, 2);
  
  return refinedSequences;
};

/**
 * Performs a MAFFT-like alignment algorithm in the browser
 */
export const performMafftAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  // For demo purposes, we'll use another variant of our implementation
  
  const alignedSequences = await performClustalAlignment(sequences, params);
  
  // Apply different refinement strategy (simplified for demo)
  const refinedSequences = refineAlignment(alignedSequences, 3);
  
  return refinedSequences;
};

/**
 * Generates a consensus sequence from a set of aligned sequences
 */
export const generateConsensusSequence = (alignedSequences: Sequence[]): string => {
  if (alignedSequences.length === 0 || alignedSequences[0].content.length === 0) {
    return '';
  }
  
  const seqLength = alignedSequences[0].content.length;
  let consensusSeq = '';
  
  // For each position in the alignment
  for (let i = 0; i < seqLength; i++) {
    const charCounts: Record<string, number> = {};
    let maxChar = '';
    let maxCount = 0;
    
    // Count occurrences of each character at this position
    for (const seq of alignedSequences) {
      if (i < seq.content.length) {
        const char = seq.content[i];
        charCounts[char] = (charCounts[char] || 0) + 1;
        
        if (charCounts[char] > maxCount) {
          maxChar = char;
          maxCount = charCounts[char];
        }
      }
    }
    
    // Use the most common character for consensus
    consensusSeq += maxChar;
  }
  
  return consensusSeq;
};

/**
 * Generates a Newick tree format string from aligned sequences
 */
export const generateNewickTree = (alignedSequences: Sequence[]): string => {
  // Simple implementation to generate a Newick tree format
  // In a real application, this would use a proper phylogenetic algorithm
  
  // Calculate distance matrix
  const distanceMatrix = calculateDistanceMatrix(alignedSequences);
  
  // Use UPGMA to generate a tree (simplified)
  const newickTree = generateUPGMATree(distanceMatrix, alignedSequences);
  
  return newickTree;
};

// -------------------- Helper functions --------------------

/**
 * Calculates a distance matrix from sequences
 */
const calculateDistanceMatrix = (sequences: Sequence[]): number[][] => {
  const numSeqs = sequences.length;
  const distMatrix: number[][] = Array(numSeqs).fill(0).map(() => Array(numSeqs).fill(0));
  
  for (let i = 0; i < numSeqs; i++) {
    for (let j = i + 1; j < numSeqs; j++) {
      // Calculate simple Hamming distance
      const distance = calculateHammingDistance(sequences[i].content, sequences[j].content);
      distMatrix[i][j] = distance;
      distMatrix[j][i] = distance; // Matrix is symmetric
    }
  }
  
  return distMatrix;
};

/**
 * Calculates Hamming distance between two sequences
 */
const calculateHammingDistance = (seq1: string, seq2: string): number => {
  const maxLength = Math.max(seq1.length, seq2.length);
  let distance = 0;
  
  for (let i = 0; i < maxLength; i++) {
    if (i >= seq1.length || i >= seq2.length || seq1[i] !== seq2[i]) {
      distance++;
    }
  }
  
  return distance / maxLength; // Normalize
};

/**
 * Generates a simplified guide tree based on distance matrix
 */
const generateGuideTree = (
  distanceMatrix: number[][],
  sequences: Sequence[]
): string => {
  // This is a simplified implementation
  // In a real app, we would use a proper UPGMA or Neighbor-Joining algorithm
  
  // For demo, create a basic tree structure
  const seqNames = sequences.map(seq => seq.name);
  return `(${seqNames.join(',')});`;
};

/**
 * Performs progressive alignment based on guide tree
 */
const progressiveAlignment = (
  guideTree: string,
  sequences: Sequence[],
  params: AlignmentParams
): Sequence[] => {
  // Simplified implementation
  
  // Clone sequences to avoid mutating the originals
  const result = sequences.map(seq => ({
    ...seq,
    content: seq.content
  }));
  
  // Find the maximum sequence length
  const maxLength = Math.max(...sequences.map(seq => seq.content.length));
  
  // Align all sequences to the same length by adding gaps
  // This is a very simplified approach for demo purposes only
  // A real MSA algorithm would use dynamic programming and scoring matrices
  result.forEach(seq => {
    // Add gaps to make all sequences the same length
    if (seq.content.length < maxLength) {
      const gapsToAdd = maxLength - seq.content.length;
      const gapPosition = Math.floor(seq.content.length / 2);
      
      seq.content = 
        seq.content.substring(0, gapPosition) + 
        '-'.repeat(gapsToAdd) + 
        seq.content.substring(gapPosition);
    }
    
    // Insert some additional gaps based on alignment algorithm parameters
    // This helps simulate differences between algorithm results
    const gapChance = params.gapOpenPenalty / 50; // Higher penalty = fewer random gaps
    let modified = '';
    
    for (let i = 0; i < seq.content.length; i++) {
      modified += seq.content[i];
      
      // Randomly insert gaps with probability based on params
      if (Math.random() < gapChance) {
        modified += '-';
      }
    }
    
    seq.content = modified;
  });
  
  // Find the new maximum length after adding gaps
  const newMaxLength = Math.max(...result.map(seq => seq.content.length));
  
  // Ensure all sequences have the same final length
  result.forEach(seq => {
    if (seq.content.length < newMaxLength) {
      seq.content = seq.content + '-'.repeat(newMaxLength - seq.content.length);
    }
  });
  
  return result;
};

/**
 * Refines an alignment with a specified number of iterations
 */
const refineAlignment = (
  alignedSequences: Sequence[],
  iterations: number
): Sequence[] => {
  // Clone to avoid mutating input
  const refined = alignedSequences.map(seq => ({ ...seq }));
  
  // For demonstration, make small modifications to simulate refinement
  for (let iter = 0; iter < iterations; iter++) {
    refined.forEach(seq => {
      // Randomly shift gaps in a way that preserves sequence length
      let content = seq.content;
      for (let i = 0; i < content.length - 1; i++) {
        if (content[i] === '-' && content[i+1] !== '-' && Math.random() < 0.2) {
          // Swap a gap with the next character
          content = 
            content.substring(0, i) + 
            content[i+1] + 
            '-' + 
            content.substring(i+2);
        }
      }
      seq.content = content;
    });
  }
  
  return refined;
};

/**
 * Generates a UPGMA tree in Newick format
 */
const generateUPGMATree = (
  distanceMatrix: number[][],
  sequences: Sequence[]
): string => {
  // This is a very simplified version
  
  // For demo purposes, generate a balanced binary tree
  // In a real application, this would be a proper UPGMA implementation
  
  const names = sequences.map(seq => seq.name);
  
  if (names.length <= 1) {
    return names[0] || '';
  }
  
  if (names.length === 2) {
    return `(${names[0]}:0.1,${names[1]}:0.1);`;
  }
  
  // Divide sequences into two roughly equal groups
  const midpoint = Math.floor(names.length / 2);
  const leftGroup = names.slice(0, midpoint);
  const rightGroup = names.slice(midpoint);
  
  // Recursively build left and right subtrees
  const leftBranch = leftGroup.length === 1 
    ? leftGroup[0] 
    : `(${leftGroup.join(':0.05,') + ':0.05'})`;
    
  const rightBranch = rightGroup.length === 1 
    ? rightGroup[0] 
    : `(${rightGroup.join(':0.05,') + ':0.05'})`;
  
  return `(${leftBranch}:0.1,${rightBranch}:0.1);`;
};