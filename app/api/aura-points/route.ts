import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import { FACTOR_WEIGHTS } from "@/lib/auraPoints";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Build the factor descriptions for the GPT prompt
const factorPrompt = Object.entries(FACTOR_WEIGHTS)
  .map(([key, val]) => `  "${key}": { "score": <0 to ${val.max}>, "description": "<1 sentence why>" }`)
  .join(",\n");

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are the Aura Atlas environmental wellness scanner. Analyze the provided image of an indoor space and evaluate how beneficial it is for mental wellness, focus, and calming energy.

Score each environmental factor on a scale from 0 to its maximum. Higher = better for wellness.

Return ONLY a JSON object with this exact structure:
{
  "factors": {
${factorPrompt}
  },
  "summary": "<2-3 word vibe label, e.g. 'Warm Sanctuary' or 'Sterile Buzzkill'>",
  "recommendation": "<1 actionable sentence to improve this space's aura>"
}

Scoring guidelines:
- natural_lighting (max 150): Abundant natural sunlight = high. Dark/no windows = low.
- artificial_light (max 80): Warm, diffused lighting = high. Harsh fluorescent = low.
- plants_greenery (max 120): Visible plants/biophilic elements = high. None = 0.
- natural_materials (max 60): Wood, stone, natural textiles = high. All plastic/synthetic = low.
- noise_level (max 120): Quiet/peaceful = high. Visually noisy/chaotic = low.
- clutter (max 100): Clean, organized = high. Messy, cluttered = low.
- openness (max 80): Spacious, good flow = high. Cramped = low.
- color_palette (max 100): Warm earth tones, nature colors = high. Harsh/cold/sterile = low.
- temperature_feel (max 90): Looks comfortable/cozy = high. Looks too hot/cold = low.
- water_elements (max 50): Water features, aquariums = high. None = 0.
- personal_touches (max 50): Art, photos, personality = high. Generic/institutional = low.

Be honest and specific. A typical dorm room might score 400-550. A spa might score 800+. A fluorescent office might score 200-350.`
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message?.content || "{}");
    return NextResponse.json(result);

  } catch (error) {
    console.error("Aura Points Analysis Error:", error);
    return NextResponse.json({ error: "Failed to analyze environment" }, { status: 500 });
  }
}
