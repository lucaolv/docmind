import { embedMany } from 'ai';
import { getEmbeddingsIndex } from '@/lib/pinecone';
import { embeddingModel } from '@/lib/ai';
import { NextResponse } from 'next/server';

const dummyData = [
  "O TypeScript é um superset do JavaScript.",
  "O Next.js é um framework React.",
  "O Google Gemini é uma IA multimodal.",
  "RAG significa Retrieval-Augmented Generation.",
];

export async function GET() {
  try {
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: dummyData,
    });

    const vectors = embeddings.map((vector, i) => ({
      id: `id-${i}`,
      values: vector,
      metadata: {
        text: dummyData[i],
      },
    }));

    const index = getEmbeddingsIndex();
    await index.upsert(vectors);

    return NextResponse.json({
      message: 'Seed realizado com sucesso!',
      count: vectors.length
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao processar seed' }, { status: 500 });
  }
}