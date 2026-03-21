import api from '../api';
import { BlastResults, BlastProgram, BlastDatabase, BlastProgramInfo, BlastDatabaseInfo, BlastHit } from '@/types/blast';
import { useTranslation } from '@/context/TranslationProvider'; // No lo usaremos directamente aquí

// Extended interface for typed BLAST results 
interface ExtendedBlastResults extends BlastResults {
  program?: BlastProgram;
  database?: BlastDatabase;
}

// Interfaz para el resumen que utilizamos internamente
interface BlastSummaryData {
  hitCount: number;
  topHits: BlastHit[];
  programInfo: string;
  databaseInfo: string;
}

/**
 * Service for analyzing BLAST results using AI
 */
const blastAnalysisService = {
  /**
   * Analyzes BLAST results and generates a human-readable summary in the user's language
   * @param results The BLAST results to analyze
   * @param language Optional language code ('es' or 'en')
   * @returns A formatted analysis text
   */
  async analyzeBlastResults(results: BlastResults, language?: string): Promise<string> {
    try {
      // Extract necessary data from results for analysis
      const hitCount = results.summary?.hit_count || 0;
      const hits = results.summary?.hits || [];
      
      // If there are no hits, return a simple message
      if (hitCount === 0 || hits.length === 0) {
        // We'll still use the AI for the language handling
        return generateNoHitsMessage(language || 'en');
      }
      
      // Get top hits for analysis (limit to top 5)
      const topHits = hits.slice(0, 5);
      
      // Cast to extended interface for access to optional properties
      const extendedResults = results as ExtendedBlastResults;
      
      // Extract information about query parameters if available
      let programInfo = '';
      let databaseInfo = '';
      
      // Safely access program info using proper type checking
      if (extendedResults.program && 
          Object.prototype.hasOwnProperty.call(BlastProgramInfo, extendedResults.program)) {
        const program = extendedResults.program;
        programInfo = `${BlastProgramInfo[program].name} (${BlastProgramInfo[program].description})`;
      }
      
      // Safely access database info using proper type checking
      if (extendedResults.database && 
          Object.prototype.hasOwnProperty.call(BlastDatabaseInfo, extendedResults.database)) {
        const database = extendedResults.database;
        databaseInfo = `${BlastDatabaseInfo[database].name} (${BlastDatabaseInfo[database].description})`;
      }
      
      // Prepare data for AI analysis
      const blastSummary: BlastSummaryData = {
        hitCount,
        topHits,
        programInfo,
        databaseInfo
      };

      try {
        // Use ephemeral chat endpoint for AI analysis
        // Pass a timestamp to prevent caching issues
        const timestamp = new Date().getTime();
        const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;
        
        // Create a detailed prompt for the AI
        // Add language specification to the prompt
        const prompt = constructPrompt(blastSummary, language || 'en', timestamp);

        const response = await api.post(`${API_URL}/chat/ephemeral`, {
          message: prompt,
          tool_context: 'blast',
          timestamp // Add timestamp to prevent caching
        });
        
        if (response.data && response.data.message) {
          return response.data.message;
        }
        
        // Fallback to local analysis if AI service fails
        return generateLocalAnalysis(blastSummary, language || 'en');
        
      } catch (aiError) {
        console.error('AI analysis failed, using local analysis:', aiError);
        // Fallback to local analysis if AI service fails
        return generateLocalAnalysis(blastSummary, language || 'en');
      }
    } catch (error) {
      console.error('Error analyzing BLAST results:', error);
      throw new Error(language === 'es' 
        ? 'Error al analizar los resultados de BLAST' 
        : 'Failed to analyze BLAST results');
    }
  }
};

/**
 * Construct prompt based on language
 */
function constructPrompt(blastSummary: BlastSummaryData, language: string, timestamp: number): string {
  const { hitCount, topHits, programInfo, databaseInfo } = blastSummary;
  
  const commonPrompt = `
Details:
- Hit count: ${hitCount}
- Program: ${programInfo || 'Not specified'}
- Database: ${databaseInfo || 'Not specified'}
- Timestamp: ${timestamp}

Top hits:
${topHits.map((hit, i) => 
  `${i+1}. "${hit.title}" (E-value: ${hit.evalue || 'N/A'}, Bit score: ${hit.bit_score || 'N/A'}, Identity: ${hit.identity || 'N/A'})`
).join('\n')}
`;

  if (language === 'es') {
    return `
Como experto en bioinformática, analiza este resultado de búsqueda BLAST:

${commonPrompt}

Por favor, proporciona:
1. El significado general de estas coincidencias
2. Interpretación de los valores E y niveles de confianza
3. Implicaciones funcionales de las coincidencias encontradas
4. Recomendaciones para análisis adicionales

Haz tu análisis detallado, informativo y científicamente preciso. IMPORTANTE: Responde completamente en español.
`;
  } else {
    return `
As a bioinformatics expert, analyze this BLAST search result:

${commonPrompt}

Please provide:
1. Overall significance of these matches
2. Interpretation of the E-values and confidence levels
3. Functional implications of the matches
4. Recommendations for further analysis

Make your analysis detailed, informative, and scientifically accurate. IMPORTANT: Respond completely in English.
`;
  }
}

/**
 * Generate a message for when no hits are found
 */
function generateNoHitsMessage(language: string): string {
  if (language === 'es') {
    return "No se encontraron coincidencias de secuencias en la base de datos. Esto podría indicar que la secuencia consultada es novel o significativamente diferente de las secuencias conocidas en la base de datos seleccionada.";
  } else {
    return "No sequence matches were found in the database. This could indicate that the query sequence is novel or significantly different from known sequences in the selected database.";
  }
}

