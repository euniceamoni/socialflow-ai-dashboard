export class GeminiServiceError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
  }
}

export async function analyzeImage(
  imageData: string,
  mimeType = 'image/jpeg',
  context?: string,
): Promise<string> {
  throw new GeminiServiceError('Gemini API key not configured', 'NOT_CONFIGURED');
}
