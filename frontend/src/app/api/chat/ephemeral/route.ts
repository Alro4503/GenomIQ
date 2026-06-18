import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are GenomIQ AI, an expert bioinformatics assistant.
You help users with genomic and bioinformatic analysis, explain scientific concepts,
and provide tool recommendations for BLAST, alignment, annotation, translation, and visualization.
Be concise and helpful. Support both English and Spanish.`;

export async function POST(request: NextRequest) {
  try {
    const { message, tool_context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 });
    }

    const systemText = SYSTEM_PROMPT +
      (tool_context ? `\n\nContext: User is working with the ${tool_context} tool.` : '');

    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!groqResponse.ok) {
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 });
    }

    const groqData = await groqResponse.json();
    const responseText = groqData.choices?.[0]?.message?.content || '';

    const toolKeywords = ['blast', 'alignment', 'annotation', 'translation', 'visualization'];
    const mentionedTools = toolKeywords.filter(t => responseText.toLowerCase().includes(t));

    return NextResponse.json({
      message: responseText,
      conversation_id: Date.now(),
      message_id: Date.now() + 1,
      ai_provider: 'groq-llama-3.3-70b',
      recommended_tools: mentionedTools.join(','),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