/**
 * Generate a local analysis without relying on AI service
 * Used as fallback when AI service is unavailable
 */
function generateLocalAnalysis(blastSummary: BlastSummaryData, language: string): string {
  const { hitCount, topHits, programInfo, databaseInfo } = blastSummary;
  
  // Generate analysis based on the hits
  let analysis = "";
  
  if (language === 'es') {
    analysis = `Se encontraron ${hitCount} coincidencias de secuencia. `;
    
    // Añadir información sobre los parámetros de búsqueda si está disponible
    if (programInfo) {
      analysis += `Búsqueda realizada utilizando ${programInfo}. `;
    }
    
    if (databaseInfo) {
      analysis += `Base de datos consultada: ${databaseInfo}. `;
    }
    
    // Añadir información sobre el mejor resultado
    if (topHits.length > 0) {
      const topHit = topHits[0];
      analysis += `La mejor coincidencia es "${topHit.title}" con un valor E de ${topHit.evalue || 'N/A'} y una puntuación bit de ${topHit.bit_score || 'N/A'}. `;
      
      if (topHit.identity) {
        analysis += `Esta coincidencia muestra ${topHit.identity} de identidad de secuencia. `;
      }
    }
    
    // Añadir resumen de los demás resultados principales
    if (topHits.length > 1) {
      analysis += `Otras coincidencias significativas incluyen: `;
      topHits.slice(1).forEach((hit, index) => {
        if (index > 0) analysis += "; ";
        analysis += `"${hit.title}" (valor E: ${hit.evalue || 'N/A'})`;
      });
      analysis += ". ";
    }
  } else {
    analysis = `Found ${hitCount} sequence matches. `;
    
    // Add information about search parameters if available
    if (programInfo) {
      analysis += `Search performed using ${programInfo}. `;
    }
    
    if (databaseInfo) {
      analysis += `Database searched: ${databaseInfo}. `;
    }
    
    // Add information about the top hit
    if (topHits.length > 0) {
      const topHit = topHits[0];
      analysis += `The best match is "${topHit.title}" with an E-value of ${topHit.evalue || 'N/A'} and a bit score of ${topHit.bit_score || 'N/A'}. `;
      
      if (topHit.identity) {
        analysis += `This match shows ${topHit.identity} sequence identity. `;
      }
    }
    
    // Add summary of remaining top hits
    if (topHits.length > 1) {
      analysis += `Other significant matches include: `;
      topHits.slice(1).forEach((hit, index) => {
        if (index > 0) analysis += "; ";
        analysis += `"${hit.title}" (E-value: ${hit.evalue || 'N/A'})`;
      });
      analysis += ". ";
    }
  }
  
  // Add interpretation based on E-values
  const lowestEvalue = topHits.length > 0 && topHits[0].evalue ? parseFloat(topHits[0].evalue) : 1;
  
  if (language === 'es') {
    if (lowestEvalue < 1e-50) {
      analysis += "El valor E extremadamente bajo del principal resultado sugiere una coincidencia con muy alta confianza, lo que probablemente indica que las secuencias son idénticas o casi idénticas. ";
    } else if (lowestEvalue < 1e-10) {
      analysis += "El bajo valor E indica una coincidencia fuerte con alta confianza. Esto sugiere una similitud de secuencia significativa y una posible relación funcional. ";
    } else if (lowestEvalue < 1e-5) {
      analysis += "El valor E indica una buena coincidencia, lo que sugiere una posible homología entre las secuencias. Se recomienda una investigación adicional para confirmar las relaciones funcionales. ";
    } else if (lowestEvalue < 0.01) {
      analysis += "El valor E moderado sugiere una posible homología, pero con menor confianza. Se necesitaría evidencia adicional para confirmar relaciones funcionales. ";
    } else {
      analysis += "Los valores E relativamente altos indican coincidencias más débiles, que pueden representar relaciones distantes o similitudes por azar. La interpretación debe hacerse con cautela. ";
    }
    
    // Añadir conclusión y próximos pasos
    analysis += "Para una interpretación completa, considere examinar los alineamientos en detalle, verificar la cobertura de secuencia y revisar el contexto biológico de las secuencias coincidentes.";
  } else {
    if (lowestEvalue < 1e-50) {
      analysis += "The extremely low E-value of the top hit suggests a very high confidence match, likely indicating the sequences are identical or nearly identical. ";
    } else if (lowestEvalue < 1e-10) {
      analysis += "The low E-value indicates a strong match with high confidence. This suggests significant sequence similarity and potential functional relationship. ";
    } else if (lowestEvalue < 1e-5) {
      analysis += "The E-value indicates a good match, suggesting potential homology between the sequences. Further investigation may be warranted to confirm functional relationships. ";
    } else if (lowestEvalue < 0.01) {
      analysis += "The moderate E-value suggests possible homology, but with lower confidence. Additional evidence would be needed to confirm functional relationships. ";
    } else {
      analysis += "The relatively high E-values indicate weaker matches, which may represent distant relationships or chance similarities. Interpretation should be done with caution. ";
    }
    
    // Add conclusion and next steps
    analysis += "For comprehensive interpretation, consider examining the alignments in detail, checking sequence coverage, and reviewing the biological context of the matched sequences.";
  }
  
  // Generate random-like ID to make each analysis appear unique
  const uniqueId = Math.floor(Math.random() * 1000000);
  analysis += language === 'es' 
    ? ` [ID de análisis: ${uniqueId}]` 
    : ` [Analysis ID: ${uniqueId}]`;
  
  return analysis;
}

export default blastAnalysisService;