// DEMO ONLY - remove before production
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Mood } from "@/lib/types";

const MOODS: Mood[] = ["Happy", "Calm", "Neutral", "Stressed", "Sad", "Overwhelmed"];

const CITY_DATA: Record<string, {
  latRange: [number, number];
  lngRange: [number, number];
  campuses: string[];
}> = {
  "Philadelphia": {
    latRange: [39.93, 39.97],
    lngRange: [-75.20, -75.13],
    campuses: ["Temple University", "Drexel University", "University of Pennsylvania", "Jefferson University"],
  },
  "New York City": {
    latRange: [40.70, 40.75],
    lngRange: [-74.02, -73.97],
    campuses: ["NYU", "Columbia University", "Fordham University", "The New School"],
  },
  "Los Angeles": {
    latRange: [34.02, 34.07],
    lngRange: [-118.27, -118.22],
    campuses: ["UCLA", "USC", "LMU", "Cal State LA"],
  },
  "Chicago": {
    latRange: [41.86, 41.90],
    lngRange: [-87.65, -87.60],
    campuses: ["University of Chicago", "Northwestern University", "DePaul University", "Loyola University Chicago"],
  },
  "Houston": {
    latRange: [29.74, 29.78],
    lngRange: [-95.40, -95.35],
    campuses: ["Rice University", "University of Houston", "Texas Southern University"],
  },
};

const CITIES = Object.keys(CITY_DATA);

// Mood distribution: ~30% happy/calm, ~25% neutral, ~25% stressed, ~20% sad/overwhelmed
const MOOD_WEIGHTS: [Mood, number][] = [
  ["Happy", 17],
  ["Calm", 13],
  ["Neutral", 25],
  ["Stressed", 25],
  ["Sad", 12],
  ["Overwhelmed", 8],
];

function weightedMood(): Mood {
  const total = MOOD_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [mood, weight] of MOOD_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) return mood;
  }
  return "Neutral";
}

function randInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Idempotent: delete previous seed data
  await supabase.from("checkins").delete().eq("anonymous_message", "DEMO_SEED");

  const rows = [];
  for (let i = 0; i < 50; i++) {
    const city = CITIES[i % CITIES.length];
    const { latRange, lngRange, campuses } = CITY_DATA[city];
    const mood = weightedMood();
    const lat = randInRange(latRange[0], latRange[1]);
    const lng = randInRange(lngRange[0], lngRange[1]);
    const campus_name = campuses[Math.floor(Math.random() * campuses.length)];

    rows.push({
      city,
      mood,
      weight: parseFloat((Math.random() * 0.7 + 0.3).toFixed(2)),
      lat,
      lng,
      campus_name,
      user_id: "00000000-0000-0000-0000-000000000001",
      anonymous_message: "DEMO_SEED",
      created_at: new Date(Date.now() - Math.random() * 86_400_000).toISOString(),
    });
  }

  const { error } = await supabase.from("checkins").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length, message: "Demo data seeded successfully" });
}
