'use client';

import { useEffect, useState } from 'react';

interface BiowasmModule {
  name: string;
  programs: string[];
}

/**
 * Component to initialize Biowasm modules when the application loads
 */
const BiowasInitializer: React.FC = () => {
  const [modulesLoaded, setModulesLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check WebAssembly support
    const isWebAssemblySupported = typeof WebAssembly !== 'undefined';
    
    if (isWebAssemblySupported) {
      console.log('WebAssembly is supported, preloading Biowasm files...');
      
      // Define a unique key for this module set to track loading status
      const moduleKey = 'biowasm-msa-modules';
      
      // Check if modules were already loaded in this session
      const alreadyLoaded = window.sessionStorage.getItem(moduleKey) === 'loaded';
      
      if (alreadyLoaded) {
        console.log('Biowasm modules were already preloaded in this session');
        setModulesLoaded(prev => ({ ...prev, [moduleKey]: true }));
        return;
      }
      
      // Preload aioli.js
      const aioliLink = document.createElement('link');
      aioliLink.rel = 'preload';
      aioliLink.as = 'script';
      aioliLink.href = '/biowasm/aioli.js';
      aioliLink.crossOrigin = 'anonymous';
      document.head.appendChild(aioliLink);
      
      // Required modules
      const modules: BiowasmModule[] = [
        { name: 'mafft', programs: ['tbfast', 'dvtditr'] },
        { name: 'muscle', programs: ['muscle'] },
        { name: 'kalign', programs: ['kalign'] }
      ];
      
      // Create preload links for each module
      modules.forEach(module => {
        module.programs.forEach(program => {
          // Preload JavaScript file
          const jsLink = document.createElement('link');
          jsLink.rel = 'preload';
          jsLink.as = 'script';
          jsLink.href = `/biowasm/${module.name}/${program}.js`;
          jsLink.crossOrigin = 'anonymous';
          document.head.appendChild(jsLink);
          
          // Preload WebAssembly file
          const wasmLink = document.createElement('link');
          wasmLink.rel = 'preload';
          wasmLink.as = 'fetch';
          wasmLink.href = `/biowasm/${module.name}/${program}.wasm`;
          wasmLink.crossOrigin = 'anonymous';
          wasmLink.type = 'application/wasm';
          document.head.appendChild(wasmLink);
        });
      });
      
      // Also preload coreutils modules required for MAFFT
      const coreUtils = ['echo', 'ls', 'cat'];
      coreUtils.forEach(program => {
        const jsLink = document.createElement('link');
        jsLink.rel = 'preload';
        jsLink.as = 'script';
        jsLink.href = `/biowasm/coreutils/${program}.js`;
        jsLink.crossOrigin = 'anonymous';
        document.head.appendChild(jsLink);
        
        const wasmLink = document.createElement('link');
        wasmLink.rel = 'preload';
        wasmLink.as = 'fetch';
        wasmLink.href = `/biowasm/coreutils/${program}.wasm`;
        wasmLink.crossOrigin = 'anonymous';
        wasmLink.type = 'application/wasm';
        document.head.appendChild(wasmLink);
      });

      // Mark modules as loaded in this session
      window.sessionStorage.setItem(moduleKey, 'loaded');
      setModulesLoaded(prev => ({ ...prev, [moduleKey]: true }));
      
      // Add cleanup function
      return () => {
        // Optional: clean up any event listeners or resources if needed
      };
    } else {
      console.warn('WebAssembly is not supported in this browser.');
    }
  }, []);

  // This is a utility component - it doesn't render anything
  return null;
};

export default BiowasInitializer;