import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface CollegeMoodSummary {
  id: string;
  name: string;
  city: string;
  checkin_count_24h: number;
  checkin_count_7d: number;
  mood_distribution: Record<string, number>; // mood label → count
  crisis_score: number; // 0–1, fraction of distressed moods in last 24h
  is_crisis: boolean;
  dominant_mood: string;
  trend_direction: "up" | "down" | "stable"; // comparing 24h vs prior 24h
}

const DISTRESS_MOODS = new Set(["Stressed", "Sad", "Overwhelmed"]);

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch all colleges
  const { data: colleges, error: collegeErr } = await supabase
    .from("colleges")
    .select("id, name, city")
    .order("name");

  if (collegeErr) {
    return NextResponse.json({ error: collegeErr.message }, { status: 500 });
  }

  if (!colleges?.length) {
    return NextResponse.json({ campuses: [] });
  }

  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all recent checkins grouped by city (campus_name col may not exist)
  const { data: checkins24h, error: err24 } = await supabase
    .from("checkins")
    .select("city, mood, created_at")
    .gte("created_at", ago24h);

  const { data: checkins7d, error: err7 } = await supabase
    .from("checkins")
    .select("city, mood, created_at")
    .gte("created_at", ago7d);

  if (err24 || err7) {
    const msg = err24?.message ?? err7?.message ?? "unknown";
    console.error("[counselor] checkins query failed:", msg);
    return NextResponse.json({ error: `Failed to fetch checkins: ${msg}` }, { status: 500 });
  }

  // Also fetch "prior 24h" (48h–24h ago) for trend direction
  const { data: checkinsPrior } = await supabase
    .from("checkins")
    .select("city, mood")
    .gte("created_at", ago48h)
    .lt("created_at", ago24h);

  // Index by city
  const buckets24h: Record<string, { mood: string }[]> = {};
  const buckets7d: Record<string, { mood: string }[]> = {};
  const bucketsPrior: Record<string, { mood: string }[]> = {};

  for (const c of checkins24h ?? []) {
    if (!c.city) continue;
    (buckets24h[c.city] ??= []).push({ mood: c.mood });
  }
  for (const c of checkins7d ?? []) {
    if (!c.city) continue;
    (buckets7d[c.city] ??= []).push({ mood: c.mood });
  }
  for (const c of checkinsPrior ?? []) {
    if (!c.city) continue;
    (bucketsPrior[c.city] ??= []).push({ mood: c.mood });
  }

  const campuses: CollegeMoodSummary[] = colleges.map((college) => {
    // Match checkins to college by city
    const rows24 = buckets24h[college.city] ?? [];
    const rows7d = buckets7d[college.city] ?? [];
    const rowsPrior = bucketsPrior[college.city] ?? [];

    // Mood distribution (24h)
    const dist: Record<string, number> = {};
    for (const r of rows24) {
      dist[r.mood] = (dist[r.mood] ?? 0) + 1;
    }

    // Crisis score: fraction of distressed moods in last 24h
    const distressCount = rows24.filter((r) => DISTRESS_MOODS.has(r.mood)).length;
    const crisis_score = rows24.length > 0 ? distressCount / rows24.length : 0;
    const is_crisis = crisis_score >= 0.6 && rows24.length >= 3;

    // Dominant mood
    const dominant_mood =
      Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Neutral";

    // Trend: compare distress rate now vs prior 24h
    const priorDistress = rowsPrior.filter((r) => DISTRESS_MOODS.has(r.mood)).length;
    const priorRate = rowsPrior.length > 0 ? priorDistress / rowsPrior.length : 0;
    let trend_direction: "up" | "down" | "stable" = "stable";
    if (crisis_score - priorRate > 0.1) trend_direction = "up";
    else if (priorRate - crisis_score > 0.1) trend_direction = "down";

    return {
      id: college.id,
      name: college.name,
      city: college.city,
      checkin_count_24h: rows24.length,
      checkin_count_7d: rows7d.length,
      mood_distribution: dist,
      crisis_score: parseFloat(crisis_score.toFixed(2)),
      is_crisis,
      dominant_mood,
      trend_direction,
    };
  });

  // Sort: crisis campuses first, then by distress score desc
  campuses.sort((a, b) => {
    if (a.is_crisis !== b.is_crisis) return a.is_crisis ? -1 : 1;
    return b.crisis_score - a.crisis_score;
  });

  return NextResponse.json({ campuses });
}
