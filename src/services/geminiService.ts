import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ColorCurve } from "../types";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const curveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    r: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.NUMBER },
          value: { type: Type.NUMBER },
        },
      },
    },
    g: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.NUMBER },
          value: { type: Type.NUMBER },
        },
      },
    },
    b: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.NUMBER },
          value: { type: Type.NUMBER },
        },
      },
    },
    a: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.NUMBER },
          value: { type: Type.NUMBER },
        },
      },
    },
  },
  required: ["r", "g", "b", "a"],
};

export async function generateCurve(prompt: string): Promise<ColorCurve> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an expert colorist and VFX artist. Generate a beautiful color curve over time (0.0 to 1.0) for this description: "${prompt}".
               Use between 3 and 8 keyframes per channel (R, G, B, A) to create a smooth, stylized color transition/gradient.
               Time MUST be exclusively between 0.0 and 1.0, strictly increasing from first to last point. (e.g. 0.0, 0.25, 0.8, 1.0).
               Values can be between 0.0 and 2.0 (for HDR brightness, >1 is bloom/glow).
               Return ONLY the JSON struct matching the schema, with real keyframes. Avoid returning completely flat lines unless absolutely necessary.
               Usually it's good to have keyframes at time 0.0 and time 1.0 to anchor the curve.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: curveSchema,
      temperature: 0.7,
    },
  });

  return JSON.parse(response.text!);
}

const libraryCurveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    category: { type: Type.STRING },
    curve: curveSchema
  },
  required: ["name", "category", "curve"]
};

export async function generateCurveBatch(prompt: string, variance: string, count: number, baseCurve?: ColorCurve): Promise<{name: string, category: string, curve: ColorCurve}[]> {
  const baseCurveStr = baseCurve ? `\nCRITICAL: The FIRST curve (index 0) in your response array MUST exactly match this base curve data: ${JSON.stringify(baseCurve)}. Use this as the starting anchor for your sweep.` : "";
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an expert colorist and VFX artist. Generate a batch of ${count} distinct color curves over time (0.0 to 1.0) for this base scenario: "${prompt}".
               Crucially, apply this intentional sweep or variance across the set: "${variance}".${baseCurveStr}
               For example, if the variance is "intensity from ember to supernova", the first curve should be dim and the last should be extremely bright/HDR.
               Use between 3 and 8 keyframes per channel (R, G, B, A) per curve.
               Assign a short creative name to each variant.
               Keep the "category" string EXACTLY the same for all curves in this batch, as a thematic group name.
               Time MUST be exclusively between 0.0 and 1.0, strictly increasing from first to last point per curve.
               Values can be between 0.0 and 2.0.
               Return ONLY the JSON array matching the schema.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: libraryCurveSchema },
      temperature: 0.8,
    },
  });

  return JSON.parse(response.text!);
}
