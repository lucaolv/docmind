import { streamText } from 'ai';
import { chatModel, embeddingModel } from '@/lib/ai';
import { getEmbeddingsIndex } from '@/lib/pinecone';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages: originalMessages }: { messages: any[] } = await req.json();

    // Normalização das mensagens
    const messages: any[] = originalMessages.map(message => {
      if (message.parts && Array.isArray(message.parts)) {
        const textContent = message.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
        return { role: message.role, content: textContent };
      }
      if (typeof message.content === 'object' && message.content && 'text' in message.content) {
        return { ...message, content: message.content.text };
      }
      return message;
    });

    const lastMessage = messages[messages.length - 1];

    // Se não for mensagem do usuário, apenas responde (bypass do RAG)
    if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
      const result = await streamText({
        model: chatModel,
        messages,
        maxRetries: 0, // Importante: Não tenta de novo se falhar na cota
      });
      return result.toTextStreamResponse();
    }

    // --- RAG FLOW ---
    // 1. Gera o Embedding da pergunta usando Groq
    const embedding = await embeddingModel.getEmbedding(lastMessage.content);

    // 2. Busca no Pinecone
    const index = getEmbeddingsIndex();
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });

    const context = queryResponse.matches
      .filter((match) => match.score && match.score > 0.6)
      .map((match) => match.metadata?.text)
      .join('\n\n---\n\n');

    // Se tem contexto, usa RAG. Se não, responde normalmente
    const systemPrompt = context
      ? `
      Você é um assistente de IA especializado chamado DocMind.
      Sua principal função é responder a perguntas com base em um contexto fornecido.
      Seja conciso, preciso e direto ao ponto.
      
      Responda à pergunta do usuário utilizando o seguinte contexto.
      Se a resposta não estiver no contexto, você pode usar seu conhecimento geral.

      CONTEXTO:
      """
      ${context}
      """
    `
      : `
      Você é um assistente de IA especializado chamado DocMind.
      Responda perguntas de forma concisa, precisa e útil.
      Seja amigável e direto ao ponto.
    `;

    // 4. Gera a resposta final
    const result = await streamText({
      model: chatModel,
      system: systemPrompt,
      messages,
      maxRetries: 0,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Erro na rota de chat:', error);

    if (error.status === 429 || error.message?.includes('429')) {
      return new Response("O sistema está sobrecarregado (Muitas requisições). Aguarde alguns segundos.", { status: 429 });
    }

    return new Response(JSON.stringify({ error: 'Erro interno no servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}