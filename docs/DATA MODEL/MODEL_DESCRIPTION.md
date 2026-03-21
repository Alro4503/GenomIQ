# Database Schema for GenomIQ Platform

#### USERS
- **id**: Primary key, unique identifier for each user
- **email**: User's email address (unique)
- **hashed_password**: Securely stored password
- **full_name**: User's full name
- **is_active**: Boolean flag indicating if the account is active
- **created_at**: Timestamp of account creation
- **language_preference**: Preferred language (supports English and Spanish)
- **dark_mode**: Boolean indicating user's interface preference

#### SEQUENCES
- **id**: Primary key
- **user_id**: Foreign key referencing USERS
- **name**: Name of the sequence
- **description**: Description of the sequence
- **sequence_data**: The actual genetic sequence data
- **sequence_type**: Type of sequence (DNA, RNA, protein)
- **format**: Format of the sequence (FASTA, GenBank, etc.)
- **length**: Length of the sequence
- **created_at**: Timestamp of sequence creation/upload

#### SEQUENCE_ANNOTATIONS
- **id**: Primary key
- **sequence_id**: Foreign key referencing SEQUENCES
- **start_position**: Start position of the annotation
- **end_position**: End position of the annotation
- **annotation_type**: Type of annotation (gene, promoter, etc.)
- **name**: Name of the annotated feature
- **description**: Description of the annotation
- **source**: Source of the annotation
- **created_at**: Timestamp of annotation creation

#### ANALYSIS_HISTORY
- **id**: Primary key
- **user_id**: Foreign key referencing USERS
- **sequence_id**: Foreign key referencing SEQUENCES
- **tool_name**: Name of the analysis tool used
- **parameters**: JSON object containing parameters used for analysis
- **result_summary**: Summary of analysis results
- **created_at**: Timestamp of analysis completion

#### VISUALIZATION_SETTINGS
- **id**: Primary key
- **user_id**: Foreign key referencing USERS
- **setting_type**: Type of visualization setting
- **settings**: JSON object containing visualization preferences
- **created_at**: Timestamp of setting creation
- **updated_at**: Timestamp of last update

#### TOOL_RECOMMENDATIONS
- **id**: Primary key
- **user_id**: Foreign key referencing USERS
- **sequence_id**: Foreign key referencing SEQUENCES
- **tool_name**: Name of the recommended tool
- **relevance_score**: Score indicating relevance of recommendation
- **justification**: Explanation for the recommendation
- **suggested_parameters**: JSON object with suggested parameters
- **created_at**: Timestamp of recommendation creation

#### AI_PROVIDERS
- **id**: Primary key
- **name**: Name of the AI provider
- **api_key**: API key for authentication
- **base_url**: Base URL for API requests
- **description**: Description of the provider
- **model_name**: Name of the AI model
- **is_active**: Boolean indicating if provider is active
- **priority**: Priority level for provider selection
- **created_at**: Timestamp of provider addition
- **updated_at**: Timestamp of last update

#### AI_PROVIDER_QUOTAS
- **id**: Primary key
- **provider_name**: Name of the AI provider
- **current_usage**: Current token usage count
- **daily_limit**: Daily token usage limit
- **last_reset**: Timestamp of last usage reset
- **is_active**: Boolean indicating if quota monitoring is active

#### CHAT_CONVERSATIONS
- **id**: Primary key
- **user_id**: Foreign key referencing USERS
- **title**: Title of the conversation
- **created_at**: Timestamp of conversation creation
- **updated_at**: Timestamp of last message
- **is_active**: Boolean indicating if conversation is active
- **context_data**: JSON object containing conversation context

#### CHAT_MESSAGES
- **id**: Primary key
- **conversation_id**: Foreign key referencing CHAT_CONVERSATIONS
- **user_id**: Foreign key referencing USERS
- **content**: Message content
- **is_from_user**: Boolean indicating if message is from user or AI
- **created_at**: Timestamp of message creation
- **ai_provider**: Name of AI provider that generated response
- **tokens_used**: Number of tokens used for this message
- **related_sequence_id**: Foreign key referencing SEQUENCES (optional)
- **related_tool**: Name of related bioinformatics tool (optional)

### Key Relationships

- **USERS to SEQUENCES**: One-to-many (A user can have multiple sequences)
- **USERS to VISUALIZATION_SETTINGS**: One-to-many (A user can have multiple visualization preferences)
- **USERS to ANALYSIS_HISTORY**: One-to-many (A user can perform multiple analyses)
- **USERS to TOOL_RECOMMENDATIONS**: One-to-many (A user can receive multiple tool recommendations)
- **USERS to CHAT_CONVERSATIONS**: One-to-many (A user can participate in multiple conversations)
- **USERS to CHAT_MESSAGES**: One-to-many (A user can send multiple messages)

- **SEQUENCES to SEQUENCE_ANNOTATIONS**: One-to-many (A sequence can have multiple annotations)
- **SEQUENCES to ANALYSIS_HISTORY**: One-to-many (A sequence can be analyzed multiple times)
- **SEQUENCES to TOOL_RECOMMENDATIONS**: One-to-many (A sequence can receive multiple tool recommendations)
- **SEQUENCES to CHAT_MESSAGES**: One-to-many (A sequence can be referenced in multiple messages)

- **CHAT_CONVERSATIONS to CHAT_MESSAGES**: One-to-many (A conversation contains multiple messages)