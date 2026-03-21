'use client';

import { useEffect, useRef, useState } from 'react';
import * as NGL from 'ngl';

interface StructureViewerProps {
  pdbData: string | null;
  settings: {
    representation: string;
    colorScheme: string;
    backgroundColor: string;
    spin: boolean;
    showLabels: boolean;
  };
}

const StructureViewer = ({ pdbData, settings }: StructureViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Client-side only
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);
  
  // Initialize NGL stage
  useEffect(() => {
    if (!isMounted || !containerRef.current) return;
    
    // Create NGL Stage
    const stage = new NGL.Stage(containerRef.current, {
      backgroundColor: settings.backgroundColor,
      clipDist: 0,
      fogFar: 100,
      fogNear: 50,
    });
    
    // Configure stage for better visualization
    stage.setParameters({
      cameraType: 'perspective',
      cameraFov: 40,
      clipDist: 10,
      clipFar: 100,
      clipNear: 0,
      fogFar: 100,
      fogNear: 50,
    });
    
    // Auto resize on window size change
    const handleResize = () => stage.handleResize();
    window.addEventListener('resize', handleResize);
    
    // Set the reference to clean up later
    stageRef.current = stage;
    
    return () => {
      window.removeEventListener('resize', handleResize);
      stage.dispose();
    };
  }, [isMounted]);
  
  // Update stage based on settings
  useEffect(() => {
    if (!isMounted || !stageRef.current) return;
    
    const stage = stageRef.current;
    
    // Update background color
    stage.setParameters({ backgroundColor: settings.backgroundColor });
    
    // Explicitly configure spin based on the setting
    // This ensures that the correct value is always set
    if (settings.spin) {
      stage.setSpin(true);
    } else {
      stage.setSpin(false);
    }
  }, [settings.backgroundColor, settings.spin, isMounted]);  
  
  // Load PDB data when available
  useEffect(() => {
    if (!isMounted || !stageRef.current || !pdbData) return;
    
    setLoadError(null);
    const stage = stageRef.current;
    
    // Clear any previous structures
    stage.removeAllComponents();
    
    // Helper function to map our simplified representation names to NGL representation types
    const getRepresentationType = (rep: string) => {
      const mapping: Record<string, string> = {
        'cartoon': 'cartoon',
        'licorice': 'licorice',
        'ball_and_stick': 'ball+stick',
        'spacefill': 'spacefill',
        'ribbon': 'ribbon',
        'backbone': 'backbone',
      };
      return mapping[rep] || 'cartoon';
    };
    
    // Enhanced color scheme mapping with additional options
    const getColorScheme = (scheme: string) => {
      const mapping: Record<string, string | object> = {
        // Original color schemes
        'chainid': 'chainid',
        'restype': 'restype',
        'element': 'element',
        'secondary_structure': 'sstruc',
        
        // New color schemes
        'residueindex': 'residueindex',
        'hydrophobicity': 'hydrophobicity',
        'electrostatic': function(atom: any) {
          if (atom.resname === 'ASP' || atom.resname === 'GLU') return 'red';
          if (atom.resname === 'LYS' || atom.resname === 'ARG') return 'blue';
          if (atom.resname === 'HIS') return 'lightblue';
          return 'white';
        },
        'bfactor': 'bfactor',
        'rainbow': 'rainbow',
        'spectral': 'spectral'
      };
      
      return mapping[scheme] || 'chainid';
    };
    
    // Load the structure from pdbData string
    try {
      const blob = new Blob([pdbData], { type: 'text/plain' });
      
      stage.loadFile(blob, { ext: 'pdb' })
        .then((component: any) => {
          // Add the selected representation
          const repType = getRepresentationType(settings.representation);
          const colorScheme = getColorScheme(settings.colorScheme);
          
          // Apply representation with color scheme
          component.addRepresentation(repType, { 
            color: colorScheme,
            // Enhanced visualization parameters for better quality
            quality: 'high',
            disableImpostor: false,
            smoothSheet: true,
            material: 'default'
          });
          
          // Add labels if requested
          if (settings.showLabels) {
            component.addRepresentation('label', {
              sele: 'backbone',
              color: settings.backgroundColor === '#000000' ? '#ffffff' : '#222222',
              name: 'residueLabel',
              labelType: 'residue',
              labelGrouping: 'residue',
              fontWeight: 'bold',
              xOffset: 0,
              yOffset: 0,
              zOffset: 0,
              // Only show labels on every 5th residue to avoid clutter
              radiusType: 'size',
              radiusSize: 1.5,
              showBorder: true,
              borderColor: settings.backgroundColor === '#000000' ? '#000000' : '#ffffff',
              borderWidth: 0.5,
              sdf: true, // Signed distance field for better text quality
              fixedSize: true,
              attachment: 'middle-center',
              showBackground: true,
              backgroundColor: "rgba(255, 255, 255, 0.5)"
            });
          }
          
          // Zoom to structure
          component.autoView();
        })
        .catch((error: any) => {
          console.error('Error loading PDB data:', error);
          setLoadError('Error loading PDB data. Please check file format.');
        });
    } catch (error) {
      console.error('Error creating Blob from PDB data:', error);
      setLoadError('Error processing PDB data. Please try another file.');
    }
  }, [pdbData, settings.representation, settings.colorScheme, settings.showLabels, settings.backgroundColor, isMounted]);
  
  // Capture scroll events
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    // Prevent default scrolling when the mouse is over the viewer
    const handleWheel = (e: WheelEvent) => {
      if (isFocused) {
        e.preventDefault();
        // The NGL viewer already handles zoom with wheel events
        // We just need to prevent the page from scrolling
      }
    };
    
    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [isFocused]);
  
  // If not mounted on the client, show a placeholder
  if (!isMounted) {
    return (
      <div 
        className="w-full h-full min-h-96 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden flex items-center justify-center"
      >
        <p>Loading viewer...</p>
      </div>
    );
  }
  
  // If there's a loading error, display it
  if (loadError) {
    return (
      <div 
        className="w-full h-full min-h-96 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden flex items-center justify-center"
      >
        <div className="text-center p-6 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef} 
      className={`
        w-full h-full min-h-96 border border-neutral-200 
        dark:border-neutral-700 rounded-lg overflow-hidden
        ${isFocused ? 'outline outline-2 outline-purple-500' : ''}
      `}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      tabIndex={0} // Make the div focusable
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
};

export default StructureViewer;