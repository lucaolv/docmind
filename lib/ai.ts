import { google } from '@ai-sdk/google';

export const chatModel = google('gemini-1.5-flash');

export const embeddingModel = google.textEmbeddingModel('text-embedding-004');