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
    campuses: ["Temple University", "Drexel University", "University of Pennsylvania"],
  },
  "New York City": {
    latRange: [40.70, 40.75],
    lngRange: [-74.02, -73.97],
    campuses: ["New York University", "Columbia University", "City College of New York"],
  },
  "Los Angeles": {
    latRange: [34.02, 34.07],
    lngRange: [-118.27, -118.22],
    campuses: ["University of California, Los Angeles", "University of Southern California", "Loyola Marymount University"],
  },
  "Chicago": {
    latRange: [41.86, 41.90],
    lngRange: [-87.65, -87.60],
    campuses: ["University of Chicago", "Northwestern University", "University of Illinois Chicago"],
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

async function insertRowsWithSchemaFallback(
  supabase: { from: (...args: any[]) => any },
  rows: Array<Record<string, unknown>>
) {
  if (rows.length === 0) {
    return { error: null, insertedColumns: [] as string[] };
  }

  const payloadRows = rows.map((row) => ({ ...row }));
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase.from("checkins").insert(payloadRows);
    if (!error) {
      return { error: null, insertedColumns: removedColumns };
    }

    const missingColumn = error.message?.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missingColumn) {
      return { error, insertedColumns: removedColumns };
    }

    const hasColumn = payloadRows.some((row) => missingColumn in row);
    if (!hasColumn) {
      return { error, insertedColumns: removedColumns };
    }

    removedColumns.push(missingColumn);
    payloadRows.forEach((row) => {
      delete row[missingColumn];
    });
  }

  return {
    error: new Error("Demo seed failed after schema fallback attempts."),
    insertedColumns: removedColumns,
  };
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Idempotent: delete previous seed data
  await supabase.from("checkins").delete().eq("message", "DEMO_SEED");

  const rows = [];
  for (let i = 0; i < 50; i++) {
    const city = CITIES[i % CITIES.length];
    const { latRange, lngRange, campuses } = CITY_DATA[city];
    const mood = weightedMood();
    const lat = randInRange(latRange[0], latRange[1]);
    const lng = randInRange(lngRange[0], lngRange[1]);
    const campus_name = campuses[i % campuses.length];
    rows.push({
      id: crypto.randomUUID(),
      city,
      mood,
      lat,
      lng,
      campus_name,
      message: "DEMO_SEED",
      timestamp: Date.now() - Math.floor(Math.random() * 86_400_000),
      hugs: 0,
    });
  }

  const { error, insertedColumns } = await insertRowsWithSchemaFallback(supabase, rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: rows.length,
    message: "Demo data seeded successfully",
    removedOptionalColumns: insertedColumns,
  });
}
