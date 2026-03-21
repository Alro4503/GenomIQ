import { Sequence, AlignmentParams } from '@/types/alignment';

// Define una interfaz para Aioli (nuevo sistema de Biowasm)
interface Aioli {
  mount: (options: { name: string, data: string }) => Promise<void>;
  exec: (command: string) => Promise<string>;
  cat: (filename: string) => Promise<string>;
}

// Cache para las instancias de Aioli ya cargadas
const aioliCache: Record<string, Promise<Aioli>> = {};

/**
 * Carga un módulo Biowasm a través del sistema Aioli
 */
async function loadAioliModule(toolName: string, version: string, extraModules: any[] = [], forceRefresh: boolean = false): Promise<Aioli> {
  const cacheKey = `${toolName}-${version}`;

  // Si forzamos refrescar o no existe en caché, crea una nueva instancia
  if (forceRefresh || !aioliCache[cacheKey]) {
    aioliCache[cacheKey] = new Promise((resolve, reject) => {
      try {
        // Solo ejecutar en el navegador
        if (typeof window === 'undefined') {
          reject(new Error('Cannot load module in server-side context'));
          return;
        }

        // Cargar el script Aioli si no está ya cargado
        if (!(window as any).Aioli) {
          const aioliScript = document.createElement('script');
          // Asumimos que aioli.js está en /public/biowasm/
          aioliScript.src = '/biowasm/aioli.js';
          aioliScript.async = true;

          aioliScript.onload = async () => {
            try {
              // Crear la configuración de módulos
              const modules = [...extraModules];

              // Añadir el módulo principal
              if (toolName === 'mafft') {
                // Para MAFFT necesitamos ambos programas: tbfast y dvtditr
                modules.push(
                  { tool: "mafft", version: version, program: "tbfast", reinit: forceRefresh },
                  { tool: "mafft", version: version, program: "dvtditr", reinit: forceRefresh }
                );
              } else {
                // Para otros módulos es más sencillo
                modules.push(`${toolName}/${version}`);
              }

              // Inicializar Aioli con los módulos
              const aioli = await new (window as any).Aioli(modules, { debug: false });

              resolve(aioli);
            } catch (err) {
              reject(new Error(`Failed to initialize ${toolName} module: ${err}`));
            }
          };

          aioliScript.onerror = () => {
            reject(new Error(`Failed to load Aioli script`));
          };

          document.body.appendChild(aioliScript);
        } else {
          // Si Aioli ya está cargado, inicializar directamente
          const modules = [...extraModules];

          if (toolName === 'mafft') {
            modules.push(
              { tool: "mafft", version: version, program: "tbfast", reinit: forceRefresh },
              { tool: "mafft", version: version, program: "dvtditr", reinit: forceRefresh }
            );
          } else {
            modules.push(`${toolName}/${version}`);
          }

          new (window as any).Aioli(modules, { debug: false })
            .then((aioli: Aioli) => resolve(aioli))
            .catch((err: any) => reject(new Error(`Failed to initialize ${toolName} module: ${err}`)));
        }
      } catch (error) {
        console.error(`Failed to load ${toolName} module:`, error);
        reject(error);
      }
    });
  }

  return aioliCache[cacheKey];
}



/**
 * Convierte secuencias a formato FASTA
 */
function convertToFasta(sequences: Sequence[]): string {
  return sequences.map(seq => `>${seq.name}\n${seq.content}`).join('\n');
}

/**
 * Analiza un string en formato FASTA y lo convierte a array de Sequence
 */
function parseFasta(fasta: string, originalSequences: Sequence[]): Sequence[] {
  const lines = fasta.split('\n');
  const sequences: Sequence[] = [];

  let currentName = '';
  let currentContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('>')) {
      // Guardar secuencia previa si existe
      if (currentName && currentContent) {
        // Buscar secuencia original para preservar ID
        const originalSeq = originalSequences.find(s => s.name === currentName);
        const id = originalSeq ? originalSeq.id : String(sequences.length + 1);

        sequences.push({
          id,
          name: currentName,
          content: currentContent
        });
      }

      // Iniciar nueva secuencia
      currentName = line.substring(1).trim();
      currentContent = '';
    } else if (line) {
      // Añadir a contenido de secuencia actual
      currentContent += line;
    }
  }

  // Añadir la última secuencia
  if (currentName && currentContent) {
    const originalSeq = originalSequences.find(s => s.name === currentName);
    const id = originalSeq ? originalSeq.id : String(sequences.length + 1);

    sequences.push({
      id,
      name: currentName,
      content: currentContent
    });
  }

  return sequences;
}

