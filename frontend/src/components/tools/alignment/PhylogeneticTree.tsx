import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface PhylogeneticTreeProps {
  newickString: string;
  width?: number;
  height?: number;
}

interface Node {
  name: string;
  length?: number;
  children?: Node[];
  x?: number;
  y?: number;
  parent?: Node;
  _children?: Node[];
}

const PhylogeneticTree: React.FC<PhylogeneticTreeProps> = ({ 
  newickString, 
  width = 600, 
  height = 400 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Parse Newick format to hierarchical data
  const parseNewick = (newick: string): Node => {
    const tokens = newick.split(/\s*(;|\(|\)|,|:)\s*/);
    let i = 0;
    let name = '';
  
    const createNode = (): Node => {
      const node: Node = { name: '' };
      
      // Handle name
      name = '';
      while (i < tokens.length) {
        const token = tokens[i];
        i++;
        
        if (token === '(' || token === ')' || token === ',' || token === ';' || token === ':') {
          break;
        }
        name += token;
      }
      node.name = name || '';
      
      // Handle length
      if (tokens[i-1] === ':') {
        name = '';
        while (i < tokens.length) {
          const token = tokens[i];
          i++;
          
          if (token === '(' || token === ')' || token === ',' || token === ';' || token === ':') {
            i--;
            break;
          }
          name += token;
        }
        node.length = parseFloat(name);
      }
      
      // Handle children
      if (tokens[i-1] === '(') {
        node.children = [];
        
        while (i < tokens.length) {
          const child = createNode();
          node.children.push(child);
          
          if (tokens[i-1] === ')') {
            break;
          }
        }
      }
      
      return node;
    };
    
    return createNode();
  };

  useEffect(() => {
    if (!svgRef.current || !newickString) return;

    try {
      // Clear previous visualization
      d3.select(svgRef.current).selectAll('*').remove();

      // Parse the Newick string
      const root = parseNewick(newickString);
      const hierarchy = d3.hierarchy(root);

      // Create tree layout
      const treeLayout = d3.tree<Node>()
        .size([height - 40, width - 160]);

      // Apply layout
      const tree = treeLayout(hierarchy as d3.HierarchyNode<Node>);
      const svg = d3.select(svgRef.current);

      // Create group for the tree
      const g = svg.append('g')
        .attr('transform', `translate(80, 20)`);

      // Add links
      g.selectAll('.link')
        .data(tree.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#9D7ADA') // Changed to purple
        .attr('stroke-width', 1.5)
        .attr('d', d3.linkHorizontal<any, any>()
          .x(d => d.source ? d.source.y : d.y)
          .y(d => d.source ? d.source.x : d.x)
        );

      // Add nodes
      const nodes = g.selectAll('.node')
        .data(tree.descendants())
        .enter()
        .append('g')
        .attr('class', (d: d3.HierarchyPointNode<Node>) => `node ${d.children ? 'node--internal' : 'node--leaf'}`)
        .attr('transform', (d: d3.HierarchyPointNode<Node>) => `translate(${d.y},${d.x})`);

      // Add node circles
      nodes.append('circle')
        .attr('r', 4)
        .attr('fill', (d: d3.HierarchyPointNode<Node>) => d.children ? '#8B5CF6' : '#A78BFA'); // Changed to purple tones

      // Add text labels
      nodes.append('text')
        .attr('dy', '.31em')
        .attr('x', (d: d3.HierarchyPointNode<Node>) => d.children ? -8 : 8)
        .attr('text-anchor', (d: d3.HierarchyPointNode<Node>) => d.children ? 'end' : 'start')
        .text((d: d3.HierarchyPointNode<Node>) => d.data.name)
        .attr('font-size', '12px')
        .attr('font-family', 'sans-serif')
        .attr('fill', '#333');

      // Add branch length labels if available
      nodes.filter((d: d3.HierarchyPointNode<Node>) => d.data.length !== undefined)
        .append('text')
        .attr('y', -8)
        .attr('x', -20)
        .attr('text-anchor', 'middle')
        .text((d: d3.HierarchyPointNode<Node>) => {
          return d.data.length !== undefined ? d.data.length.toFixed(3) : '';
        })
        .attr('font-size', '10px')
        .attr('font-family', 'sans-serif')
        .attr('fill', '#777');

    } catch (error) {
      console.error('Error rendering phylogenetic tree:', error);
      
      // Display error message in SVG
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'sans-serif')
        .attr('fill', '#AB2A7D') // Changed to purple-red
        .text('Could not render tree. Invalid Newick format.');
    }
  }, [newickString, width, height]);

  return (
    <svg 
      ref={svgRef} 
      width={width} 
      height={height}
      className="mx-auto border border-purple-100 dark:border-purple-800 rounded-lg"
    />
  );
};

export default PhylogeneticTree;