// ── Aura Points Scoring Algorithm ──────────────────────────────────
// Evaluates indoor environments for mental wellness on a 0–1000 scale.

export interface EnvironmentFactor {
  name: string;
  score: number;       // Points awarded (negative = detrimental)
  maxScore: number;    // Maximum possible for this factor
  icon: string;
  description: string;
  category: 'lighting' | 'biophilic' | 'acoustic' | 'spatial' | 'thermal' | 'chromatic';
}

export interface AuraPointsResult {
  totalScore: number;
  maxPossible: number;
  grade: string;
  gradeColor: string;
  factors: EnvironmentFactor[];
  summary: string;
  recommendation: string;
  timestamp: number;
}

// Grade thresholds
export function getAuraGrade(score: number): { grade: string; color: string } {
  if (score >= 850) return { grade: 'S+', color: '#a855f7' };   // Purple - Sanctuary
  if (score >= 700) return { grade: 'A',  color: '#10b981' };   // Emerald - Excellent
  if (score >= 550) return { grade: 'B',  color: '#14b8a6' };   // Teal - Good
  if (score >= 400) return { grade: 'C',  color: '#f59e0b' };   // Amber - Moderate
  if (score >= 250) return { grade: 'D',  color: '#f97316' };   // Orange - Poor
  return { grade: 'F', color: '#ef4444' };                       // Red - Hostile
}

// Smile Score reward based on scanned environment quality
export function getSmileScoreReward(auraScore: number): number {
  if (auraScore >= 850) return 75;  // Sanctuary bonus
  if (auraScore >= 700) return 50;
  if (auraScore >= 550) return 35;
  if (auraScore >= 400) return 25;
  return 15; // Still reward for scanning, even bad environments
}

// Factor weight configuration for the GPT prompt
export const FACTOR_WEIGHTS = {
  natural_lighting:  { max: 150, icon: '☀️', category: 'lighting'  as const },
  artificial_light:  { max: 80,  icon: '💡', category: 'lighting'  as const },
  plants_greenery:   { max: 120, icon: '🌿', category: 'biophilic' as const },
  natural_materials: { max: 60,  icon: '🪵', category: 'biophilic' as const },
  noise_level:       { max: 120, icon: '🔇', category: 'acoustic'  as const },
  clutter:           { max: 100, icon: '📦', category: 'spatial'   as const },
  openness:          { max: 80,  icon: '🏛️', category: 'spatial'   as const },
  color_palette:     { max: 100, icon: '🎨', category: 'chromatic' as const },
  temperature_feel:  { max: 90,  icon: '🌡️', category: 'thermal'  as const },
  water_elements:    { max: 50,  icon: '💧', category: 'biophilic' as const },
  personal_touches:  { max: 50,  icon: '🖼️', category: 'spatial'   as const },
} as const;

export const MAX_AURA_SCORE = Object.values(FACTOR_WEIGHTS).reduce((sum, f) => sum + f.max, 0); // 1000
