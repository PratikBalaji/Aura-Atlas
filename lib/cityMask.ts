import turfCircle from "@turf/circle";
import { point } from "@turf/helpers";
import { CityConfig } from "./types";

const OUTER_RING: GeoJSON.Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/**
 * Build an inverted polygon mask centered on arbitrary coordinates.
 * Everything outside the circle is dimmed; the hole follows the user.
 */
export function buildMaskAt(lat: number, lng: number, radiusKm: number): GeoJSON.FeatureCollection {
  const circle = turfCircle(point([lng, lat]), radiusKm, { steps: 80, units: "kilometers" });
  const innerRing = circle.geometry.coordinates[0].slice().reverse();

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [OUTER_RING, innerRing],
        },
      },
    ],
  };
}

/**
 * Build an inverted polygon mask: a giant world-covering polygon with a hole
 * cut out for the city. When rendered as a fill layer with high opacity,
 * everything outside the city fades/dims.
 */
export function buildCityMask(city: CityConfig): GeoJSON.FeatureCollection {
  return buildMaskAt(city.lat, city.lng, city.radius);
}
