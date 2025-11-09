
import { GoogleGenAI } from "@google/genai";
import { EnrichedData } from '../types';
import { API_KEY } from '../apiKey'; // ИЗМЕНЕНИЕ: Импортируем ключ отсюда

// Declare XLSX to satisfy TypeScript since it's loaded from a CDN.
declare var XLSX: any;

export async function fetchCompanyData(companyName: string): Promise<{ data: EnrichedData | null; sources: { uri: string; title: string; }[] }> {
  if (!API_KEY) { // ИЗМЕНЕНИЕ: Проверяем импортированный ключ
    throw new Error("API_KEY is not set in apiKey.ts file");
  }
  const ai = new GoogleGenAI({ apiKey: API_KEY }); // ИЗМЕНЕНИЕ: Используем импортированный ключ

  const prompt = `For the company "${companyName}", perform a comprehensive web search to find the following information. Please be as thorough as possible.
  
  Your primary goal is to gather a detailed list of contacts.
  
  Required information:
  1.  **website**: The official company website URL.
  2.  **description**: A brief summary of what the company does.
  3.  **revenue**: The latest reported annual revenue or turnover. If an exact figure isn't available, provide an estimate and note it as such.
  4.  **laboratories**: A list of their laboratories. Distinguish between labs confirmed from official sources (like their website or press releases) and those that are presumed to exist based on their line of business or job postings.
  5.  **contacts**: A comprehensive list of contacts within the company and its labs. For each contact, provide their full name, job title, and if available, their email address and phone number. Prioritize contacts in roles like research, development, management, and laboratory staff.
  
  **CRITICAL INSTRUCTION**: Your entire response MUST be a single, valid JSON object. Do not include any text, greetings, markdown formatting like \`\`\`json, or explanations outside of the JSON structure. The JSON object should conform to this structure:
  {
    "website": "string",
    "description": "string",
    "revenue": "string",
    "laboratories": {
      "confirmed": ["string"],
      "presumed": ["string"]
    },
    "contacts": [
      {
        "name": "string",
        "title": "string",
        "email": "string",
        "phone": "string"
      }
    ]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });

  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const sources = groundingMetadata?.groundingChunks
    ?.map((chunk: any) => chunk.web)
    .filter(Boolean)
    .filter((v: any, i: number, a: any[]) => a.findIndex(t => (t.uri === v.uri)) === i) // unique uris
     || [];

  try {
    let text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
      const parsedData: EnrichedData = JSON.parse(text);
      return { data: parsedData, sources };
    } else {
      console.error("No JSON object found in Gemini response:", response.text);
      throw new Error("Invalid response format from AI.");
    }
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    console.error("Raw response text:", response.text);
    throw new Error("Failed to parse AI response. The format was not valid JSON.");
  }
}
