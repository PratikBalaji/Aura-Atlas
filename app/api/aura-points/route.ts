import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import { FACTOR_WEIGHTS } from "@/lib/auraPoints";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Build the factor descriptions for the indoor prompt
const factorPrompt = Object.entries(FACTOR_WEIGHTS)
  .map(([key, val]) => `    "${key}": { "score": <0 to ${val.max}>, "description": "<1 sentence why>" }`)
  .join(",\n");

// Charlottesville, VA bounding box (rough)
const UVA_BOUNDS = {
  latMin: 38.00, latMax: 38.07,
  lonMin: -78.52, lonMax: -78.44,
};

function resolveLocationContext(lat: number | null, lon: number | null): { campus: string; confidence: string } {
  if (lat != null && lon != null) {
    if (lat >= UVA_BOUNDS.latMin && lat <= UVA_BOUNDS.latMax &&
        lon >= UVA_BOUNDS.lonMin && lon <= UVA_BOUNDS.lonMax) {
      return { campus: "UVA", confidence: "high" };
    }
    return { campus: "Unknown", confidence: "high" };
  }
  // No location — vision-only fallback (let GPT infer from visual cues)
  return { campus: "Unknown", confidence: "low" };
}

const SYSTEM_PROMPT = `You are an AI vision system integrated into a real-time AR scanning application called Aura Atlas.

CRITICAL:
- DO NOT block, delay, or wait for location data.
- DO NOT modify or replace any existing UI labels or classifications already generated.
- Your role is to ADD structured intelligence on top of the current system.

---

STEP 0: LOCATION HANDLING (NON-BLOCKING)

You will receive a "locationContext" in the user message with:
- "campus": "UVA" | "Unknown"
- "confidence": "high" | "low"

Rules:
- NEVER assume location is required
- If campus is "Unknown" with low confidence, still proceed using ONLY visual analysis
- If campus is "UVA", use that context to improve building identification
- Include the locationContext in your response as-is

---

STEP 1: SCENE CLASSIFICATION

Classify the image into exactly ONE:
- "indoor" — any interior space
- "building_exterior" — exterior view of a building

---

STEP 2: If "indoor" → AURA SYSTEM (DO NOT MODIFY EXISTING OUTPUT)

Return ONLY additional structured data:
{
  "type": "aura",
  "locationContext": { "campus": "...", "confidence": "..." },
  "features": {
    "lighting": <0-100>,
    "cleanliness": <0-100>,
    "spaciousness": <0-100>,
    "colorWarmth": <0-100>,
    "calmness": <0-100>,
    "aesthetic": <0-100>
  },
  "explanation": "short, natural explanation of why this space feels this way",
  "factors": {
${factorPrompt}
  },
  "summary": "<2-3 word vibe label, e.g. 'Cozy Retreat' or 'Sterile Buzzkill'>",
  "recommendation": "<1 actionable sentence to improve this space's aura>"
}

Indoor factor scoring guidelines:
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

Be honest and specific. A typical dorm room might score 400-550. A spa might score 800+.

---

STEP 3: If "building_exterior" → SMILEY + MOOD SYSTEM

Identify if the building resembles:
- Olsson Hall → traditional academic, structured engineering building (brick, columns)
- Rice Hall → modern glass-heavy computer science building (glass facade, contemporary)
- Otherwise → "Unknown UVA Building" (if locationContext.campus is "UVA") or "Unknown Building"

Return:
{
  "type": "building",
  "locationContext": { "campus": "...", "confidence": "..." },
  "buildingName": "Olsson Hall" | "Rice Hall" | "Unknown UVA Building" | "Unknown Building",
  "smileyScore": <0-100>,
  "smileyEmoji": <one of "😄" "🙂" "😐" "😕" "😞">,
  "moodScore": <0-100>,
  "moodEmoji": <one of "😄" "🙂" "😐" "😕" "😞">,
  "attributes": {
    "architecture": <0-100>,
    "modernity": <0-100>,
    "activityLevel": <0-100>,
    "maintenance": <0-100>,
    "openness": <0-100>
  },
  "vibe": "short phrase like 'innovative and energetic' or 'academic and structured'",
  "reasoning": "brief explanation of visual cues (glass, symmetry, students, lighting, etc.)"
}

Building scoring guidelines:
- Rice Hall: High modernity, glass, openness. smileyScore 85-95, moodScore 75-90. Vibe: "innovative", "tech-driven", "energetic".
- Olsson Hall: More traditional, structured, academic. smileyScore 70-82, moodScore 65-75. Vibe: "focused", "academic", "structured".
- Unknown UVA Building: Estimate based on visual features. Keep scores realistic (60-85 range).
- Unknown Building: Score honestly based on what you see.

---

IMPORTANT RULES:
- ALWAYS return a result — NEVER fail due to missing location
- Keep responses concise and consistent
- DO NOT remove or overwrite existing labels like "Cozy Retreat"
- ADD data only
- OUTPUT STRICTLY AS CLEAN JSON`;

export async function POST(req: Request) {
  try {
    const { imageBase64, latitude, longitude } = await req.json();

    // Step 0: Non-blocking location resolution
    const locationContext = resolveLocationContext(
      latitude ?? null,
      longitude ?? null
    );

    const locationHint = latitude != null && longitude != null
      ? `User location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      : "User location: unavailable (proceed with visual-only analysis)";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${locationHint}\nlocationContext: ${JSON.stringify(locationContext)}\n\nAnalyze this image:`
            },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message?.content || "{}");

    // Ensure locationContext is always present in response
    if (!result.locationContext) {
      result.locationContext = locationContext;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Aura Points Analysis Error:", error);
    return NextResponse.json({ error: "Failed to analyze environment" }, { status: 500 });
  }
}
