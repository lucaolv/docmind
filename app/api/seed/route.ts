import { getEmbeddingsIndex } from '@/lib/pinecone';
import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';
import { parsePDF, chunkText } from '@/lib/processing';
import fs from 'fs';
import path from 'path';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const embedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-mpnet-base-v2',
      inputs: text,
    });
    return embedding as number[];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'manual.pdf');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Arquivo manual.pdf não encontrado na pasta public' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const text = await parsePDF(fileBuffer);

    const chunks = chunkText(text);

    console.log(`Gerando embeddings para ${chunks.length} chunks...`);

    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const vector = await getEmbedding(chunk);
        return { chunk, vector };
      })
    );

    const vectors = embeddings.map((item, i) => ({
      id: `manual-chunk-${i}`,
      values: item.vector,
      metadata: {
        text: item.chunk,
        source: 'manual.pdf',
      },
    }));

    const index = getEmbeddingsIndex();

    // Pinecone recomenda batchs de 100 em 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }

    return NextResponse.json({
      message: 'Documento indexado com sucesso!',
      chunks: vectors.length
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao processar documento',
      details: (error as Error).message
    }, { status: 500 });
  }
}