import api from '../api';
import { AlignmentResult } from '@/types/alignment';

/**
 * Service for analyzing alignment results using AI
 */
const alignmentAnalysisService = {
  /**
   * Analyze an alignment result using AI, respecting user's language preference
   * @param alignmentResult The alignment result to analyze
   * @param language Optional language code ('es' or 'en')
   * @returns Promise with the analysis text
   */
  async analyzeAlignment(alignmentResult: AlignmentResult, language?: string): Promise<string> {
    try {
      // Generate a summary of the alignment data
      const sequenceCount = alignmentResult.alignedSequences.length;
      const sequenceNames = alignmentResult.alignedSequences.map(seq => seq.name).join(', ');
      const alignmentLength = alignmentResult.alignedSequences[0]?.content.length || 0;
      
      // Prepare the prompt for the AI based on language
      const prompt = constructPrompt(
        alignmentResult, 
        language || 'en'
      );

      // Call the AI service using the ephemeral chat endpoint
      const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;
      const response = await api.post(`${API_URL}/chat/ephemeral`, {
        message: prompt,
        tool_context: 'alignment'
      });
      
      if (!response.data || !response.data.message) {
        return generateFallbackAnalysis(alignmentResult, language || 'en');
      }
      
      return response.data.message;
    } catch (error) {
      console.error('Error analyzing alignment:', error);
      return language === 'es' 
        ? 'No se pudo analizar el alineamiento. Por favor, inténtalo de nuevo más tarde.' 
        : 'Failed to analyze alignment. Please try again later.';
    }
  }
};

/**
 * Construct the appropriate prompt based on language
 */
function constructPrompt(alignmentResult: AlignmentResult, language: string): string {
  const sequenceCount = alignmentResult.alignedSequences.length;
  const sequenceNames = alignmentResult.alignedSequences.map(seq => seq.name).join(', ');
  const alignmentLength = alignmentResult.alignedSequences[0]?.content.length || 0;
  
  const commonDetails = `
Details:
- Method: ${alignmentResult.method}
- Sequences: ${sequenceCount} (${sequenceNames})
- Alignment length: ${alignmentLength} 
- Alignment score: ${alignmentResult.alignmentScore}%
- Conserved regions: ${alignmentResult.conservedRegions.length}
`;

  if (language === 'es') {
    return `
Como experto en bioinformática, analiza este alineamiento múltiple de secuencias:

${commonDetails}

Por favor, proporciona:
1. Significancia biológica de este alineamiento
2. Patrones clave y motivos identificados
3. Implicaciones funcionales de las regiones conservadas
4. Perspectivas evolutivas del alineamiento
5. Recomendaciones para análisis adicionales

Haz tu análisis conciso, informativo y científicamente preciso. IMPORTANTE: Responde completamente en español.
`;
  } else {
    return `
As a bioinformatics expert, analyze this multiple sequence alignment:

${commonDetails}

Please provide:
1. Biological significance of this alignment
2. Key patterns and motifs identified
3. Functional implications of conserved regions
4. Evolutionary insights from the alignment
5. Recommendations for further analysis

Make your analysis concise, informative, and scientifically accurate. IMPORTANT: Respond completely in English.
`;
  }
}

/**
 * Generate a fallback analysis if the AI service fails
 */
function generateFallbackAnalysis(alignmentResult: AlignmentResult, language: string): string {
  const sequenceCount = alignmentResult.alignedSequences.length;
  const conservedCount = alignmentResult.conservedRegions.length;
  const alignmentScore = alignmentResult.alignmentScore;
  
  if (language === 'es') {
    let analysis = `Análisis del alineamiento múltiple de ${sequenceCount} secuencias:\n\n`;
    
    analysis += `El alineamiento muestra una puntuación global de ${alignmentScore}%, `;
    
    if (alignmentScore > 80) {
      analysis += "lo que indica un alto grado de conservación entre las secuencias analizadas. ";
    } else if (alignmentScore > 50) {
      analysis += "lo que sugiere un nivel moderado de conservación entre las secuencias. ";
    } else {
      analysis += "lo que sugiere una divergencia significativa entre las secuencias. ";
    }
    
    analysis += `\n\nSe identificaron ${conservedCount} regiones conservadas, `;
    
    if (conservedCount > 5) {
      analysis += "lo que podría indicar la presencia de dominios funcionales importantes mantenidos a través de la evolución. ";
    } else if (conservedCount > 0) {
      analysis += "que podrían corresponder a sitios funcionales específicos. ";
    } else {
      analysis += "lo que sugiere una alta variabilidad entre las secuencias comparadas. ";
    }
    
    analysis += "\n\nRecomendaciones para análisis adicionales:\n";
    analysis += "- Considerar un análisis filogenético para entender las relaciones evolutivas\n";
    analysis += "- Examinar las regiones conservadas para identificar posibles motivos funcionales\n";
    analysis += "- Correlacionar la conservación de residuos con información estructural, si está disponible";
    
    return analysis;
  } else {
    let analysis = `Analysis of multiple alignment of ${sequenceCount} sequences:\n\n`;
    
    analysis += `The alignment shows an overall score of ${alignmentScore}%, `;
    
    if (alignmentScore > 80) {
      analysis += "indicating a high degree of conservation among the analyzed sequences. ";
    } else if (alignmentScore > 50) {
      analysis += "suggesting a moderate level of conservation among the sequences. ";
    } else {
      analysis += "suggesting significant divergence among the sequences. ";
    }
    
    analysis += `\n\n${conservedCount} conserved regions were identified, `;
    
    if (conservedCount > 5) {
      analysis += "which might indicate the presence of important functional domains maintained through evolution. ";
    } else if (conservedCount > 0) {
      analysis += "which could correspond to specific functional sites. ";
    } else {
      analysis += "suggesting high variability among the compared sequences. ";
    }
    
    analysis += "\n\nRecommendations for further analysis:\n";
    analysis += "- Consider phylogenetic analysis to understand evolutionary relationships\n";
    analysis += "- Examine conserved regions to identify possible functional motifs\n";
    analysis += "- Correlate residue conservation with structural information, if available";
    
    return analysis;
  }
}

export default alignmentAnalysisService;