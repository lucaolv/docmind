import { streamText } from 'ai';
import { chatModel, embeddingModel } from '@/lib/ai';
import { getEmbeddingsIndex } from '@/lib/pinecone';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages: originalMessages }: { messages: any[] } = await req.json();

    // Normalização das mensagens (Mantida igual)
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

    // Bypass se não for user (Mantido)
    if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
      const result = await streamText({
        model: chatModel,
        messages,
        maxRetries: 0,
      });
      return result.toTextStreamResponse();
    }

    // --- RAG FLOW ---
    console.log(`🔍 Buscando contexto para: "${lastMessage.content}"`);

    // 1. Gera Embedding
    const embedding = await embeddingModel.getEmbedding(lastMessage.content);

    // 2. Busca no Pinecone
    const index = getEmbeddingsIndex();
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });

    console.log(`📄 Encontrados ${queryResponse.matches.length} matches.`);

    if (queryResponse.matches.length > 0) {
      console.log(`   Top score: ${queryResponse.matches[0].score}`);
      console.log(`   Trecho: ${queryResponse.matches[0].metadata?.text?.slice(0, 100)}...`);
    }

    // Filtro mais permissivo (ou remova o filter completamente para testar)
    const relevantMatches = queryResponse.matches.filter((match) => match.score && match.score > 0.25);

    const context = relevantMatches
      .map((match) => match.metadata?.text)
      .join('\n\n---\n\n');

    console.log(`📚 Contexto final montado (tamanho): ${context.length} caracteres.`);

    // 3. Prompt Ajustado para Debug
    // Mudamos para PROIBIR conhecimento externo se houver contexto, para testar se ele lê o PDF.
    const systemPrompt = context
      ? `
      Você é o DocMind, um assistente técnico especializado.
      
      ⚠️ REGRA CRÍTICA: Responda APENAS com base no contexto abaixo. 
      NÃO use seu conhecimento prévio sobre tecnologias genéricas (como MongoDB, AWS, etc) se não estiver no texto.
      Se a resposta não estiver no contexto, diga: "Desculpe, essa informação não consta na documentação carregada."

      CONTEXTO DO PDF:
      """
      ${context}
      """
    `
      : `
      Você é o DocMind. Não encontrei informações relevantes na documentação sobre esse tema.
      Diga ao usuário que não encontrou a resposta no manual.
    `;

    // 4. Gera resposta
    const result = await streamText({
      model: chatModel,
      system: systemPrompt,
      messages,
      maxRetries: 0,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Erro na rota de chat:', error);
    // ... (restante do tratamento de erro mantido)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 });
  }
}