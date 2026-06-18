import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are GenomIQ AI, an expert bioinformatics assistant integrated into the GenomIQ platform.
You help users with genomic and bioinformatic analysis, explain scientific concepts,
guide them through the platform's tools, and interpret analysis results.

Available tools on this platform:
- BLAST: Sequence similarity search against NCBI databases
- Alignment (MSA): Multiple Sequence Alignment
- Annotation: Protein/DNA feature annotation using UniProt, PFAM, PROSITE
- Translation: DNA/RNA to protein translation
- Visualization: 3D molecular structure viewer

When relevant, recommend tools by mentioning their names. Be helpful, scientific, and accessible.
Support both English and Spanish based on the user's language.

Note: This is a portfolio demo version of GenomIQ running entirely on the frontend with Vercel.`;

const conversationStore = new Map<number, Array<{ role: string; content: string }>>();
let conversationIdCounter = 100000;

export async function POST(request: NextRequest) {
  try {
    const { message, conversation_id, tool_context, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add GROQ_API_KEY to environment variables.' },
        { status: 503 }
      );
    }

    const convId = conversation_id || ++conversationIdCounter;

    const clientHistory: Array<{ role: string; content: string }> = history || [];
    const serverHistory = conversationStore.get(convId) || [];
    const historyToUse = clientHistory.length > 0 ? clientHistory : serverHistory;

    const systemText = SYSTEM_PROMPT +
      (tool_context ? `\n\nCurrent context: User is working with the ${tool_context} tool.` : '');

    const messages = [
      { role: 'system', content: systemText },
      ...historyToUse.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })),
      { role: 'user', content: message },
    ];

    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 502 }
      );
    }

    const groqData = await groqResponse.json();
    const responseText = groqData.choices?.[0]?.message?.content || '';

    if (!responseText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    const updatedHistory = [
      ...historyToUse,
      { role: 'user', content: message },
      { role: 'assistant', content: responseText },
    ];
    conversationStore.set(convId, updatedHistory.slice(-40));

    const toolKeywords = ['blast', 'alignment', 'annotation', 'translation', 'visualization'];
    const mentionedTools = toolKeywords.filter(tool =>
      responseText.toLowerCase().includes(tool)
    );

    return NextResponse.json({
      message: responseText,
      conversation_id: convId,
      message_id: Date.now(),
      ai_provider: 'groq-llama-3.3-70b',
      recommended_tools: mentionedTools.join(','),
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
