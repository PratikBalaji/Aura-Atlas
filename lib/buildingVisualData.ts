/**
 * Visual feature data for AR building identification.
 *
 * Each entry contains structured architectural descriptions derived from
 * real reference photos. These descriptions are injected into the GPT-4o
 * vision prompt to dramatically improve identification accuracy.
 *
 * To add a new building:
 *  1. Collect 3-5 reference photos from different angles / lighting
 *  2. Extract distinguishing visual features
 *  3. Add a BuildingVisualProfile entry below
 */

export interface BuildingVisualProfile {
  /** Must match the `id` in uvaBuildings.ts */
  buildingId: string;
  /** Human-readable name */
  name: string;
  /** Distinctive text / signage visible on the building */
  signage: string[];
  /** Key architectural features an observer would notice */
  architecturalFeatures: string[];
  /** Materials & colour palette */
  materials: string[];
  /** View-specific descriptions (angle → what you see) */
  viewDescriptions: {
    angle: string;
    description: string;
  }[];
  /** Features that distinguish this building from visually similar ones */
  distinguishingFromSimilar: string[];
  /** Nearby context clues */
  surroundingContext: string[];
}

// ════════════════════════════════════════════════════════════════
//  OLSSON HALL — trained from 5 reference images
// ════════════════════════════════════════════════════════════════

const olssonHall: BuildingVisualProfile = {
  buildingId: "olsson-hall",
  name: "Olsson Hall",
  signage: [
    "\"OLSSON HALL\" inscribed in capital letters on the stone lintel above the main entrance",
    "\"OLSSON HALL\" text also visible on the secondary entrance facade",
    "Possible departmental plaque reading \"SYSTEMS AND INFORMATION ENGINEERING\" near one entrance",
  ],
  architecturalFeatures: [
    "Two-story red/brown brick building in Georgian Colonial Revival style",
    "Front entrance: white-columned portico with four Doric/Tuscan columns supporting a triangular pediment with dentil molding",
    "Wide granite/concrete staircase leading up to the columned portico, flanked by black wrought-iron railings",
    "White-trimmed multi-pane double-hung sash windows arranged symmetrically across the facade",
    "Second-floor windows are smaller than first-floor windows",
    "Secondary entrance (side): no columns; features a larger central doorway flanked by tall French-style multi-pane windows with stone/tan trim surrounds",
    "Flat stone steps at the secondary entrance with low stone platform",
    "Decorative cornice/molding along the roofline with dentil detailing",
    "White double doors at the main entrance",
  ],
  materials: [
    "Red/brown brick walls (Flemish or running bond pattern)",
    "White-painted wood columns and window frames",
    "Gray granite or concrete steps and base",
    "Black wrought-iron handrails and stair railings",
    "Stone or cast-stone lintel and window surrounds",
  ],
  viewDescriptions: [
    {
      angle: "Front (main entrance)",
      description:
        "Looking straight at the building you see a grand white-columned portico with a triangular pediment. Wide stone steps with black iron railings lead up to white double doors. 'OLSSON HALL' is inscribed on the stone beam above the columns. Red brick walls extend to both sides with evenly spaced white-trimmed windows on two floors.",
    },
    {
      angle: "Front — sunny day",
      description:
        "Same columned entrance but sunlit, with green trees visible to the left and a cherry blossom tree nearby. The brick colour appears warmer/lighter in direct sunlight. Shadows from the columns fall across the steps.",
    },
    {
      angle: "Front — overcast / evening",
      description:
        "The entrance appears slightly darker with flatter lighting. Notices posted on or near the doors may be visible. Bushes and landscaping flank the base of the building.",
    },
    {
      angle: "Secondary entrance (side)",
      description:
        "A different facade without columns. A central doorway with a glass-paned door is flanked by two large multi-pane windows. 'OLSSON HALL' is visibly inscribed above this entrance as well. The surrounding windows on the upper floor are evenly spaced. Flat stone steps lead to the entrance. Evergreen shrubs may be present on one side.",
    },
    {
      angle: "Secondary entrance — with pedestrians",
      description:
        "Same side entrance as above; people walking past confirm human-scale proportions. A small plaque reading 'SYSTEMS AND INFORMATION ENGINEERING' may be visible near the door.",
    },
  ],
  distinguishingFromSimilar: [
    "Unlike Rice Hall (modern glass/metal facade), Olsson Hall is entirely traditional red brick with white colonial elements",
    "Unlike Thornton Hall (larger, more industrial engineering look), Olsson is smaller and more classically styled",
    "The white-columned portico with triangular pediment is unique among the engineering buildings",
    "The visible 'OLSSON HALL' inscription is the most reliable identifier",
    "Has TWO distinct entrances with different architectural styles — columned (front) and non-columned (side)",
  ],
  surroundingContext: [
    "Located in the UVA engineering quad area",
    "Near Rice Hall (CS building — modern glass) and Thornton Hall",
    "Part of the School of Engineering and Applied Science complex",
    "Sidewalks and mature trees surround the building",
  ],
};

// ════════════════════════════════════════════════════════════════
//  RICE HALL — trained from 3 reference images
// ════════════════════════════════════════════════════════════════

