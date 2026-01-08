import { NextResponse } from 'next/server';
import { parsePDF, chunkText } from '@/lib/processing';
import { embeddingModel } from '@/lib/ai';
import { getEmbeddingsIndex } from '@/lib/pinecone';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    console.log(`📥 Processando arquivo: ${file.name}`);

    // 1. Converte o arquivo para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extrai texto e divide em chunks
    const text = await parsePDF(buffer);
    const chunks = chunkText(text);

    console.log(`📄 Texto extraído. Gerando embeddings para ${chunks.length} partes...`);

    // 3. Gera Embeddings e salva no Pinecone em Lotes
    const index = getEmbeddingsIndex();
    const batchSize = 50; // Lotes menores para evitar timeout em PDFs grandes

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);

      const vectors = await Promise.all(
        batchChunks.map(async (chunk, idx) => {
          const vector = await embeddingModel.getEmbedding(chunk);
          return {
            id: `${file.name}-${Date.now()}-${i + idx}`, // ID único
            values: vector,
            metadata: {
              text: chunk,
              source: file.name
            }
          };
        })
      );

      await index.upsert(vectors);
      console.log(`✅ Lote ${i / batchSize + 1} salvo no Pinecone.`);
    }

    return NextResponse.json({ success: true, count: chunks.length, filename: file.name });

  } catch (error: any) {
    console.error('Erro na ingestão:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}