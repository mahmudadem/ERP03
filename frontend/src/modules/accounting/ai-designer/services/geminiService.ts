import { GoogleGenAI, Type } from "@google/genai";

// Use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const journalSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      account: { type: Type.STRING },
      notes: { type: Type.STRING },
      debit: { type: Type.NUMBER },
      credit: { type: Type.NUMBER },
      category: { type: Type.STRING }
    },
  },
};

export const generateJournalSuggestion = async (promptText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert accountant system. 
      Generate a valid JSON array of accounting entries based on this description: "${promptText}".
      Ensure Debits equal Credits.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: journalSchema,
      },
    });
    
    return response.text || "[]";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "[]";
  }
};

export const analyzeImageForJournal = async (base64Image: string): Promise<string> => {
  try {
    // Remove header if present (e.g., "data:image/png;base64,")
    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG or JPEG, Gemini handles standard image types well
              data: cleanBase64
            }
          },
          {
            text: "Extract the accounting journal data from this image. Return a JSON array where each row represents a transaction line. Identify Account names, Descriptions (notes), Debit amounts, and Credit amounts. If a column is missing, infer it or leave 0."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: journalSchema,
      }
    });

    return response.text || "[]";
  } catch (error) {
    console.error("Gemini Vision API Error:", error);
    return "[]";
  }
};