const riceHall: BuildingVisualProfile = {
  buildingId: "rice-hall",
  name: "Rice Hall",
  signage: [
    "\"RICE HALL\" text visible on the building facade near the entrance",
    "Possible signage reading \"Department of Computer Science\" near entrance level",
  ],
  architecturalFeatures: [
    "Four-to-five-story modern building with a striking glass-and-steel curtain wall facade",
    "Distinctive curved/swooping overhanging roofline that extends beyond the building walls — the most recognizable feature",
    "Tall vertical concrete/stone fins (pilasters) running the full height of the glass facade, creating a rhythmic columnar pattern",
    "Large floor-to-ceiling glass panels between the vertical fins, giving the building a transparent, open appearance",
    "Red/brown brick sections on the lower levels and side walls, contrasting with the modern glass front",
    "Corner section features a fully glazed glass atrium/stairwell that wraps around the building corner",
    "Flat, modern entrance at ground level — no grand staircase or portico",
    "Recessed ground floor with covered walkway/colonnade at the base",
    "Clean geometric lines throughout — no classical ornamentation",
  ],
  materials: [
    "Glass curtain wall (blue-tinted or clear, reflective in sunlight)",
    "Precast concrete or limestone vertical fins/columns",
    "Red/brown brick on side walls and lower sections",
    "Steel structural framing visible through glass",
    "Concrete/stone at the base and entrance level",
    "Metal roofline edge with distinctive curved overhang profile",
  ],
  viewDescriptions: [
    {
      angle: "Front — straight on",
      description:
        "A dramatic modern facade dominates the view: tall vertical concrete fins alternate with floor-to-ceiling glass panels across four-plus stories. The roofline swoops outward in a distinctive curved overhang. Red brick is visible on the side walls. Green trees and lawn in the foreground. The building reads as unmistakably contemporary against UVA's otherwise traditional campus.",
    },
    {
      angle: "Corner view — glass atrium side",
      description:
        "The corner of the building reveals a fully glazed glass atrium wrapping around the corner junction. The curved roofline overhang is prominently visible from this angle. Red brick base contrasts sharply with the glass upper stories. A street and bike racks are visible at ground level. The vertical fin pattern continues around the corner.",
    },
    {
      angle: "Front — looking up",
      description:
        "Looking upward at the entrance, the vertical concrete fins tower overhead with glass panels between them. The curved roofline overhang is dramatic from this perspective. The entrance doors are visible at ground level beneath the glass facade. The building appears very tall and modern from this vantage point.",
    },
  ],
  distinguishingFromSimilar: [
    "Unlike Olsson Hall (traditional red brick with white columns), Rice Hall is predominantly glass and steel with a modern aesthetic",
    "Unlike Thornton Hall (older engineering building, more industrial), Rice Hall is sleek and contemporary",
    "The curved/swooping roofline overhang is UNIQUE on the UVA campus — no other building has this feature",
    "The tall vertical concrete fins with glass curtain wall are distinctive to Rice Hall",
    "Only engineering building with a fully glazed corner atrium",
    "The most modern-looking building in the engineering quad",
  ],
  surroundingContext: [
    "Located in the UVA engineering quad area, adjacent to Olsson Hall and near Thornton Hall",
    "Houses the Department of Computer Science",
    "Street-level entrance with bike racks often visible nearby",
    "Surrounded by mature trees and campus walkways",
    "Brick walkways and roads visible at ground level",
  ],
};

// ════════════════════════════════════════════════════════════════
//  REGISTRY — add new buildings here as they are "trained"
// ════════════════════════════════════════════════════════════════

export const BUILDING_VISUAL_DATA: BuildingVisualProfile[] = [olssonHall, riceHall];

/** O(1) lookup map — rebuilt once at module load, not on every request. */
const _profileMap = new Map<string, BuildingVisualProfile>(
  BUILDING_VISUAL_DATA.map((b) => [b.buildingId, b])
);

/**
 * Look up a visual profile by building ID.  O(1) via pre-built Map.
 */
export function getVisualProfile(
  buildingId: string
): BuildingVisualProfile | undefined {
  return _profileMap.get(buildingId);
}

/**
 * Build a concise text block describing a building's visual features
 * for injection into an LLM prompt.
 *
 * Token-optimised: caps architectural features at 5 most important,
 * and focuses on signage + distinguishing traits (highest signal).
 */
export function buildVisualPromptBlock(profile: BuildingVisualProfile): string {
  const lines: string[] = [];

  lines.push(`### ${profile.name}`);
  lines.push(`Signage: ${profile.signage.join("; ")}`);
  // Take the first 5 features — they're ordered by importance
  lines.push(
    `Key features: ${profile.architecturalFeatures.slice(0, 5).join("; ")}`
  );
  lines.push(`Materials: ${profile.materials.slice(0, 4).join("; ")}`);
  lines.push(
    `Distinguishing traits: ${profile.distinguishingFromSimilar.join("; ")}`
  );

  return lines.join("\n");
}

/**
 * Ultra-compact prompt block — signage + top 3 distinguishing traits only.
 * Use when many buildings need to fit in limited token budget.
 */
export function buildCompactVisualBlock(
  profile: BuildingVisualProfile
): string {
  return `**${profile.name}**: ${profile.signage[0]}. ${profile.distinguishingFromSimilar.slice(0, 3).join("; ")}`;
}

/**
 * Build prompt blocks for a set of building IDs (e.g. the nearest ones).
 * Buildings without visual data are silently skipped.
 *
 * @param compact — if true, use ultra-compact format (fewer tokens)
 */
export function buildVisualPromptForBuildings(
  buildingIds: string[],
  compact = false
): string {
  const builder = compact ? buildCompactVisualBlock : buildVisualPromptBlock;
  const blocks: string[] = [];

  for (const id of buildingIds) {
    const profile = _profileMap.get(id);
    if (profile) blocks.push(builder(profile));
  }

  if (blocks.length === 0) return "";

  return `\n\nDETAILED VISUAL REFERENCE DATA (from real training images):\n${blocks.join("\n\n")}`;
}
