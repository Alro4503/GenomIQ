import api from '../api';
import sequenceRequestManager from './sequenceRequestManager';

interface AISequenceResponse {
  sequence?: string;
  id?: string;
  source?: string;
  name?: string;
  type?: 'dna' | 'rna' | 'protein';
  organism?: string;
  inputId?: string; // Para rastrear a qué input pertenece esta respuesta
}

// Valid tool contexts type
type ToolContext = 'alignment' | 'annotation' | 'translation';

/**
 * Servicio para obtener secuencias biológicas mediante IA
 * Compatible con herramientas de alineamiento, anotación y traducción
 */
const aiSequenceService = {
  /**
   * Busca una secuencia biológica o identificador usando IA
   * @param query Texto de búsqueda (ej. "hemoglobina humana" o "P01308")
   * @param searchType Tipo de búsqueda: 'sequence' para secuencias o 'id' para identificadores/accesiones
   * @param inputId Identificador del input que solicitó esta secuencia
   * @param toolContext Contexto de la herramienta ('alignment', 'annotation' o 'translation')
   * @returns Promesa con la respuesta que contiene la secuencia y metadatos
   */
  async searchSequence(
    query: string, 
    searchType: 'sequence' | 'id' = 'sequence', 
    inputId?: string,
    toolContext: ToolContext = 'alignment'
  ): Promise<AISequenceResponse> {
    try {
      // Registrar que hay una solicitud en curso
      sequenceRequestManager.startRequest(toolContext);
      
      // Incluir el ID del input en el prompt para tener un registro en los logs
      const inputInfo = inputId ? `[ID:${inputId}] ` : '';
      
      // Construir un prompt específico según el tipo de búsqueda y contexto
      const prompt = this.buildPrompt(query, searchType, inputInfo, toolContext);

      // Llamar a la API de chat utilizando el endpoint efímero
      const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;
      const response = await api.post(`${API_URL}/chat/ephemeral`, {
        message: prompt,
        tool_context: toolContext
      });

      // Extraer la respuesta
      const assistantMessage = response.data.message;
      
      console.log(`Respuesta del asistente para ${inputInfo}:`, assistantMessage.substring(0, 100) + '...');
      
      // Procesar la respuesta para extraer el JSON
      const parsedResponse = this.extractJSONFromText(assistantMessage, searchType);
      
      if (parsedResponse) {
        console.log(`JSON extraído correctamente para ${inputInfo}:`, parsedResponse);
        // Añadir el ID del input a la respuesta para referencia
        return {
          ...parsedResponse,
          inputId
        };
      } else {
        console.error(`No se pudo extraer un JSON válido para ${inputInfo}, aplicando extracción fallback`);
        // Plan B: extraer solo la secuencia o ID como texto plano
        const fallbackResponse = this.extractFallbackData(assistantMessage, query, searchType);
        return {
          ...fallbackResponse,
          inputId
        };
      }
    } catch (error) {
      console.error(`Error en el servicio de secuencias IA para ${searchType}/${inputId}:`, error);
      throw error;
    } finally {
      // Independientemente del resultado, marcar que ya no hay solicitud activa
      sequenceRequestManager.endRequest(toolContext);
    }
  },
  
  /**
   * Construye el prompt adecuado según el tipo de búsqueda y contexto
   */
  buildPrompt(
    query: string, 
    searchType: 'sequence' | 'id', 
    inputInfo: string,
    toolContext: ToolContext
  ): string {
    if (searchType === 'id') {
      return `${inputInfo}Encuentra la secuencia biológica con este ID o número de acceso: "${query}".
      
      Devuelve ÚNICAMENTE un objeto JSON con el siguiente formato exacto:
       {
        "id": "ID o identificador de acceso",
        "name": "Nombre descriptivo de la secuencia",
        "sequence": "SECUENCIA_SIN_ESPACIOS_NI_NÚMEROS",
        "type": "dna, rna o protein",
        "organism": "Nombre del organismo (si aplica)",
        "source": "Fuente o base de datos de referencia"
      }
      
      No incluyas ningún otro texto además de este objeto JSON.
      `;
    } else {
      // Para búsqueda de secuencia - prompt específico según el contexto
      let contextPrompt = "";
      if (toolContext === 'annotation') {
        contextPrompt = "Asegúrate de proporcionar el ID si lo identificas, ya que se usará para anotación.";
      } else if (toolContext === 'translation') {
        contextPrompt = "La secuencia será utilizada para traducción. Preferentemente devuelve una secuencia de ADN o ARN.";
      } else {
        contextPrompt = "La secuencia será utilizada para alineamiento múltiple.";
      }
      
      return `${inputInfo}Identifica esta secuencia biológica: "${query}".
      ${contextPrompt}
      
      Devuelve ÚNICAMENTE un objeto JSON con el siguiente formato exacto:
       {
        "id": "ID o identificador de acceso si se encontró",
        "name": "Nombre descriptivo de la secuencia",
        "sequence": "SECUENCIA_LIMPIA_SOLO_LETRAS",
        "type": "dna, rna o protein",
        "organism": "Nombre del organismo si se identificó",
        "source": "Fuente o base de datos de referencia"
      }
      
      No incluyas ningún otro texto además de este objeto JSON.
      `;
    }
  },
  
  /**
   * Extrae JSON de la respuesta textual de la IA
   */
  extractJSONFromText(text: string, searchType: 'sequence' | 'id'): AISequenceResponse | null {
    try {
      // Paso 1: Limpiar el texto de entrada
      let cleanedText = text.trim();
      
      // Paso 2: Extraer JSON de bloques de código markdown si existen
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const codeBlockMatch = codeBlockRegex.exec(cleanedText);
      
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanedText = codeBlockMatch[1].trim();
        console.log('JSON extraído de bloque de código:', cleanedText);
      }
      
      // Paso 3: Intentar parsear directamente como JSON
      try {
        const parsedJson = JSON.parse(cleanedText);
        if (parsedJson && (parsedJson.sequence || parsedJson.id)) {
          return this.validateAndCleanData(parsedJson, searchType);
        }
      } catch (err) {
        console.warn('No se pudo parsear como JSON directamente, intentando métodos alternativos');
        // Continuar con otros métodos de extracción
      }
      
      // Paso 4: Buscar un objeto JSON válido utilizando una regex más robusta
      const jsonObjectRegex = /(\{[\s\S]*?\})/g;
      const matches = cleanedText.match(jsonObjectRegex);
      
      if (matches && matches.length > 0) {
        for (const match of matches) {
          try {
            const potentialJson = match.trim();
            const jsonObj = JSON.parse(potentialJson);
            if (jsonObj && (jsonObj.sequence || jsonObj.id)) {
              return this.validateAndCleanData(jsonObj, searchType);
            }
          } catch (e) {
            console.warn(`Error al parsear objeto JSON candidato: ${match.substring(0, 50)}...`);
            // Intentar con el siguiente match
          }
        }
      }
      
      // Paso 5: Buscar campos individuales con regex
      if (searchType === 'sequence') {
        const sequenceRegex = /"sequence"\s*:\s*"([A-Za-z\s]+)"/;
        const sequenceMatch = sequenceRegex.exec(cleanedText);
        
        if (sequenceMatch && sequenceMatch[1]) {
          const extractedSequence = sequenceMatch[1].replace(/\s+/g, '');
          
          if (extractedSequence.length >= 10) {
            // Extraer otros campos si es posible
            const idRegex = /"id"\s*:\s*"([^"]*)"/;
            const nameRegex = /"name"\s*:\s*"([^"]*)"/;
            const typeRegex = /"type"\s*:\s*"([^"]*)"/;
            const organismRegex = /"organism"\s*:\s*"([^"]*)"/;
            const sourceRegex = /"source"\s*:\s*"([^"]*)"/;
            
            const idMatch = idRegex.exec(cleanedText);
            const nameMatch = nameRegex.exec(cleanedText);
            const typeMatch = typeRegex.exec(cleanedText);
            const organismMatch = organismRegex.exec(cleanedText);
            const sourceMatch = sourceRegex.exec(cleanedText);
            
            return {
              sequence: extractedSequence.toUpperCase(),
              id: idMatch ? idMatch[1] : undefined,
              name: nameMatch ? nameMatch[1] : undefined,
              type: typeMatch ? typeMatch[1] as any : undefined,
              organism: organismMatch ? organismMatch[1] : undefined,
              source: sourceMatch ? sourceMatch[1] : undefined
            };
          }
        }
      } else if (searchType === 'id') {
        const idRegex = /"id"\s*:\s*"([^"]*)"/;
        const idMatch = idRegex.exec(cleanedText);
        
        if (idMatch && idMatch[1]) {
          // Extraer otros campos si es posible
          const sequenceRegex = /"sequence"\s*:\s*"([A-Za-z\s]+)"/;
          const nameRegex = /"name"\s*:\s*"([^"]*)"/;
          const typeRegex = /"type"\s*:\s*"([^"]*)"/;
          const organismRegex = /"organism"\s*:\s*"([^"]*)"/;
          const sourceRegex = /"source"\s*:\s*"([^"]*)"/;
          
          const sequenceMatch = sequenceRegex.exec(cleanedText);
          const nameMatch = nameRegex.exec(cleanedText);
          const typeMatch = typeRegex.exec(cleanedText);
          const organismMatch = organismRegex.exec(cleanedText);
          const sourceMatch = sourceRegex.exec(cleanedText);
          
          return {
            id: idMatch[1],
            sequence: sequenceMatch ? sequenceMatch[1].replace(/\s+/g, '').toUpperCase() : undefined,
            name: nameMatch ? nameMatch[1] : undefined,
            type: typeMatch ? typeMatch[1] as any : undefined,
            organism: organismMatch ? organismMatch[1] : undefined,
            source: sourceMatch ? sourceMatch[1] : undefined
          };
        }
      }
      
      // Si llegamos aquí, no se pudo extraer un JSON válido
      return null;
    } catch (error) {
      console.error('Error en extractJSONFromText:', error);
      return null;
    }
  },
  
  /**
   * Valida y limpia los datos extraídos
   */
  validateAndCleanData(jsonObj: any, searchType: 'sequence' | 'id'): AISequenceResponse {
    // Asegurarse de que la secuencia esté limpia (solo letras, sin espacios)
    if (jsonObj.sequence) {
      jsonObj.sequence = jsonObj.sequence.replace(/[^A-Za-z]/g, '').toUpperCase();
    }
    
    // Validación según tipo de búsqueda
    if (searchType === 'sequence') {
      // Para búsqueda de secuencia, validar longitud mínima
      if (!jsonObj.sequence || jsonObj.sequence.length < 10) {
        throw new Error('Secuencia inválida o demasiado corta');
      }
    } else {
      // Para búsqueda de ID, validar que hay un ID
      if (!jsonObj.id) {
        throw new Error('ID no proporcionado');
      }
    }
    
    return {
      sequence: jsonObj.sequence,
      id: jsonObj.id,
      name: jsonObj.name,
      type: jsonObj.type,
      organism: jsonObj.organism,
      source: jsonObj.source
    };
  },
  
  /**
   * Extrae datos cuando falla la extracción de JSON
   */
  extractFallbackData(text: string, query: string, searchType: 'sequence' | 'id'): AISequenceResponse {
    if (searchType === 'sequence') {
      // Extraer cualquier secuencia larga de letras (posible secuencia biológica)
      const letterSequences = text.match(/[A-Za-z]{10,}/g) || [];
      
      // Filtrar secuencias que parecen palabras comunes (menos de 15 caracteres)
      const longSequences = letterSequences.filter(seq => seq.length >= 15);
      
      if (longSequences.length > 0) {
        // Usar la secuencia más larga encontrada
        const sequence = longSequences.reduce((a, b) => a.length > b.length ? a : b);
        
        return {
          sequence: sequence.toUpperCase(),
          name: query
        };
      }
      
      throw new Error('No se pudo extraer ninguna secuencia válida');
    } else {
      // Para búsqueda de ID, intentar extraer un identificador de acceso
      // Buscar patrones comunes de IDs (UniProt, GenBank, etc.)
      const idPatterns = [
        /[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}/g, // UniProt
        /[A-Z]{1,2}_\d+(\.\d+)?/g, // GenBank/RefSeq
        /ENSG\d+/g, // Ensembl gene
        /ENSP\d+/g, // Ensembl protein
        /\w+\d+\.\d+/g // Genérico con números y puntos
      ];
      
      for (const pattern of idPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          return {
            id: matches[0],
            name: `ID encontrado para: ${query}`
          };
        }
      }
      
      // Si no se encontró nada más, devolver el query original como ID
      return {
        id: query,
        name: "Identificador no reconocido"
      };
    }
  }
};

export default aiSequenceService;