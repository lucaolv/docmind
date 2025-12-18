// Use 'require' para a versão 1.1.1 do pdf-parse
const pdf = require('pdf-parse');

export async function parsePDF(buffer: Buffer): Promise<string> {
  // A versão 1.1.1 retorna um objeto onde .text é o conteúdo
  const data = await pdf(buffer);
  return data.text;
}

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  // Remove espaços excessivos
  const cleanText = text.replace(/\s+/g, ' ').trim();

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    const end = start + chunkSize;
    let chunk = cleanText.slice(start, end);

    // Lógica para não cortar palavras no meio
    if (end < cleanText.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > -1) {
        chunk = chunk.slice(0, lastSpace);
        start += chunk.length - overlap;
      } else {
        start += chunkSize - overlap;
      }
    } else {
      start = cleanText.length;
    }

    chunks.push(chunk);
  }

  return chunks;
}