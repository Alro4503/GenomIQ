# SPRINT 2 REVIEW

# Finished tasks

**BLAST Module**

- Interactive result visualization
- Export options: FASTA, CSV, JSON, XML
- Job queue integration for scalable search

**AI Assistant**

- Contextual understanding of user analysis history
- Intelligent tool recommendation engine
- Help users discover how to run desired analysis steps

# Unfinished tasks

**BLAST Module**
- Backend BLAST export and GCS connectivity: Connection with Google Cloud and creation of virtual machines done, the rest is not done due to lack of time. A lot of time has been wasted trying to implement this functionally using only frontend. Finally we are going to do it in backend.  

**AI Assistant**
- Insight generation based on analysis results: Lack of time.

# Feedback

- Multiple alignment: Slider bars to slide all alignments at once.
Put in the tools that when a query is made instead of AI perhaps it is with a database that gives you options?
- AI Assitant: Put typewriting, simulation of typing and filling in the query little by little. Make the user not notice that the query is taking a long time.
- AI Assistant: Fix responsiveness problem with long sequences without spaces, don't cut them.
- Sequences annotation: Improve visualizations.
- Separate tools by types.
- Put several api keys that if one fails, switch to another.
- Instead of putting sequences generated with the AI put a search engine that connects to a database by api to choose the sequences of organisms with more precision. 
- Blast: Improve how the blast search history is displayed (put a more indicative name for each query, button to delete all searches from the history).

