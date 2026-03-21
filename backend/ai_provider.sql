INSERT INTO ai_providers (
    name, 
    api_key, 
    base_url, 
    description, 
    is_active, 
    priority
) VALUES (
    'openrouter',
    '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',
    'https://openrouter.ai/api/v1/chat/completions',
    'Proveedor que ofrece acceso a múltiples modelos gratuitos de IA rotando automáticamente',
    TRUE,
    1
);