/**
 * Genetic code mapping for translation
 * Maps codons (triplets of nucleotides) to amino acids
 */
const DNA_GENETIC_CODE: Record<string, string> = {
    'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
    'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
    'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M', // ATG is start codon
    'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
    'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
    'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
    'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
    'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
    'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*', // TAA, TAG are stop codons
    'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
    'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
    'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W', // TGA is stop codon
    'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
    'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
    'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
};

const RNA_GENETIC_CODE: Record<string, string> = {
    'UUU': 'F', 'UUC': 'F', 'UUA': 'L', 'UUG': 'L',
    'CUU': 'L', 'CUC': 'L', 'CUA': 'L', 'CUG': 'L',
    'AUU': 'I', 'AUC': 'I', 'AUA': 'I', 'AUG': 'M', // AUG is start codon
    'GUU': 'V', 'GUC': 'V', 'GUA': 'V', 'GUG': 'V',
    'UCU': 'S', 'UCC': 'S', 'UCA': 'S', 'UCG': 'S',
    'CCU': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
    'ACU': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
    'GCU': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
    'UAU': 'Y', 'UAC': 'Y', 'UAA': '*', 'UAG': '*', // UAA, UAG are stop codons
    'CAU': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'AAU': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
    'GAU': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
    'UGU': 'C', 'UGC': 'C', 'UGA': '*', 'UGG': 'W', // UGA is stop codon
    'CGU': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
    'AGU': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
    'GGU': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
};

// Combined genetic code for lookup
const GENETIC_CODE: Record<string, string> = {
    ...DNA_GENETIC_CODE,
    ...RNA_GENETIC_CODE
};

/**
 * Converts DNA sequence to RNA sequence
 * @param dnaSequence The DNA sequence to convert
 * @returns The RNA sequence
 */
export function dnaToRna(dnaSequence: string): string {
    return dnaSequence.toUpperCase().replace(/T/g, 'U');
}

/**
 * Translates a nucleotide sequence (DNA or RNA) to amino acid sequence
 * @param sequence The nucleotide sequence to translate
 * @param sequenceType The type of sequence (DNA or RNA)
 * @param readingFrame The reading frame (0, 1, or 2)
 * @returns The translated amino acid sequence
 */
export function translateSequence(
    sequence: string,
    sequenceType: 'DNA' | 'RNA',
    readingFrame: number = 0
): string {
    // Convert to uppercase and normalize
    let normalizedSeq = sequence.toUpperCase();

    // If DNA, convert to RNA for translation (U is used in the genetic code)
    if (sequenceType === 'DNA') {
        normalizedSeq = dnaToRna(normalizedSeq);
    }

    // Adjust for reading frame (0-based)
    normalizedSeq = normalizedSeq.slice(readingFrame);

    // Ensure the sequence length is a multiple of 3 for complete codons
    const remainder = normalizedSeq.length % 3;
    if (remainder > 0) {
        normalizedSeq = normalizedSeq.slice(0, normalizedSeq.length - remainder);
    }

    // Translate the sequence
    let protein = '';
    for (let i = 0; i < normalizedSeq.length; i += 3) {
        const codon = normalizedSeq.substring(i, i + 3);

        // If the codon is incomplete, don't translate it
        if (codon.length < 3) break;

        // Get the corresponding amino acid, or 'X' if unknown
        const aminoAcid = GENETIC_CODE[codon] || 'X';
        protein += aminoAcid;
    }

    return protein;
}

/**
 * Format a protein sequence for display with line breaks and position indicators
 * @param sequence The protein sequence to format
 * @param lineLength The number of amino acids per line
 * @returns The formatted protein sequence
 */
export function formatProteinSequence(sequence: string, lineLength: number = 60): string {
    let formatted = '';
    let position = 1;

    for (let i = 0; i < sequence.length; i += lineLength) {
        const line = sequence.slice(i, i + lineLength);
        formatted += `${position.toString().padStart(6)} ${line}\n`;
        position += line.length;
    }

    return formatted.trim();
}