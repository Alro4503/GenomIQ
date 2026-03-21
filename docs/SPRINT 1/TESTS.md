### **BIO001 - BLAST Search via API test done by Álvaro**
- Implement sequence input functionality 
- Integrate BLAST API for search execution 
    - Done, the API answers correctly.
- Allow selection of BLAST algorithms 
    - Done, you can choose between multiple blast algorithms depending on the blast search type selected. 
- Implement interactive result visualization
    - Done partialy, the results are displated but with poor visualization.
- Implement export formats (FASTA, CSV, JSON, XML) 
    - Not done. 
- Implement queue system
    - Partially done. Works but outside the main page. 

**Test**
- "Blast search" button clicked with and without sequences.
- All blast algorithms were checked.
- All availabe databases were tried. 
- Multiple searches where performed at the same time to test queue system
- A correct and incorrect sequence were input
---

### **BIO002 - Multiple Sequence Alignment and Phylogenetic Tree test done by Álvaro**
- Implement multiple sequence input
    - Done, you can either input directly a sequence or by uploading a file
- Integrate Clustal Omega & MUSCLE APIs 
    - Partially done, Clustal and MUSCLE work, but a third option (MAFFT) was added and does not display any result. 
- Generate phylogenetic tree from alignment
    - Done, a phylogenetic tree is shwon when the translation is done.
- Implement interactive visualization
    - Done, you can score through the results if they are not completely dispalyed in the screen.
- Implement export functionality 
    - Done, you can export files in FASTA format. 

**Tests**

- "Run alignment" button clicked with and without sequences
- A sequences was input directly and with the upload file option.
- All alignment options where tried (Clustal, Muscle, MAFFT)
- Alignment was tried with 2-5 sequences simoultaneously
- All result dispaly options were tried
- Add sequence button was tried for a new sequence input
- Remove sequence button was tried to remove a sequence
- The page scroll page was tried in the result that allowed it
- The download button was clicked after the alignement was performed

---

### **BIO003 - Sequence Translation test done by Álvaro**
- Implement sequence input functionality
    - Done. You can only input a sequence with valid characters.
- Implement reading frame selection
    - Done. You can translate a sequence with all three frame levels
- Integrate codon table and genetic code options 
    - Done. 
- Format output with annotations & readability 
    - Done. The result is displayed clearly and has a legend for characters that may be confusing.
- Implement export options (FASTA, plain text) 
    - Not done. You can only copy the result to the clipboard. 

**Tests**
- An invalid sequence was input
- A valid sequence was input
- All radio box options were tested (DNA or RNA, Reading frame 1 to 3)
- The translate button was clicked with and without sequence 

---

### **BIO004 - 3D Visualization of Protein and DNA Structures test done by Álvaro**
- Implement PDB file upload 
    - Done, you input a PDB file and the visualization works correctly.
- Integrate 3D rendering engine 
    - Done, a 3D rendering engine was integrated and a the 3D protein structure is displayed correctly. 
- Implement interactive manipulation tools
    - Done, you can drag, scroll, zoom, etc... through the protein. 
- Highlight secondary structures & binding sites 
    - Done, you can highlight the secondary structure and binding sites along with other visualization options (Cartoon, ribbon, backbone, etc).    

**Tests**

- "Visualize structure" button was clicked with and without protein uploaded.
- Cancel button was clicked to remove the uploaded protein
- All visual options radio buttons were clicked to display the protein in different ways.
- The protein was interacted in different ways to check that can be zoomed out, scrolled, rotated, etc. 
- Other buttons as background color, auto-rotate structure and show atom tables were clicked.  

---
### **BIO005 - Sequence Annotation test done by Álvaro**
- Implement sequence input functionality 
- Integrate external database retrieval (UniProt, Pfam)
- Implement functional domain detection
- Format and display annotations clearly 

---

### **BIO006 - AI-Powered Chat Assistant test done by Álvaro**
- Implement chat interface on the frontend 
    - Done, a chat box is displayed with an input for messages.
- Develop backend for processing queries 
    - Done, the AI chat answers to user queries
- Implement AI model to analyze user queries 
    - Done, AI answers user queries if they are related with the web.
- Generate customized tool recommendations 
    - Not done, we decide to implement this in the next sprint. 
- Save chat history for future reference 
    - Done, the chats are saved and can be removed. 
- Provide insights from implemented tools 
    - Not done, we decided to implement this when all tools are fully functional.

**Test**

- Button to send prompt message (an icon) was clicked with and without prompt.
- New conversation button was clicked to show a new chat box
- A previously created chat conversation was accessed while you were not in it.
- Delete stored conversation button was clicked. 

---