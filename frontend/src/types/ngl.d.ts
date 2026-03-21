// src/types/ngl.d.ts
declare module 'ngl' {
    export class Stage {
      constructor(element: HTMLElement, params?: any);
      loadFile(path: string | Blob, params?: any): Promise<any>;
      removeAllComponents(): void;
      autoView(): void;
      loadData(data: string, params: { ext: string, name?: string }): Promise<any>;
      setParameters(params: any): void;
      handleResize(): void;
      dispose(): void;
      setSpin(flag: boolean): void;
      signals: {
        clicked: {
          add: (callback: Function) => void;
          remove: (callback: Function) => void;
        };
        hovered: {
          add: (callback: Function) => void;
          remove: (callback: Function) => void;
        };
      };
    }
  
    export const ColormakerRegistry: any;
    export const DatasourceRegistry: any;
    export const RepresentationRegistry: any;
    export const ComponentRegistry: any;
    
    // Add other necessary exports from the NGL library
    // This is a basic declaration and you may need to expand it based on your usage
  
    export interface LoaderParameters {
      ext?: string;
      name?: string;
      defaultRepresentation?: boolean;
      asTrajectory?: boolean;
    }
  
    export interface ComponentParameters {
      name?: string;
      status?: string;
      visible?: boolean;
      sele?: string;
    }
  
    export interface RepresentationParameters {
      color?: string | object;
      radius?: number;
      scale?: number;
      assembly?: string;
      quality?: string | number;
      opacity?: number;
      wireframe?: boolean;
      roughness?: number;
      linewidth?: number;
      colorScheme?: string;
      colorScale?: string;
      colorDomain?: number[];
      colorValue?: number;
      colorMode?: string;
      sele?: string;
      labelType?: string;
      labelGrouping?: string;
      fontWeight?: string;
      xOffset?: number;
      yOffset?: number;
      zOffset?: number;
      name?: string;
    }
    
    export class Component {
      addRepresentation(type: string, params?: RepresentationParameters): any;
      autoView(duration?: number): void;
    }
  }