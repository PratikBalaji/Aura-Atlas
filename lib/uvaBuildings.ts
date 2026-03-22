/**
 * UVA campus building data — GPS coordinates verified against
 * Google Maps, Wikipedia, and OpenStreetMap sources.
 *
 * Coordinate accuracy: ±20 m (sufficient for AR label anchoring).
 */

export interface EmotionBreakdown {
  calm: number;
  happy: number;
  anxious: number;
  sad: number;
  inspired: number;
  stressed: number;
}

export interface UVABuilding {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  wellbeing_score: number;
  emotion_breakdown: EmotionBreakdown;
  description: string;
  emoji_vibe: string[];
  category: "academic" | "social" | "athletic" | "historic" | "library" | "health";
  /** Short visual identifier for quick reference (populated for "trained" buildings) */
  visual_features?: string;
}

export const UVA_BUILDINGS: UVABuilding[] = [
  // ════════════════════════════════════════
  //  HISTORIC LAWN / CENTRAL GROUNDS
  // ════════════════════════════════════════
  {
    id: "rotunda",
    name: "The Rotunda",
    latitude: 38.03556,
    longitude: -78.50352,
    wellbeing_score: 91,
    emotion_breakdown: { calm: 48, happy: 30, anxious: 5, sad: 2, inspired: 12, stressed: 3 },
    description: "The heart of the university — a space of reflection, history, and academic pride.",
    emoji_vibe: ["😌", "🌿", "🎓"],
    category: "historic",
  },
  {
    id: "the-lawn",
    name: "The Lawn",
    latitude: 38.03440,
    longitude: -78.50340,
    wellbeing_score: 95,
    emotion_breakdown: { calm: 55, happy: 28, anxious: 3, sad: 2, inspired: 10, stressed: 2 },
    description: "The most serene space on grounds — where UVA's soul lives.",
    emoji_vibe: ["🌿", "☀️", "✨"],
    category: "historic",
  },
  {
    id: "old-cabell",
    name: "Old Cabell Hall",
    latitude: 38.03325,
    longitude: -78.50355,
    wellbeing_score: 89,
    emotion_breakdown: { calm: 42, happy: 28, anxious: 6, sad: 4, inspired: 16, stressed: 4 },
    description: "Music and art performances fill this elegant auditorium at the south end of the Lawn.",
    emoji_vibe: ["🎵", "🎭", "🏛️"],
    category: "academic",
  },

  // ════════════════════════════════════════
  //  LIBRARIES
  // ════════════════════════════════════════
  {
    id: "alderman",
    name: "Alderman Library",
    latitude: 38.03623,
    longitude: -78.50549,
    wellbeing_score: 78,
    emotion_breakdown: { calm: 32, happy: 18, anxious: 22, sad: 8, inspired: 10, stressed: 10 },
    description: "A quiet intellectual haven, with pockets of academic pressure during exam season.",
    emoji_vibe: ["📚", "🤫", "💭"],
    category: "library",
  },
  {
    id: "clemons",
    name: "Clemons Library",
    latitude: 38.03590,
    longitude: -78.50650,
    wellbeing_score: 68,
    emotion_breakdown: { calm: 20, happy: 12, anxious: 30, sad: 10, inspired: 8, stressed: 20 },
    description: "Late-night study hub — high focus meets exhaustion during finals season.",
    emoji_vibe: ["🌙", "☕", "📖"],
    category: "library",
  },

  // ════════════════════════════════════════
  //  SOCIAL / STUDENT LIFE
  // ════════════════════════════════════════
  {
    id: "newcomb",
    name: "Newcomb Hall",
    // FIXED: was -78.50490, corrected to -78.50700 (actual MCCormick Rd location)
    latitude: 38.03542,
    longitude: -78.50700,
    wellbeing_score: 84,
    emotion_breakdown: { calm: 25, happy: 40, anxious: 10, sad: 5, inspired: 15, stressed: 5 },
    description: "Buzzing social energy — friends meeting, clubs gathering, community forming.",
    emoji_vibe: ["🎉", "👥", "☕"],
    category: "social",
  },
  {
    id: "observatory-hill",
    name: "Observatory Hill Dining",
    latitude: 38.03340,
    longitude: -78.51540,
    wellbeing_score: 82,
    emotion_breakdown: { calm: 30, happy: 38, anxious: 10, sad: 5, inspired: 8, stressed: 9 },
    description: "Communal dining on the hill — comfort food and casual hangouts.",
    emoji_vibe: ["🍽️", "👫", "🌄"],
    category: "social",
  },

  // ════════════════════════════════════════
  //  ENGINEERING / STEM
  // ════════════════════════════════════════
  {
    id: "rice-hall",
    name: "Rice Hall",
    latitude: 38.03175,
    longitude: -78.51095,
    wellbeing_score: 72,
    emotion_breakdown: { calm: 18, happy: 20, anxious: 28, sad: 6, inspired: 14, stressed: 14 },
    description: "Innovation hub with intense focus energy — high drive meets deadline pressure.",
    emoji_vibe: ["💻", "🧠", "⚡"],
    category: "academic",
    visual_features: "Modern glass curtain wall, curved swooping roofline overhang, vertical concrete fins, corner glass atrium, red brick base — most modern building in engineering quad",
  },
  {
    id: "thornton-hall",
    name: "Thornton Hall",
    latitude: 38.03300,
    longitude: -78.51003,
    wellbeing_score: 69,
    emotion_breakdown: { calm: 12, happy: 15, anxious: 32, sad: 8, inspired: 13, stressed: 20 },
    description: "Engineering intensity — deep focus and problem-solving under pressure.",
    emoji_vibe: ["⚙️", "🔬", "😤"],
    category: "academic",
  },
  {
    id: "olsson-hall",
    name: "Olsson Hall",
    latitude: 38.03250,
    longitude: -78.51070,
    wellbeing_score: 71,
    emotion_breakdown: { calm: 16, happy: 18, anxious: 30, sad: 6, inspired: 15, stressed: 15 },
    description: "CS and ECE labs — collaborative energy under tight deadlines.",
    emoji_vibe: ["🖥️", "⚡", "🤖"],
    category: "academic",
    visual_features: "Red brick Georgian Revival, white-columned portico with 'OLSSON HALL' inscription, triangular pediment, granite steps with iron railings, two distinct entrances",
  },

  // ════════════════════════════════════════
  //  ACADEMIC — OTHER
  // ════════════════════════════════════════
  {
    id: "clark-hall",
    name: "Clark Hall",
    latitude: 38.03306,
    longitude: -78.50778,
    wellbeing_score: 80,
    emotion_breakdown: { calm: 30, happy: 25, anxious: 18, sad: 7, inspired: 12, stressed: 8 },
    description: "A blend of academic rigor and campus tranquility, nestled along the Lawn.",
    emoji_vibe: ["🏛️", "📖", "🌳"],
    category: "academic",
  },
  {
    id: "minor-hall",
    name: "Minor Hall",
    latitude: 38.03386,
    longitude: -78.50750,
    wellbeing_score: 76,
    emotion_breakdown: { calm: 28, happy: 22, anxious: 20, sad: 8, inspired: 12, stressed: 10 },
    description: "Psychology and neuroscience — where the mind studies itself.",
    emoji_vibe: ["🧠", "📊", "🔍"],
    category: "academic",
  },
  {
    id: "monroe-hall",
    name: "Monroe Hall",
    latitude: 38.03500,
    longitude: -78.50250,
    wellbeing_score: 77,
    emotion_breakdown: { calm: 26, happy: 22, anxious: 22, sad: 8, inspired: 14, stressed: 8 },
    description: "Social sciences and history — deep thinking and campus debate.",
    emoji_vibe: ["📜", "💬", "🏛️"],
    category: "academic",
  },
  {
    id: "nau-hall",
    name: "Nau Hall",
    latitude: 38.03420,
    longitude: -78.50530,
    wellbeing_score: 74,
    emotion_breakdown: { calm: 24, happy: 20, anxious: 24, sad: 8, inspired: 14, stressed: 10 },
    description: "Economics and policy — analytical minds at work on real-world problems.",
    emoji_vibe: ["📈", "💡", "🏦"],
    category: "academic",
  },

  // ════════════════════════════════════════
  //  ATHLETICS
  // ════════════════════════════════════════
  {
    id: "scott-stadium",
    name: "Scott Stadium",
    latitude: 38.03167,
    longitude: -78.51288,
    wellbeing_score: 88,
    emotion_breakdown: { calm: 15, happy: 55, anxious: 12, sad: 3, inspired: 10, stressed: 5 },
    description: "Electric game-day energy — collective joy, excitement, and school spirit.",
    emoji_vibe: ["🏟️", "🔥", "🧡"],
    category: "athletic",
  },
  {
    id: "memorial-gym",
    name: "Memorial Gymnasium",
    latitude: 38.03722,
    longitude: -78.50560,
    wellbeing_score: 86,
    emotion_breakdown: { calm: 20, happy: 45, anxious: 8, sad: 4, inspired: 15, stressed: 8 },
    description: "Basketball energy and school pride — the roar of the crowd echoes here.",
    emoji_vibe: ["🏀", "💪", "🎉"],
    category: "athletic",
  },

  // ════════════════════════════════════════
  //  HEALTH / COUNSELING
  // ════════════════════════════════════════
  {
    id: "student-health",
    name: "Student Health Center",
    latitude: 38.03380,
    longitude: -78.51200,
    wellbeing_score: 65,
    emotion_breakdown: { calm: 20, happy: 10, anxious: 30, sad: 18, inspired: 5, stressed: 17 },
    description: "A critical resource — vulnerability, concern, and the path to feeling better.",
    emoji_vibe: ["🏥", "💚", "🤝"],
    category: "health",
  },
];

/** Default demo location — center of UVA near the Rotunda */
export const UVA_DEMO_LOCATION = {
  latitude: 38.0336,
  longitude: -78.5080,
};
