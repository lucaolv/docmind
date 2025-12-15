import { getEmbeddingsIndex } from '@/lib/pinecone';
import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const dummyData = [
  "O TypeScript é um superset do JavaScript.",
  "O Next.js é um framework React.",
  "O Groq oferece inferência rápida.",
  "RAG significa Retrieval-Augmented Generation.",
];

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const embedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-mpnet-base-v2',
      inputs: text,
    });

    return embedding as number[];
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}

export async function GET() {
  try {
    // Gera embeddings para todos os dados
    const embeddings = await Promise.all(
      dummyData.map(text => getEmbedding(text))
    );

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
    return NextResponse.json({ error: 'Erro ao processar seed', details: (error as Error).message }, { status: 500 });
  }
}