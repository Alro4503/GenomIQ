import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

// In-memory conversation history store (persists within warm function instance)
const conversationStore = new Map<number, Array<{ role: string; content: string }>>();

let conversationIdCounter = 100000;

export async function POST(request: NextRequest) {
  try {
    const { message, conversation_id, tool_context, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add GEMINI_API_KEY to environment variables.' },
        { status: 503 }
      );
    }

    // Get or create conversation ID
    const convId = conversation_id || ++conversationIdCounter;

    // Build conversation history for Gemini
    // Prefer the history sent by the client (from localStorage), fall back to server-side store
    let geminiHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    const clientHistory: Array<{ role: string; content: string }> = history || [];
    const serverHistory = conversationStore.get(convId) || [];

    // Use client history if available (more reliable in demo mode)
    const historyToUse = clientHistory.length > 0 ? clientHistory : serverHistory;

    geminiHistory = historyToUse.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Build the Gemini request
    const geminiBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT + (tool_context ? `\n\nCurrent context: User is working with the ${tool_context} tool.` : '') }],
      },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: message }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
        topP: 0.95,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json(
        { error: `Gemini error ${geminiResponse.status}: ${errorText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!responseText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    // Update server-side history
    const updatedHistory = [
      ...historyToUse,
      { role: 'user', content: message },
      { role: 'assistant', content: responseText },
    ];
    conversationStore.set(convId, updatedHistory.slice(-40));

    // Detect tool recommendations in the response
    const toolKeywords = ['blast', 'alignment', 'annotation', 'translation', 'visualization'];
    const mentionedTools = toolKeywords.filter(tool =>
      responseText.toLowerCase().includes(tool)
    );

    const messageId = Date.now();

    return NextResponse.json({
      message: responseText,
      conversation_id: convId,
      message_id: messageId,
      ai_provider: 'gemini-1.5-flash',
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
