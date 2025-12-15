import { createGroq } from '@ai-sdk/groq';
import { HfInference } from '@huggingface/inference';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const chatModel = groq('llama-3.3-70b-versatile');

// Para embeddings, usamos HuggingFace
export const embeddingModel = {
  getEmbedding: async (text: string): Promise<number[]> => {
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
  },
};