import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import { BlastHit } from '@/types/blast';

interface AlignmentViewProps {
  xmlContent: string | undefined;
  selectedHitId?: string;
}

interface Alignment {
  query: string;
  midline: string;
  hit: string;
  queryFrom: number;
  queryTo: number;
  hitFrom: number;
  hitTo: number;
  identity: number;
  alignLength: number;
  hitId: string;
  hitDef: string;
}

const AlignmentView = ({ xmlContent, selectedHitId }: AlignmentViewProps) => {
  const { t } = useTranslation();
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extraer alineamientos desde el XML cuando cambia
  useEffect(() => {
    if (!xmlContent) {
      setAlignments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const extractedAlignments = extractAlignmentsFromXml(xmlContent, selectedHitId);
      setAlignments(extractedAlignments);
    } catch (err: any) {
      console.error('Error al extraer alineamientos:', err);
      setError(err.message || 'Error al procesar los alineamientos');
    } finally {
      setLoading(false);
    }
  }, [xmlContent, selectedHitId]);

  // Extraer alineamientos del XML usando regex (alternativa a XML parser)
  const extractAlignmentsFromXml = (xml: string, hitIdFilter?: string): Alignment[] => {
    const results: Alignment[] = [];
    
    // Buscar todos los hits
    const hitRegex = /<Hit>([\s\S]*?)<\/Hit>/g;
    let hitMatch;
    
    while ((hitMatch = hitRegex.exec(xml)) !== null) {
      const hitContent = hitMatch[1];
      
      // Extraer ID y definición del hit
      const hitIdMatch = /<Hit_id>(.*?)<\/Hit_id>/i.exec(hitContent);
      const hitDefMatch = /<Hit_def>(.*?)<\/Hit_def>/i.exec(hitContent);
      
      if (!hitIdMatch || !hitDefMatch) continue;
      
      const hitId = hitIdMatch[1];
      const hitDef = hitDefMatch[1];
      
      // Si hay un filtro de ID y no coincide, saltar este hit
      if (hitIdFilter && hitId !== hitIdFilter) continue;
      
      // Buscar HSPs en este hit
      const hspRegex = /<Hsp>([\s\S]*?)<\/Hsp>/g;
      let hspMatch;
      
      while ((hspMatch = hspRegex.exec(hitContent)) !== null) {
        const hspContent = hspMatch[1];
        
        // Extraer datos del HSP
        const queryFromMatch = /<Hsp_query-from>(.*?)<\/Hsp_query-from>/i.exec(hspContent);
        const queryToMatch = /<Hsp_query-to>(.*?)<\/Hsp_query-to>/i.exec(hspContent);
        const hitFromMatch = /<Hsp_hit-from>(.*?)<\/Hsp_hit-from>/i.exec(hspContent);
        const hitToMatch = /<Hsp_hit-to>(.*?)<\/Hsp_hit-to>/i.exec(hspContent);
        const identityMatch = /<Hsp_identity>(.*?)<\/Hsp_identity>/i.exec(hspContent);
        const alignLenMatch = /<Hsp_align-len>(.*?)<\/Hsp_align-len>/i.exec(hspContent);
        const qseqMatch = /<Hsp_qseq>(.*?)<\/Hsp_qseq>/i.exec(hspContent);
        const hseqMatch = /<Hsp_hseq>(.*?)<\/Hsp_hseq>/i.exec(hspContent);
        const midlineMatch = /<Hsp_midline>(.*?)<\/Hsp_midline>/i.exec(hspContent);
        
        if (!queryFromMatch || !queryToMatch || !hitFromMatch || !hitToMatch || 
            !identityMatch || !alignLenMatch || !qseqMatch || !hseqMatch || !midlineMatch) {
          continue;
        }
        
        results.push({
          hitId,
          hitDef,
          queryFrom: parseInt(queryFromMatch[1], 10),
          queryTo: parseInt(queryToMatch[1], 10),
          hitFrom: parseInt(hitFromMatch[1], 10),
          hitTo: parseInt(hitToMatch[1], 10),
          identity: parseInt(identityMatch[1], 10),
          alignLength: parseInt(alignLenMatch[1], 10),
          query: qseqMatch[1],
          hit: hseqMatch[1],
          midline: midlineMatch[1]
        });
      }
    }
    
    return results;
  };

  // Renderizar alineamientos con formato
  const renderAlignments = () => {
    if (loading) {
      return (
        <div className="text-center p-4">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-solid border-purple-500 border-r-transparent mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('blast.loadingAlignments')}
          </p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center p-4 text-red-500">
          <p>{error}</p>
        </div>
      );
    }
    
    if (alignments.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500 dark:text-gray-400">
          {selectedHitId 
            ? t('blast.noAlignmentsForHit') 
            : t('blast.noAlignmentsFound')}
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        {alignments.map((alignment, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="mb-3">
              <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                {alignment.hitDef}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ID: {alignment.hitId}
              </p>
            </div>
            
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">{t('blast.identity')}:</span>{' '}
                  {((alignment.identity / alignment.alignLength) * 100).toFixed(1)}%
                  ({alignment.identity}/{alignment.alignLength})
                </div>
                <div>
                  <span className="font-medium">{t('blast.queryRange')}:</span>{' '}
                  {alignment.queryFrom} - {alignment.queryTo}
                </div>
                <div>
                  <span className="font-medium">{t('blast.alignmentLength')}:</span>{' '}
                  {alignment.alignLength} {t('blast.bp')}
                </div>
                <div>
                  <span className="font-medium">{t('blast.hitRange')}:</span>{' '}
                  {alignment.hitFrom} - {alignment.hitTo}
                </div>
              </div>
            </div>
            
            <div className="font-mono text-xs overflow-x-auto bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
              {/* Para secuencias largas, mostrar en bloques de 60 caracteres */}
              {chunkAlignment(alignment).map((chunk, chunkIndex) => (
                <div key={chunkIndex} className="mb-4">
                  <div className="grid grid-cols-[80px_1fr] mb-1">
                    <span className="text-gray-500">Query {chunk.start}</span>
                    <span className="whitespace-pre text-blue-700 dark:text-blue-400 font-medium">{chunk.query}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] mb-1">
                    <span className="text-gray-500"></span>
                    <span className="whitespace-pre text-gray-500">{chunk.midline}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr]">
                    <span className="text-gray-500">Subject {chunk.subjectStart}</span>
                    <span className="whitespace-pre text-green-700 dark:text-green-400 font-medium">{chunk.subject}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Dividir alineamiento en bloques más manejables
const chunkAlignment = (alignment: Alignment) => {
  const chunks: {
    query: string;
    midline: string;
    subject: string;
    start: number;
    subjectStart: number;
    queryLength: number;
    subjectLength: number;
  }[] = [];
  const blockSize = 60;
  
  // Calcular si el alineamiento va hacia adelante o hacia atrás
  const queryDirection = alignment.queryTo >= alignment.queryFrom ? 1 : -1;
  const hitDirection = alignment.hitTo >= alignment.hitFrom ? 1 : -1;
  
  for (let i = 0; i < alignment.query.length; i += blockSize) {
    // Extraer segmentos de este bloque
    const querySegment = alignment.query.substring(i, i + blockSize);
    const midlineSegment = alignment.midline.substring(i, i + blockSize);
    const hitSegment = alignment.hit.substring(i, i + blockSize);
    
    // Calcular posiciones numéricas
    const queryBlockLength = querySegment.replace(/-/g, '').length;
    const hitBlockLength = hitSegment.replace(/-/g, '').length;
    
    const queryStart: number = i === 0 
      ? alignment.queryFrom 
      : chunks[chunks.length - 1].start + queryDirection * chunks[chunks.length - 1].queryLength;
    
    const subjectStart: number = i === 0 
      ? alignment.hitFrom 
      : chunks[chunks.length - 1].subjectStart + hitDirection * chunks[chunks.length - 1].subjectLength;
    
    chunks.push({
      query: querySegment,
      midline: midlineSegment,
      subject: hitSegment,
      start: queryStart,
      subjectStart: subjectStart,
      queryLength: queryBlockLength,
      subjectLength: hitBlockLength
    });
  }
  
  return chunks;
};

  return (
    <div className="p-4">
      <h3 className="font-medium text-lg mb-4 text-gray-800 dark:text-white">
        {t('blast.alignmentDetails')}
      </h3>
      
      {renderAlignments()}
    </div>
  );
};

export default AlignmentView;