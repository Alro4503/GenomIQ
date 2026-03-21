/**
 * Gestor para controlar solicitudes de secuencias activas
 * Soporta colas de solicitudes y seguimiento de estado por herramienta
 */

// Valid tool contexts type
type ToolContext = 'alignment' | 'annotation' | 'translation';

const sequenceRequestManager = {
    // Estado de solicitud activa
    activeRequest: false,
    
    // Cola de solicitudes pendientes
    requestQueue: [] as Function[],
    
    // Mapa para rastrear solicitudes pendientes específicas
    pendingRequests: new Map<string, {timestamp: number, type: string}>(),
    
    // Estado por herramienta
    toolState: {
      alignment: {
        active: false,
        count: 0
      },
      annotation: {
        active: false,
        count: 0
      },
      translation: {
        active: false,
        count: 0
      }
    },
    
    /**
     * Marca que hay una solicitud activa
     * @param tool Herramienta que inicia la solicitud ('alignment', 'annotation' o 'translation')
     * @returns Booleano indicando si la solicitud pudo iniciarse
     */
    startRequest(tool: ToolContext = 'alignment'): boolean {
      // Si ya hay una solicitud activa, encolarla para después
      if (this.activeRequest) {
        console.log(`Solicitud para ${tool} no iniciada, ya hay una activa`);
        return false;
      }
      
      this.activeRequest = true;
      this.toolState[tool].active = true;
      this.toolState[tool].count++;
      
      console.log(`Solicitud de secuencia iniciada para ${tool}`);
      return true;
    },
    
    /**
     * Marca que ya no hay solicitudes activas
     * @param tool Herramienta que finaliza la solicitud ('alignment', 'annotation' o 'translation')
     */
    endRequest(tool: ToolContext = 'alignment'): void {
      this.activeRequest = false;
      this.toolState[tool].active = false;
      
      console.log(`Solicitud de secuencia completada para ${tool}`);
      
      // Procesar siguiente solicitud en cola si existe
      this.processNextInQueue();
    },
    
    /**
     * Procesa la siguiente solicitud en la cola
     */
    processNextInQueue(): void {
      if (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
          setTimeout(() => {
            this.activeRequest = true;
            nextRequest();
          }, 100);
          console.log('Procesando siguiente solicitud en cola');
        }
      }
    },
    
    /**
     * Encola una solicitud para ejecución posterior
     * @param callback Función a ejecutar cuando sea posible
     */
    queueRequest(callback: Function): void {
      this.requestQueue.push(callback);
      console.log(`Solicitud encolada. Tamaño de cola: ${this.requestQueue.length}`);
    },
    
    /**
     * Verifica si hay una solicitud activa
     * @param specificTool Opcional: verificar solo para una herramienta específica
     * @returns Booleano indicando si hay solicitud activa
     */
    hasActiveRequest(specificTool?: ToolContext): boolean {
      if (specificTool) {
        return this.toolState[specificTool].active;
      }
      return this.activeRequest;
    },
    
    /**
     * Registra una solicitud específica como pendiente
     * @param id Identificador de la solicitud
     * @param type Tipo de solicitud ('id' o 'sequence')
     * @returns Timestamp de registro
     */
    registerPendingRequest(id: string, type: string = 'sequence'): number {
      const timestamp = Date.now();
      this.pendingRequests.set(id, {timestamp, type});
      console.log(`Solicitud ${id} de tipo ${type} registrada como pendiente`);
      return timestamp;
    },
    
    /**
     * Limpia una solicitud pendiente
     * @param id Identificador de la solicitud
     * @param timestamp Opcional: timestamp específico para validación
     * @returns Booleano indicando si se limpió correctamente
     */
    clearPendingRequest(id: string, timestamp?: number): boolean {
      const pendingData = this.pendingRequests.get(id);
      
      // Si se proporcionó timestamp, verificar que coincida
      if (timestamp && pendingData && pendingData.timestamp !== timestamp) {
        console.log(`No se pudo limpiar solicitud ${id}: timestamp no coincide`);
        return false;
      }
      
      this.pendingRequests.delete(id);
      console.log(`Solicitud ${id} eliminada de pendientes`);
      return true;
    },
    
    /**
     * Verifica si una solicitud específica está pendiente
     * @param id Identificador de la solicitud
     * @returns Booleano indicando si está pendiente
     */
    isPendingRequest(id: string): boolean {
      return this.pendingRequests.has(id);
    },
    
    /**
     * Devuelve los datos de una solicitud pendiente
     * @param id Identificador de la solicitud
     * @returns Datos de la solicitud o undefined
     */
    getPendingRequestData(id: string): {timestamp: number, type: string} | undefined {
      return this.pendingRequests.get(id);
    },
    
    /**
     * Obtiene el número de solicitudes en cola
     * @returns Número de solicitudes pendientes
     */
    getQueueLength(): number {
      return this.requestQueue.length;
    },
    
    /**
     * Limpia todas las solicitudes pendientes
     */
    clearQueue(): void {
      this.requestQueue = [];
      this.pendingRequests.clear();
      console.log('Cola de solicitudes limpiada');
    },
    
    /**
     * Obtiene estadísticas de uso
     * @returns Objeto con estadísticas
     */
    getStats(): object {
      return {
        activeRequest: this.activeRequest,
        queueLength: this.requestQueue.length,
        pendingRequests: this.pendingRequests.size,
        toolStats: {
          alignment: { ...this.toolState.alignment },
          annotation: { ...this.toolState.annotation },
          translation: { ...this.toolState.translation }
        }
      };
    }
  };
  
  export default sequenceRequestManager;