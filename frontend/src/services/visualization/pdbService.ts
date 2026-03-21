/**
 * Service for interacting with PDB databases
 */

interface PDBSearchResult {
    pdbId: string;
    title: string;
    organism?: string;
    resolution?: number;
    link: string;
}

const pdbService = {
    /**
     * Search for PDB structures using the RCSB PDB Search API
     * @param query The search query
     * @returns Promise with search results
     */
    async searchPDB(query: string): Promise<PDBSearchResult[]> {
        try {
            // RCSB PDB API endpoint
            const apiUrl = 'https://search.rcsb.org/rcsbsearch/v2/query';

            // Create a search request that looks for the query in various attributes
            const searchPayload = {
                query: {
                    type: "group",
                    logical_operator: "or",
                    nodes: [
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "rcsb_entity_polymer_entity.rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                                operator: "exact_match",
                                value: query
                            }
                        },
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "rcsb_polymer_entity.rcsb_macromolecular_names_combined.name",
                                operator: "contains_phrase",
                                value: query
                            }
                        },
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                                operator: "exact_match",
                                value: query
                            }
                        },
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "struct.title",
                                operator: "contains_phrase",
                                value: query
                            }
                        },
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "rcsb_entry_info.deposited_polymer_entity_instance_count",
                                operator: "greater",
                                value: 0
                            }
                        }
                    ]
                },
                return_type: "entry",
                request_options: {
                    pager: {
                        start: 0,
                        rows: 10
                    },
                    scoring_strategy: "combined",
                    sort: [
                        {
                            sort_by: "score",
                            direction: "desc"
                        }
                    ]
                }
            };

            // Make the API request
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload)
            });

            // Handle API response
            if (!response.ok) {
                throw new Error(`RCSB PDB API error: ${response.statusText}`);
            }

            const data = await response.json();
            const results = data.result_set || [];

            // Transform results to our format
            return results.map((result: any) => {
                const pdbId = result.identifier;

                // Create download link for the PDB file
                const downloadLink = `https://files.rcsb.org/download/${pdbId}.pdb`;

                return {
                    pdbId: pdbId,
                    title: result.title || `Structure ${pdbId}`,
                    organism: result.organism || 'Unknown',
                    resolution: result.resolution || null,
                    link: downloadLink
                };
            });
        } catch (error) {
            console.error('Error searching PDB:', error);
            throw error;
        }
    },

    /**
     * Get a PDB file directly by its ID
     * @param pdbId The PDB ID
     * @returns Promise with the PDB file content
     */
    async getPDBById(pdbId: string): Promise<{ data: string, title: string }> {
        try {
            // Create standard PDB download URL
            const url = `https://files.rcsb.org/download/${pdbId}.pdb`;

            // Download the PDB file
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to download PDB: ${response.statusText}`);
            }

            const data = await response.text();

            // Extract title from PDB header if possible
            let title = pdbId;
            const titleMatch = data.match(/TITLE\s+(.*)/);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
            }

            return { data, title };
        } catch (error) {
            console.error(`Error getting PDB ${pdbId}:`, error);
            throw error;
        }
    },

    /**
     * Get a download URL for a PDB file by ID
     * @param pdbId The PDB ID
     * @returns The download URL
     */
    getPDBDownloadUrl(pdbId: string): string {
        return `https://files.rcsb.org/download/${pdbId}.pdb`;
    }
};

export default pdbService;