import { Pinecone } from '@pinecone-database/pinecone';

const pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX_NAME = process.env.PINECONE_INDEX_NAME!;

export const getPineconeClient = () => {
  return pineconeClient;
};

export const getEmbeddingsIndex = () => {
  return pineconeClient.Index(INDEX_NAME);
};