/**
 * Realiza un alineamiento MAFFT usando Aioli
 */
export const performMafftAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  try {
    // Agregar un flag para forzar el refresco de MAFFT (especialmente importante en la segunda ejecución)
    const forceRefresh = true;

    // Cargar MAFFT con módulos adicionales necesarios
    const mafft = await loadAioliModule('mafft', '7.520', [
      "coreutils/echo/8.32",
      "coreutils/ls/8.32",
      "coreutils/cat/8.32"
    ], forceRefresh);

    // Limpiar archivos anteriores que podrían causar conflictos
    try {
      await mafft.exec("rm -f /shared/data/pre");
      await mafft.exec("rm -f /shared/data/input.fa");
    } catch (err) {
      // Ignorar errores si los archivos no existen
      console.log("Limpiando archivos anteriores (ignorar errores si no existen):", err);
    }

    // Convertir secuencias a FASTA y montar el archivo
    const fastaContent = convertToFasta(sequences);
    await mafft.mount({
      name: 'input.fa',
      data: fastaContent
    });

    // Construir argumentos de línea de comandos para tbfast
    let tbfastArgs = "tbfast _ -u 0.0 -l 2.7 -C 0 -b 62 -g 0.0 -f -2.00 -Q 100.0 -h 0.0 -O -6.00 -E -0.000 -N -Z _ -+ 16 -W 0.00001 -V -1.53 -s 0.0 -O -C 0 -b 62 -f -1.53 -Q 100.0 -h 0.000 -l 2.7 -X 0.1 -i input.fa";

    // Modificar parámetros según la configuración
    if (params.gapOpenPenalty) {
      // Actualizar el valor de gap open penalty
      tbfastArgs = tbfastArgs.replace(/-O -6.00/, `-O -${params.gapOpenPenalty}`);
    }

    if (params.gapExtensionPenalty) {
      // Actualizar el valor de gap extension penalty
      tbfastArgs = tbfastArgs.replace(/-E -0.000/, `-E -${params.gapExtensionPenalty}`);
    }

    console.log("Ejecutando MAFFT paso 1 (tbfast)...");
    // Ejecutar tbfast (primer paso de MAFFT)
    await mafft.exec(tbfastArgs);

    console.log("Ejecutando MAFFT paso 2 (dvtditr)...");
    // Ejecutar dvtditr (segundo paso de MAFFT)
    await mafft.exec("dvtditr -W 0.00001 -E 0.0 -s 0.0 -C 0 -t 0 -F -l 2.7 -z 50 -b 62 -f -1.53 -Q 100.0 -h 0.000 -I 16 -X 0.1 -p BAATARI2 -K 0 -i /shared/data/pre");

    console.log("Leyendo resultados...");
    // Leer el archivo de resultado
    const alignedFasta = await mafft.exec("cat /shared/data/pre");

    // Limpiar archivos después del uso para evitar problemas en futuras ejecuciones
    try {
      await mafft.exec("rm -f /shared/data/pre");
      await mafft.exec("rm -f /shared/data/input.fa");
    } catch (err) {
      console.log("Error al limpiar archivos (no crítico):", err);
    }

    // Si no hay resultados, algo salió mal
    if (!alignedFasta || alignedFasta.trim() === '') {
      throw new Error('MAFFT no generó resultados. Verifica las secuencias de entrada.');
    }

    console.log("Parsing FASTA...");
    // Analizar FASTA alineado y convertir a objetos Sequence
    return parseFasta(alignedFasta, sequences);
  } catch (error) {
    console.error('MAFFT alignment failed:', error);
    throw new Error(`MAFFT alignment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Realiza un alineamiento MUSCLE usando Aioli
 */
export const performMuscleAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  try {
    // Cargar el módulo MUSCLE
    const muscle = await loadAioliModule('muscle', '5.1.0');

    // Convertir secuencias a FASTA y montar el archivo
    const fastaContent = convertToFasta(sequences);
    await muscle.mount({
      name: 'input.fa',
      data: fastaContent
    });

    // Ejecutar MUSCLE 
    // MUSCLE 5.1.0 no soporta directamente modificaciones de gap penalties vía línea de comandos
    await muscle.exec("muscle -align input.fa -output out.msa.muscle.fasta");

    // Leer el archivo de resultado
    const alignedFasta = await muscle.cat("out.msa.muscle.fasta");

    // Analizar FASTA alineado y convertir a objetos Sequence
    return parseFasta(alignedFasta, sequences);
  } catch (error) {
    console.error('MUSCLE alignment failed:', error);
    throw new Error(`MUSCLE alignment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Realiza un alineamiento Clustal usando Kalign (como sustituto de ClustalW)
 */
export const performClustalAlignment = async (
  sequences: Sequence[],
  params: AlignmentParams
): Promise<Sequence[]> => {
  try {
    // Cargar el módulo Kalign
    const kalign = await loadAioliModule('kalign', '3.3.1');

    // Convertir secuencias a FASTA y montar el archivo
    const fastaContent = convertToFasta(sequences);
    await kalign.mount({
      name: 'input.fa',
      data: fastaContent
    });

    // Construir argumentos de línea de comandos para Kalign
    let kalignArgs = "kalign input.fa -f fasta -o result.fasta";

    // Añadir parámetros basados en la configuración
    if (params.gapOpenPenalty) {
      kalignArgs += ` -gpo ${params.gapOpenPenalty}`;
    }

    if (params.gapExtensionPenalty) {
      kalignArgs += ` -gpe ${params.gapExtensionPenalty}`;
    }

    // Ejecutar Kalign
    await kalign.exec(kalignArgs);

    // Leer el archivo de resultado
    const alignedFasta = await kalign.cat("result.fasta");

    // Analizar FASTA alineado y convertir a objetos Sequence
    return parseFasta(alignedFasta, sequences);
  } catch (error) {
    console.error('Clustal alignment failed:', error);
    throw new Error(`Clustal alignment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Genera una secuencia consenso a partir de secuencias alineadas
 */
export const generateConsensusSequence = (alignedSequences: Sequence[]): string => {
  if (alignedSequences.length === 0 || alignedSequences[0].content.length === 0) {
    return '';
  }

  const seqLength = alignedSequences[0].content.length;
  let consensusSeq = '';

  // Para cada posición en el alineamiento
  for (let i = 0; i < seqLength; i++) {
    const charCounts: Record<string, number> = {};
    let maxChar = '';
    let maxCount = 0;

    // Contar ocurrencias de cada carácter en esta posición
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

    // Usar el carácter más común para el consenso
    consensusSeq += maxChar;
  }

  return consensusSeq;
};

/**
 * Genera un árbol filogenético en formato Newick a partir de secuencias alineadas
 */
export const generateNewickTree = async (alignedSequences: Sequence[]): Promise<string> => {
  try {
    // Implementación simple para generar un árbol en formato Newick
    // basado en las distancias entre las secuencias alineadas

    // Calcular matriz de distancias
    const distanceMatrix = calculateDistanceMatrix(alignedSequences);

    // Usar UPGMA para generar un árbol (simplificado)
    const newickTree = generateUPGMATree(distanceMatrix, alignedSequences);

    return newickTree;
  } catch (error) {
    console.error('Error generating Newick tree:', error);
    // Proporcionar un árbol básico en caso de error
    return generateSimpleNewickTree(alignedSequences);
  }
};

/**
 * Verifica si WebAssembly es soportado en el navegador
 */
export const checkWebAssemblySupport = (): boolean => {
  try {
    if (typeof WebAssembly === 'undefined') {
      return false;
    }

    // Verificar si se puede instanciar un módulo WebAssembly
    const module = new WebAssembly.Module(new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
    ]));

    return module instanceof WebAssembly.Module;
  } catch (e) {
    return false;
  }
};

// ------ Funciones auxiliares para generación de árboles filogenéticos ------

/**
 * Calcula una matriz de distancia entre secuencias
 */
const calculateDistanceMatrix = (sequences: Sequence[]): number[][] => {
  const numSeqs = sequences.length;
  const distMatrix: number[][] = Array(numSeqs).fill(0).map(() => Array(numSeqs).fill(0));

  for (let i = 0; i < numSeqs; i++) {
    for (let j = i + 1; j < numSeqs; j++) {
      // Calcular distancia de Hamming
      const distance = calculateHammingDistance(sequences[i].content, sequences[j].content);
      distMatrix[i][j] = distance;
      distMatrix[j][i] = distance; // La matriz es simétrica
    }
  }

  return distMatrix;
};

/**
 * Calcula la distancia de Hamming entre dos secuencias
 */
const calculateHammingDistance = (seq1: string, seq2: string): number => {
  const maxLength = Math.max(seq1.length, seq2.length);
  let distance = 0;

  for (let i = 0; i < maxLength; i++) {
    if (i >= seq1.length || i >= seq2.length || seq1[i] !== seq2[i]) {
      distance++;
    }
  }

  return distance / maxLength; // Normalizar
};

/**
 * Genera un árbol UPGMA en formato Newick
 */
const generateUPGMATree = (
  distanceMatrix: number[][],
  sequences: Sequence[]
): string => {
  // Implementación simplificada de UPGMA
  const names = sequences.map(seq => seq.name);

  if (names.length <= 1) {
    return names[0] || '';
  }

  if (names.length === 2) {
    const distance = distanceMatrix[0][1];
    return `(${names[0]}:${distance / 2},${names[1]}:${distance / 2});`;
  }

  // Para árboles más grandes, implementar un agrupamiento simplificado
  // Esta es una implementación muy básica - un UPGMA real sería más complejo

  // Crear una copia de la matriz que podemos modificar
  let matrix = distanceMatrix.map(row => [...row]);
  let clusters: any[] = names.map(name => ({ name, height: 0, children: [] }));

  while (clusters.length > 1) {
    // Encontrar la distancia mínima en la matriz
    let minI = 0, minJ = 1;
    let minDist = matrix[0][1];

    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        if (matrix[i][j] < minDist) {
          minDist = matrix[i][j];
          minI = i;
          minJ = j;
        }
      }
    }

    // Crear nuevo nodo
    const height = minDist / 2;
    const newNode = {
      name: `(${clusters[minI].name}:${height - clusters[minI].height},${clusters[minJ].name}:${height - clusters[minJ].height})`,
      height,
      children: [clusters[minI], clusters[minJ]]
    };

    // Actualizar matriz de distancia
    const newMatrix: number[][] = [];
    for (let i = 0; i < matrix.length; i++) {
      if (i === minI || i === minJ) continue;

      const newRow: number[] = [];
      for (let j = 0; j < matrix.length; j++) {
        if (j === minI || j === minJ) continue;
        newRow.push(matrix[i][j]);
      }

      // Añadir distancia al nuevo cluster (promedio de distancias a los clusters fusionados)
      const newDist = (matrix[i][minI] + matrix[i][minJ]) / 2;
      newRow.push(newDist);
      newMatrix.push(newRow);
    }

    // Añadir fila para el nuevo cluster
    const newClusterRow: number[] = [];
    for (let i = 0; i < newMatrix.length; i++) {
      newClusterRow.push(newMatrix[i][newMatrix[i].length - 1]);
    }
    newClusterRow.push(0);
    newMatrix.push(newClusterRow);

    // Actualizar clusters y matriz
    const newClusters = clusters.filter((_, i) => i !== minI && i !== minJ);
    newClusters.push(newNode);

    clusters = newClusters;
    matrix = newMatrix;
  }

  return `${clusters[0].name};`;
};

/**
 * Genera un árbol Newick simple cuando el método principal falla
 */
const generateSimpleNewickTree = (sequences: Sequence[]): string => {
  // Genera un árbol balanceado simple
  const names = sequences.map(seq => seq.name);

  if (names.length <= 1) {
    return names[0] || '';
  }

  if (names.length === 2) {
    return `(${names[0]}:0.1,${names[1]}:0.1);`;
  }

  // Dividir secuencias en dos grupos aproximadamente iguales
  const midpoint = Math.floor(names.length / 2);
  const leftGroup = names.slice(0, midpoint);
  const rightGroup = names.slice(midpoint);

  // Construir ramas izquierda y derecha recursivamente
  const leftBranch = leftGroup.length === 1
    ? leftGroup[0]
    : `(${leftGroup.join(':0.05,') + ':0.05'})`;

  const rightBranch = rightGroup.length === 1
    ? rightGroup[0]
    : `(${rightGroup.join(':0.05,') + ':0.05'})`;

  return `(${leftBranch}:0.1,${rightBranch}:0.1);`;
};