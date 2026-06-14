import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured.' },
        { status: 503 }
      );
    }

    const systemText = SYSTEM_PROMPT +
      (tool_context ? `\n\nContext: User is working with the ${tool_context} tool.` : '');

    const geminiBody = {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: message }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const toolKeywords = ['blast', 'alignment', 'annotation', 'translation', 'visualization'];
    const mentionedTools = toolKeywords.filter(t => responseText.toLowerCase().includes(t));

    return NextResponse.json({
      message: responseText,
      conversation_id: Date.now(),
      message_id: Date.now() + 1,
      ai_provider: 'gemini-1.5-flash',
      recommended_tools: mentionedTools.join(','),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
