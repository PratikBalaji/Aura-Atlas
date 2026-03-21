"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  CampusEmotionResponse,
  CheckIn,
  CityConfig,
  College,
  MOODS,
  Mood,
  CITIES,
} from "@/lib/types";
import { buildPointGeoJSON } from "@/lib/gridAggregator";
import { buildCityMask, buildMaskAt } from "@/lib/cityMask";
import ResourceMarkers from "./ResourceMarkers";
import CampusLayer from "./CampusLayer";
import EmotionWeatherOverlay from "./EmotionWeatherOverlay";
import UserLocationLayer from "./UserLocationLayer";
import { getResourcesByCity } from "@/lib/store";
import { CAMPUSES } from "@/lib/campusDetection";
import { supabase } from "@/lib/supabase";
import AddSafeSpaceModal from "./AddSafeSpaceModal";
import { seedRealSafeSpaces } from "@/utils/seedSafeSpaces";
import CampusSentiment from "./CampusSentiment";
import ThermalMoodMatrix from "./ThermalMoodMatrix";
import { ALL_COLLEGES } from "@/lib/collegeList";
import toast from "react-hot-toast";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const CIRCLE_COLOR_STOPS = MOODS.flatMap((m) => [m.label, m.color]);

const CITIES_CONFIG: Record<string, { center: [number, number], bbox: string }> = {
  "San Antonio": {
    center: [-98.4936, 29.4241],
    bbox: "-98.8100,29.1800,-98.1500,29.6500"
  },
  "New York": {
    center: [-74.0060, 40.7128],
    bbox: "-74.2591,40.4774,-73.7002,40.9176"
  },
  "Philadelphia": {
    center: [-75.1652, 39.9526],
    bbox: "-75.2803,39.8670,-74.9558,40.1379"
  },
  "Dallas": {
    center: [-96.7970, 32.7767],
    bbox: "-97.0300,32.6000,-96.5500,33.0200"
  },
  "San Diego": {
    center: [-117.1611, 32.7157],
    bbox: "-117.3300,32.5300,-116.9000,33.0500"
  },
  "Jacksonville": {
    center: [-81.6557, 30.3322],
    bbox: "-82.0500,30.1000,-81.3000,30.6000"
  },
  "Charlottesville": {
    center: [-78.4767, 38.0293],
    bbox: "-78.5500,37.9800,-78.4000,38.0800"
  },
  "Los Angeles": {
    center: [-118.2437, 34.0522],
    bbox: "-118.6682,33.7037,-118.1553,34.3373"
  },
  "Chicago": {
    center: [-87.6298, 41.8781],
    bbox: "-87.9401,41.6443,-87.5240,42.0231"
  },
  "Houston": {
    center: [-95.3698, 29.7604],
    bbox: "-95.9000,29.5000,-95.0000,30.1500"
  },
  "Phoenix": {
    center: [-112.0740, 33.4484],
    bbox: "-112.4500,33.2500,-111.8000,33.7500"
  }
};

interface Map3DViewProps {
  checkins: CheckIn[];
  city: CityConfig;
  focusedCampus?: string;
  selectedMood?: Mood | null;
  campuses?: College[];
  registeredCollege?: College | null;
  campusInsights?: CampusEmotionResponse | null;
  focusRegisteredCampus?: boolean;
  isSpinning?: boolean;
  onToggleSpin?: (isSpinning: boolean) => void;
  showThermalRadar?: boolean;
  onToggleThermal?: (active: boolean) => void;
  userLatitude?: number | null;
  userLongitude?: number | null;
  userAccuracy?: number | null;
  locateMeTrigger?: number;
}

// 1. Define the possible times
type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'All';

// 2. The Config Object (Atmosphere & Lighting)
const TIME_THEMES: Record<string, any> = {
  Morning: {
    fog: { "range": [0.5, 10], "color": "#fdf2f8", "high-color": "#fee2e2", "space-color": "#334155" },
    light: { "anchor": "viewport", "color": "#fafaf9", "intensity": 0.4 }
  },
  Afternoon: {
    fog: { "range": [0.8, 8], "color": "#f8fafc", "high-color": "#e0f2fe", "space-color": "#0ea5e9" },
    light: { "anchor": "viewport", "color": "#ffffff", "intensity": 0.5 }
  },
  Evening: {
    fog: { "range": [0.1, 12], "color": "#4c1d95", "high-color": "#f43f5e", "space-color": "#1e1b4b" },
    light: { "anchor": "viewport", "color": "#fb923c", "intensity": 0.3 }
  },
  Night: {
    fog: { "range": [-1, 1.5], "color": "#020617", "high-color": "#020617", "space-color": "#020617", "horizon-blend": 0.1 },
    light: { "anchor": "viewport", "color": "#1e293b", "intensity": 0.2 }
  },
  All: { fog: null, light: null }
};

// Mock Data for your "Friends List"
const MOCK_FRIENDS = [
  { id: 'f1', name: 'Sarah', color: 'bg-purple-500', offsetLat: 0.002, offsetLng: 0.001 },
  { id: 'f2', name: 'David', color: 'bg-blue-500', offsetLat: -0.001, offsetLng: -0.003 },
];

export default function Map3DView({
  checkins,
  city,
  focusedCampus,
  selectedMood,
  campuses = [],
  registeredCollege = null,
  campusInsights = null,
  focusRegisteredCampus = false,
  isSpinning = false,
  onToggleSpin,
  showThermalRadar = false,
  onToggleThermal,
  userLatitude = null,
  userLongitude = null,
  userAccuracy = null,
  locateMeTrigger = 0,
}: Map3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const spinFrameRef = useRef<number | null>(null);
  const [draftSafeSpace, setDraftSafeSpace] = useState<{ lat: number; lng: number } | null>(null);
  const safeSpacesRefetchRef = useRef<() => void>(() => { });
  const [isSeedingSpaces, setIsSeedingSpaces] = useState(false);
  const [selectedTime, setSelectedTime] = useState<TimeOfDay>('All');

  // 1. Store the original view so we can "Go Home"
  const cityConfig = CITIES_CONFIG[city.name] || CITIES_CONFIG["Philadelphia"];
  const INITIAL_VIEW = { longitude: cityConfig.center[0], latitude: cityConfig.center[1], zoom: 14 };
  
  // 2. New states for the Address Setup phase
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [fromAddress, setFromAddress] = useState("My Current Location");
  const [toAddress, setToAddress] = useState("");

  // Add this state to hold the path data
  const [quietRoute, setQuietRoute] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  
  // NEW: State to hold the impressive HUD data!
  const [routeStats, setRouteStats] = useState<{
    eta: string; 
    distance: string; 
    nextTurn: string;
  } | null>(null);

  // NEW: Live Location States
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);

  // NEW: Clock State
  const [currentTime, setCurrentTime] = useState<{ time: string; period: string; date: string }>({
    time: "00:00:00",
    period: "PM",
    date: ""
  });

  const [isARModeActive, setIsARModeActive] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [trackingId, setTrackingId] = useState<number | null>(null);

  // ✈️ Paper Airplanes State
  const [airplanes, setAirplanes] = useState<any[]>([]);
  const [draftLocation, setDraftLocation] = useState<{lat: number, lng: number, screenX: number, screenY: number} | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isDroppingMode, setIsDroppingMode] = useState(false);
  const airplaneMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // 1. Get their saved campus as reactive state so the logo updates on selection
  const [selectedCampusName, setSelectedCampusName] = useState<string>(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('aura_campus') || "Temple University"
      : "Temple University"
  );

  // 2. Find that specific college in your database to get its domain and coordinates
  const userCampus = ALL_COLLEGES.find(college => college.name === selectedCampusName);

  useEffect(() => {
    const tzMap: Record<string, string> = {
      'New York': 'America/New_York',
      'Philadelphia': 'America/New_York',
      'Chicago': 'America/Chicago',
      'Houston': 'America/Chicago',
      'Los Angeles': 'America/Los_Angeles',
      'Phoenix': 'America/Phoenix',
      'Dallas': 'America/Chicago',
      'San Diego': 'America/Los_Angeles',
      'Jacksonville': 'America/New_York',
      'San Antonio': 'America/Chicago',
      'Charlottesville': 'America/New_York'
    };

    const tick = () => {
      const tz = tzMap[city.name] || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
      
      const [timePart, period] = timeStr.split(' ');
      setCurrentTime({ time: timePart, period, date: dateStr });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [city.name]);

  // 1. Get the User's Real Location on load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => console.warn("Location error:", error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // 2. Handle the Map Markers for User and Friends
  const toggleSafeCircle = async (isActive: boolean) => {
    setIsSharingLocation(isActive);

    if (isActive) {
      // 1. Generate a unique session ID
      const sessionId = crypto.randomUUID();
      const { data: { user } } = await supabase.auth.getUser();
      
      // 2. Start tracking
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          await supabase.from('safe_circle_locations').upsert({
            session_id: sessionId,
            user_id: user?.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            updated_at: new Date()
          });
        },
        (err) => console.error("Tracking error:", err),
        { enableHighAccuracy: true }
      );
      
      // 3. Save the watchId to state so you can stop it later, and copy the link!
      setTrackingId(watchId);
      const shareUrl = `${window.location.origin}/track/${sessionId}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success("Safe Circle Active! Tracking link copied.", {
        icon: '🛡️',
        style: {
          borderRadius: '12px',
          background: '#0f172a',
          color: '#34d399',
          border: '1px solid rgba(52,211,153,0.3)'
        }
      });
    } else {
      // Turn it off
      if (trackingId !== null) {
        navigator.geolocation.clearWatch(trackingId);
        setTrackingId(null);
      }
      toast.error("Safe Circle Deactivated.", {
        icon: '🛑',
        style: {
          borderRadius: '12px',
          background: '#0f172a',
          color: '#f43f5e',
          border: '1px solid rgba(244,63,94,0.3)'
        }
      });
    }
  };

  // ✈️ Fetch all paper airplanes from Supabase
  const fetchAirplanes = async () => {
    const { data } = await supabase.from('paper_airplanes').select('*');
    if (data) setAirplanes(data);
  };

  // ✈️ Insert a new airplane and refresh
  const dropAirplane = async () => {
    if (!draftMessage.trim() || !draftLocation) return;
    await supabase.from('paper_airplanes').insert([{
      message: draftMessage,
      lat: draftLocation.lat,
      lng: draftLocation.lng,
    }]);
    setDraftLocation(null);
    setDraftMessage("");
    fetchAirplanes();
    toast.success("Note sent! ✈️", {
      style: { borderRadius: '12px', background: '#0f172a', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !isSharingLocation) return;

    const markers: mapboxgl.Marker[] = [];

    // Create User Marker (Glowing Green Dot)
    const userEl = document.createElement('div');
    userEl.className = 'w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-pulse';
    
    const userMarker = new mapboxgl.Marker(userEl)
      .setLngLat(userLocation)
      .addTo(map);
    markers.push(userMarker);

    // Create Friend Markers (Positioned slightly offset from the user)
    MOCK_FRIENDS.forEach(friend => {
      const friendEl = document.createElement('div');
      friendEl.className = `w-8 h-8 ${friend.color} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg`;
      friendEl.innerText = friend.name[0]; // First letter of name
      
      const friendMarker = new mapboxgl.Marker(friendEl)
        .setLngLat([userLocation[0] + friend.offsetLng, userLocation[1] + friend.offsetLat])
        .addTo(map);
      markers.push(friendMarker);
    });

    // Cleanup markers when sharing is toggled off
    return () => {
      markers.forEach(m => m.remove());
    };
  }, [userLocation, isSharingLocation]);

  // Function to snap map to user
  const handleLocateMe = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({ center: userLocation, zoom: 16, duration: 2000 });
    }
  };

  // 1. THE BULLETPROOF GEOCODING ENGINE
  const getCoordinates = async (address: string, cityName: string) => {
    const city = CITIES_CONFIG[cityName];
    
    if (!city) {
      console.error("Could not find city config for:", cityName);
      return null;
    }

    if (address === "My Current Location") {
      return userLocation || city.center;
    }

    // Use current userLocation for proximity bias, fallback to city center
    const prox = userLocation ? `${userLocation[0]},${userLocation[1]}` : `${city.center[0]},${city.center[1]}`;

    // We append the city and state to guarantee Mapbox knows exactly where to look
    const fullSearch = `${address}, ${cityName}`;

    try {
      // ATTEMPT 1: Strict Search inside the City Bounding Box (Fastest & most accurate)
      let response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullSearch)}.json?bbox=${city.bbox}&proximity=${prox}&limit=5&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
      );
      let data = await response.json();

      // ATTEMPT 2: The "Foundry" Fallback. 
      if (!data.features || data.features.length === 0) {
        console.log("Strict search failed, attempting broad POI search...");
        response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullSearch)}.json?proximity=${prox}&limit=5&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
        );
        data = await response.json();
      }

      // Return the coordinates of the absolute best match
      if (data.features && data.features.length > 0) {
        console.log("Successfully found:", data.features[0].place_name);
        return data.features[0].center;
      }

      return null;
    } catch (err) {
      console.error("Geocoding Error:", err);
      return null;
    }
  };

  // 2. THE MULTI-CITY ROUTING FUNCTION
  const calculateQuietRoute = async (startCoords?: [number, number], endCoords?: [number, number]) => {
    setIsRouting(true);
    
    try {
      const currentCityName = Object.keys(CITIES_CONFIG).find(key => 
        city.name.includes(key)
      ) || "Philadelphia"; 

      // Get Coordinates (Use passed coords OR geocode the addresses)
      let start = startCoords;
      if (!start) {
        start = await getCoordinates(fromAddress, currentCityName);
      }

      let end = endCoords;
      if (!end) {
        end = await getCoordinates(toAddress, currentCityName);
      }

      if (!start || !end) {
        alert(`We couldn't locate those places in ${currentCityName}.`);
        return;
      }

      // Fetch the Walking Route
      const resp = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
      );
      const data = await resp.json();

      if (!data.routes || data.routes.length === 0) {
        alert(`No safe walking path found.`);
        return;
      }

      const route = data.routes[0];
      setQuietRoute({ type: 'Feature', geometry: route.geometry });
      setRouteStats({
        eta: `${Math.ceil(route.duration / 60)} min`,
        distance: `${(route.distance * 0.000621371).toFixed(1)} mi`,
        nextTurn: route.legs[0].steps[1]?.maneuver.instruction || "Proceed toward your destination"
      });

      // mapRef.current?.flyTo({ center: start as [number, number], zoom: 16, duration: 2000 });

    } catch (error) {
      console.error("Routing error:", error);
    } finally {
      setIsRouting(false);
    }
  };

  // Call this function when the user clicks "Start Route" / "Enter POV"
  const enterPOVMode = (startLngLat: [number, number], nextLngLat: [number, number]) => {
    if (!mapRef.current) return;

    // 1. Calculate the direction the camera should face (Bearing)
    // This ensures the camera looks down the street, not at a wall!
    const dy = nextLngLat[1] - startLngLat[1];
    const dx = Math.cos(Math.PI / 180 * startLngLat[1]) * (nextLngLat[0] - startLngLat[0]);
    const bearing = Math.atan2(dx, dy) * 180 / Math.PI;

    // 2. Fly the camera down to street level
    mapRef.current.flyTo({
      center: startLngLat,
      zoom: 19.5, // Extremely zoomed in (street level)
      pitch: 80,  // Tilt the camera up so you are looking at the horizon/buildings
      bearing: bearing, // Face the direction of the route
      duration: 3000, // Make the swoop down feel cinematic (3 seconds)
      essential: true
    });
  };

  const handleEndNavigation = () => {
    console.log("Ending navigation..."); // Check your browser console to ensure this fires!
    
    // 1. Force clear all route states
    setQuietRoute(null);
    setRouteStats(null);
    setIsSettingUp(false);
    setToAddress("");
    setFromAddress("My Current Location");

    // 2. Safely find the city
    const currentCityName = Object.keys(CITIES_CONFIG).find(key => 
      city.name.includes(key)
    ) || "Philadelphia"; 

    const cityData = CITIES_CONFIG[currentCityName];

    // 3. Move the camera
    if (cityData && mapRef.current) {
      console.log("Flying to:", cityData.center);
      mapRef.current.flyTo({
        center: cityData.center,
        zoom: 13,
        pitch: 45,
        bearing: 0,
        duration: 2500, // Slightly longer, smoother flight
        essential: true
      });
    } else {
      console.error("Missing city data or mapRef is not attached!");
    }
  };

  // Memoised builders
  const pointData = useCallback(
    (d: CheckIn[]) => {
      if (!Array.isArray(d) || d.length === 0) {
        return { type: "FeatureCollection" as const, features: [] };
      }
      return buildPointGeoJSON(d);
    },
    []
  );

  // ── Initialise map ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/soso593/cmmh6jzoe003m01qn8f00gog6",
      center: [city.lng, city.lat],
      zoom: 14,
      pitch: 60,
      bearing: -20,
      antialias: true,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      // ── Terrain ──────────────────────────────────────────────
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

      map.setFog({
        color: "rgba(12, 18, 34, 0.95)",
        "high-color": "rgba(15, 23, 42, 0.85)",
        "horizon-blend": 0.18,
        "space-color": "rgba(2, 6, 23, 1)",
        "star-intensity": 0.0,
      });

      // ── City mask ────────────────────────────────────────────
      map.addSource("city-mask", {
        type: "geojson",
        data: buildCityMask(city),
      });

      map.addLayer({
        id: "city-mask-fill",
        type: "fill",
        source: "city-mask",
        paint: {
          "fill-color": "#0f172a",
          "fill-opacity": 0.58,
        },
      });

      map.addLayer({
        id: "city-mask-border",
        type: "line",
        source: "city-mask",
        paint: {
          "line-color": "rgba(129, 140, 248, 0.32)",
          "line-width": 2,
          "line-blur": 4,
        },
      });

      // ── Declutter map (mute POIs) ──────────────────────────
      const layers = map.getStyle().layers;
      layers?.forEach((layer: any) => {
        if (
          layer.id.includes("poi-label") ||
          layer.id.includes("transit-label") ||
          layer.id.includes("settlement-subdivision-label")
        ) {
          if (layer.type === 'symbol') {
            map.setPaintProperty(layer.id, 'text-opacity', 0.15); // Ultra-muted
            map.setPaintProperty(layer.id, 'icon-opacity', 0.15);
          } else {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      });

      const labelLayerId = layers?.find(
        (l: any) => l.type === "symbol" && l.layout?.["text-field"]
      )?.id;

      const add3DBuildings = () => {
        if (!map.getSource("composite")) return;
        if (map.getLayer("3d-buildings")) return;

        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": "#171717",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.8,
            },
          },
          labelLayerId
        );
      };

      const waitForSource = (m: mapboxgl.Map, sourceId: string, cb: () => void) => {
        if (m.getSource(sourceId)) {
          cb();
        } else {
          m.once("sourcedata", () => waitForSource(m, sourceId, cb));
        }
      };

      waitForSource(map, "composite", add3DBuildings);

      // ── Point source (for heatmap + circle layers) ──────────
      map.addSource("mood-points", {
        type: "geojson",
        data: pointData(checkins),
      });

      // ── Circle detail at high zoom ───────────────────────────
      map.addLayer({
        id: "mood-circles",
        type: "circle",
        source: "mood-points",
        minzoom: 14,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 8],
          "circle-color": [
            "match", ["get", "mood"],
            ...CIRCLE_COLOR_STOPS,
            "#94a3b8",
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(241,245,249,0.45)",
        },
      });

      // ── Popups ───────────────────────────────────────────────
      map.on("click", "mood-circles", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const { mood, message, timestamp } = f.properties as {
          mood: string; message: string; timestamp: string;
        };
        const icon = MOODS.find((m) => m.label === mood)?.icon ?? "";
        const time = new Date(timestamp).toLocaleString();
        new mapboxgl.Popup({ className: "dark-popup", offset: 12 })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(
            `<div style="font-size:13px;color:#f1f5f9">
              <strong>${icon} ${mood}</strong>
              ${message ? `<p style="margin:4px 0 0;color:#cbd5e1">${message}</p>` : ""}
              <p style="margin:4px 0 0;color:#94a3b8;font-size:11px">${time}</p>
            </div>`
          )
          .addTo(map);
      });

      for (const layerId of ["mood-circles"]) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // ── Paper Airplanes Handled via isolated useEffect below ──


      // Right-click to open draft modal
      map.on("contextmenu", (e) => {
        e.preventDefault();
        setDraftSafeSpace({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      readyRef.current = true;
    });

    mapRef.current = map;
    setMapInstance(map);
    return () => { map.remove(); mapRef.current = null; setMapInstance(null); readyRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 🌍 THE LIVE METEOROLOGICAL HEAT MAP (Thermal Radar)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (showThermalRadar) {
      if (!map.getSource("thermal-radar-source")) {
        const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "YOUR_OPENWEATHER_API_KEY";
        
        map.addSource("thermal-radar-source", {
          type: "raster",
          tiles: [
            `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`
          ],
          tileSize: 256,
          maxzoom: 12
        });

        map.addLayer(
          {
            id: "thermal-radar-layer",
            type: "raster",
            source: "thermal-radar-source",
            paint: {
              "raster-opacity": 0.65,
              "raster-fade-duration": 1000
            }
          }
        );
      }
    } else {
      if (map.getLayer("thermal-radar-layer")) {
        map.removeLayer("thermal-radar-layer");
      }
      if (map.getSource("thermal-radar-source")) {
        map.removeSource("thermal-radar-source");
      }
    }
  }, [showThermalRadar]);

  // Step 1: Add the Auto-Load Logic (useEffect)
  useEffect(() => {
    fetchAirplanes();
  }, []);

  useEffect(() => {
    // Make sure the map exists first
    if (!mapRef.current) return;

    // Function to run when map is ready
    const initializeSafeSpaces = () => {
      seedRealSafeSpaces(); 
    };

    // If the map is already loaded, run it immediately
    if (mapRef.current.isStyleLoaded()) {
      initializeSafeSpaces();
    } else {
      // Otherwise, wait for the 'load' event so Mapbox doesn't crash
      mapRef.current.on('load', initializeSafeSpaces);
    }

    // Cleanup listener
    return () => {
      if (mapRef.current) {
        mapRef.current.off('load', initializeSafeSpaces);
      }
    };
  }, []); // Empty dependency array so it only runs once on mount

  // ── Fly to city + update mask ────────────────────────────────
  useEffect(() => {
    if (onToggleSpin) onToggleSpin(false);
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    // Stop any active rotation/animation immediately
    map.stop();

    const maskSrc = map.getSource("city-mask") as mapboxgl.GeoJSONSource | undefined;
    if (maskSrc) {
      maskSrc.setData(buildCityMask(city));
    }

    if (
      focusRegisteredCampus &&
      registeredCollege &&
      registeredCollege.city === city.name
    ) {
      setTimeout(() => {
        map.flyTo({
          center: [registeredCollege.longitude, registeredCollege.latitude],
          zoom: 15,
          pitch: 70,
          bearing: 0,
          duration: 2200,
          essential: true,
        });
      }, 50);
      return;
    }

    if (focusedCampus) {
      const collegeMatch = campuses.find((campus) => campus.name === focusedCampus);
      if (collegeMatch) {
        setTimeout(() => {
          map.flyTo({
            center: [collegeMatch.longitude, collegeMatch.latitude],
            zoom: 15,
            pitch: 70,
            bearing: 0,
            duration: 2200,
            essential: true,
          });
        }, 50);
        return;
      }

      const campus = CAMPUSES.find((c) => c.name === focusedCampus);
      if (campus) {
        setTimeout(() => {
          map.flyTo({
            center: [campus.lng, campus.lat],
            zoom: 15,
            pitch: 70,
            bearing: 0,
            duration: 2200,
            essential: true,
          });
        }, 50);
        return;
      }
    }

    setTimeout(() => {
      map.flyTo({
        center: [city.lng, city.lat],
        zoom: 12,
        pitch: 60,
        bearing: -20,
        duration: 2200,
        essential: true,
      });
    }, 50);
  }, [campuses, city, focusRegisteredCampus, focusedCampus, registeredCollege]);

  // ── GPS location changes → re-center mask on user ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || userLatitude === null || userLongitude === null) return;
    const maskSrc = map.getSource("city-mask") as mapboxgl.GeoJSONSource | undefined;
    if (maskSrc) {
      maskSrc.setData(buildMaskAt(userLatitude, userLongitude, city.radius));
    }
  }, [userLatitude, userLongitude, city.radius]);

  // ── Update mood data (both sources) ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (!Array.isArray(checkins)) return;

    const ptSrc = map.getSource("mood-points") as mapboxgl.GeoJSONSource | undefined;
    if (ptSrc) ptSrc.setData(pointData(checkins));
  }, [checkins, pointData]);

  // ── Apply Emotional Weather OR Time Theme (ADDITIVE / ISOLATED) ──
  // ── Locate Me: fly to user location ─────────────────────────────
  useEffect(() => {
    if (locateMeTrigger === 0) return;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (userLatitude === null || userLongitude === null) return;

    map.flyTo({
      center: [userLongitude, userLatitude],
      zoom: 16,
      pitch: 60,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
  }, [locateMeTrigger, userLatitude, userLongitude]);

  // ── 3D Emotional Weather: Native Mapbox Rain/Snow/Fog (ADDITIVE / ISOLATED) ──

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    // Cast to `any` because setRain/setSnow are newer Mapbox Standard APIs
    // not yet in the @types/mapbox-gl package
    const m = map as any;

    // ── Step 1: Always reset previous weather particles ──
    try { m.setRain(null); } catch { /* rain API not available in this GL version */ }
    try { m.setSnow(null); } catch { /* snow API not available in this GL version */ }

    // Overriding with TIME filter if active
    if (selectedTime !== 'All') {
      const theme = TIME_THEMES[selectedTime];
      if (theme.fog) {
        map.setFog(theme.fog);
      }
      if (theme.light && map.setLight) {
        try { map.setLight(theme.light); } catch {}
      }
      return; // Exit early so mood doesn't override time
    }

    // Otherwise apply mood-specific atmospheric profile
    switch (selectedMood) {
      case "Sad":
        // Cinematic rainstorm
        try {
          m.setRain({
            density: 0.8,
            intensity: 0.9,
            color: "#7a8b99",
            opacity: 0.8,
            "droplet-size": [1.5, 30],
          });
        } catch { /* graceful fallback */ }
        map.setFog({
          color: "#1a2b3c",
          "high-color": "#000000",
          "horizon-blend": 0.2,
          "space-color": "#000811",
          "star-intensity": 0.0,
        });
        break;

      case "Overwhelmed":
        // Red ash blizzard (hacked snow API)
        try {
          m.setSnow({
            density: 0.9,
            intensity: 1.0,
            color: "#ff4d4d",
            opacity: 0.8,
            direction: [45, 70],
            "center-thinning": 0.1,
          });
        } catch { /* graceful fallback */ }
        map.setFog({
          color: "#330000",
          "high-color": "#110000",
          "horizon-blend": 0.1,
          "space-color": "#0d0000",
          "star-intensity": 0.0,
        });
        break;

      case "Stressed":
        // Oppressive, suffocating haze — no particles
        map.setFog({
          color: "#8b4513",
          "high-color": "#3e1a05",
          "horizon-blend": 0.05,
          "space-color": "#1a0800",
          "star-intensity": 0.0,
        });
        break;

      case "Happy":
        // Golden hour glow
        map.setFog({
          color: "#ffd700",
          "high-color": "#ff8c00",
          "space-color": "#ffecd2",
          "horizon-blend": 0.3,
          "star-intensity": 0.0,
        });
        break;

      case "Calm":
        // Clear starlit night
        map.setFog({
          color: "#001f3f",
          "high-color": "#000000",
          "star-intensity": 1.0,
          "horizon-blend": 0.4,
          "space-color": "rgba(2, 6, 23, 1)",
        });
        break;

      default:
        // Neutral / null — standard dark fog
        map.setFog({
          color: "#242b3b",
          "high-color": "#0b0f17",
          "horizon-blend": 0.18,
          "space-color": "rgba(2, 6, 23, 1)",
          "star-intensity": 0.0,
        });
        break;
    }
  }, [selectedMood, selectedTime]);

  // ── Cinematic Auto-Spin (ADDITIVE / ISOLATED) ──
  useEffect(() => {
    if (!isSpinning || !mapInstance) {
      if (spinFrameRef.current) {
        cancelAnimationFrame(spinFrameRef.current);
        spinFrameRef.current = null;
      }
      return;
    }

    function spin() {
      if (!mapInstance) return;
      mapInstance.rotateTo(mapInstance.getBearing() + 0.2, { duration: 0 });
      spinFrameRef.current = requestAnimationFrame(spin);
    }
    spinFrameRef.current = requestAnimationFrame(spin);

    return () => {
      if (spinFrameRef.current) {
        cancelAnimationFrame(spinFrameRef.current);
        spinFrameRef.current = null;
      }
    };
  }, [isSpinning, mapInstance]);

  // ── Safe Spaces: Native WebGL layers (zero-drift, ADDITIVE / ISOLATED) ──

  // Inject dark popup CSS once
  if (typeof document !== "undefined" && !document.getElementById("safe-space-popup-style")) {
    const s = document.createElement("style");
    s.id = "safe-space-popup-style";
    s.textContent = `
      .safe-space-popup .mapboxgl-popup-content {
        background: #0f172a !important;
        border: 1px solid #1e293b !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6) !important;
        padding: 16px !important;
        color: white !important;
      }
      .safe-space-popup .mapboxgl-popup-tip {
        border-top-color: #0f172a !important;
        border-bottom-color: #0f172a !important;
      }
      .safe-space-popup .mapboxgl-popup-close-button {
        color: #475569;
        font-size: 18px;
        padding: 4px 8px;
      }
      .safe-space-popup .mapboxgl-popup-close-button:hover {
        color: #f1f5f9;
        background: transparent;
      }
    `;
    document.head.appendChild(s);
  }

  function buildSafeSpaceGeoJSON(
    spaces: Array<{ id: string; name: string; category: string; lat: number; lng: number; tags: string[]; address?: string }>
  ): GeoJSON.FeatureCollection {
    return {
      type: "FeatureCollection",
      features: spaces.map((sp) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [sp.lng, sp.lat] },
        properties: {
          id: sp.id,
          name: sp.name,
          category: sp.category,
          tags: JSON.stringify(sp.tags ?? []),
          address: sp.address ?? "",
          lat: sp.lat,
          lng: sp.lng,
        },
      })),
    };
  }

  function renderSafeSpacesWebGL(
    spaces: Array<{ id: string; name: string; category: string; lat: number; lng: number; tags: string[]; address?: string }>
  ) {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const geojson = buildSafeSpaceGeoJSON(spaces);

    // If source already exists, just update data
    const existing = map.getSource("safe-spaces-source") as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
      return;
    }

    // First time: add source + glow + core layers
    map.addSource("safe-spaces-source", { type: "geojson", data: geojson });

    // Glow layer (soft blurred circle behind core)
    map.addLayer({
      id: "safe-spaces-glow",
      type: "circle",
      source: "safe-spaces-source",
      paint: {
        "circle-radius": 22,
        "circle-color": [
          "match", ["get", "category"],
          "Parks", "#10b981",
          "Libraries", "#3b82f6",
          "Quiet Cafés", "#f59e0b",
          "Meditation Rooms", "#8b5cf6",
          "Campus Spaces", "#f97316",
          "#8b5cf6",
        ],
        "circle-blur": 0.8,
        "circle-opacity": 0.5,
      },
    });

    // Core layer (solid dot on top)
    map.addLayer({
      id: "safe-spaces-core",
      type: "circle",
      source: "safe-spaces-source",
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match", ["get", "category"],
          "Parks", "#34d399",
          "Libraries", "#60a5fa",
          "Quiet Cafés", "#fbbf24",
          "Meditation Rooms", "#a78bfa",
          "Campus Spaces", "#fb923c",
          "#a78bfa",
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Click → premium dark popup
    map.on("click", "safe-spaces-core", (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const coords = f.geometry.coordinates as [number, number];
      const { name, category, address, tags: rawTags, lat, lng } = f.properties as {
        name: string; category: string; address: string;
        tags: string; lat: number; lng: number;
      };

      let parsedTags: string[] = [];
      try { parsedTags = JSON.parse(rawTags); } catch { parsedTags = []; }

      new mapboxgl.Popup({
        className: "safe-space-popup",
        offset: 22,
        maxWidth: "300px",
        closeButton: true,
        closeOnClick: true,
      })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:system-ui,sans-serif;">
            <div style="margin-bottom:12px;">
              <h3 style="color:#ffffff;font-weight:700;font-size:15px;margin:0;letter-spacing:-0.3px;line-height:1.3;">${name}</h3>
              <div style="display:inline-block;margin-top:6px;padding:2px 10px;background:rgba(52,211,153,0.15);color:#34d399;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-radius:9999px;border:1px solid rgba(52,211,153,0.3);">
                ${category}
              </div>
              ${address ? `<p style="color:#94a3b8;font-size:11px;margin:8px 0 0;line-height:1.5;">${address}</p>` : ""}
              ${parsedTags.length ? `<div style="margin-top:8px;">${parsedTags.map((t) => `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.35);color:#6ee7b7;font-size:10px;margin:2px;">${t}</span>`).join("")}</div>` : ""}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #1e293b;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}"
                 target="_blank" rel="noopener noreferrer"
                 style="display:flex;align-items:center;justify-content:center;width:100%;background:#2563eb;color:#ffffff;font-size:11px;font-weight:600;padding:9px 16px;border-radius:8px;text-decoration:none;box-sizing:border-box;"
                 onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                Directions via Google Maps
              </a>
              <a href="http://maps.apple.com/?daddr=${lat},${lng}"
                 target="_blank" rel="noopener noreferrer"
                 style="display:flex;align-items:center;justify-content:center;width:100%;background:#334155;color:#ffffff;font-size:11px;font-weight:600;padding:9px 16px;border-radius:8px;text-decoration:none;box-sizing:border-box;"
                 onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#334155'">
                Directions via Apple Maps
              </a>
            </div>
          </div>`)
        .addTo(mapRef.current!);
    });

    // Cursor UX
    map.on("mouseenter", "safe-spaces-core", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "safe-spaces-core", () => { map.getCanvas().style.cursor = ""; });
  }

  function fetchAndRenderSafeSpaces() {
    supabase
      .from("safe_spaces")
      .select("*")
      .then(({ data }) => {
        if (data) renderSafeSpacesWebGL(data);
      });
  }

  // Store refetch fn accessible to the modal
  safeSpacesRefetchRef.current = fetchAndRenderSafeSpaces;

  useEffect(() => {
    if (!readyRef.current) {
      const id = setInterval(() => {
        if (readyRef.current) {
          clearInterval(id);
          fetchAndRenderSafeSpaces();
        }
      }, 300);
      return () => clearInterval(id);
    }
    fetchAndRenderSafeSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✈️ Render Paper Airplane markers whenever the data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    airplaneMarkersRef.current.forEach(m => m.remove());
    airplaneMarkersRef.current = [];

    airplanes.forEach((plane) => {
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer';
      el.innerHTML = `
        <div class="relative group">
          <img
            src="/neon_airplane.png"
            alt="Note"
            class="w-12 h-12 transition-all duration-300 transform scale-100 group-hover:scale-125 group-hover:-translate-y-1 hover:rotate-6 drop-shadow-[0_0_5px_rgba(168,85,247,0.9)] drop-shadow-[0_0_15px_rgba(168,85,247,0.7)]"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
          <div style="display:none" class="w-10 h-10 flex items-center justify-center text-2xl">✈️</div>
          <div class="absolute bottom-14 left-1/2 -translate-x-1/2 hidden group-hover:block w-52 bg-[#0f172a] border border-purple-500/30 text-white text-xs p-3 rounded-xl shadow-2xl pointer-events-none z-50">
            <p class="italic text-purple-200">&ldquo;${plane.message}&rdquo;</p>
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([plane.lng, plane.lat])
        .addTo(map);

      airplaneMarkersRef.current.push(marker);
    });
  }, [airplanes]);

  // Draw the quiet route
  useEffect(() => {
    if (!mapInstance) return;

    if (!quietRoute) {
      // Force remove the layer and source if they exist
      if (mapInstance.getLayer("quiet-route-layer")) {
        mapInstance.removeLayer("quiet-route-layer");
      }
      if (mapInstance.getSource("quiet-route-source")) {
        mapInstance.removeSource("quiet-route-source");
      }
      return;
    }
    
    // Add source if doesn't exist
    if (!mapInstance.getSource("quiet-route-source")) {
      mapInstance.addSource("quiet-route-source", {
        type: "geojson",
        data: quietRoute
      });
      
      mapInstance.addLayer({
        id: "quiet-route-layer",
        type: "line",
        source: "quiet-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-color": "#8b5cf6", 
          "line-width": 6,
          "line-opacity": 0.8,
        }
      });
    } else {
      const source = mapInstance.getSource("quiet-route-source") as mapboxgl.GeoJSONSource;
      source.setData(quietRoute);
    }
    
    // Fly the camera to show the route
    const coordinates = quietRoute.geometry.coordinates;
    const bounds = coordinates.reduce((b: mapboxgl.LngLatBounds, coord: number[]) => {
      return b.extend(coord as [number, number]);
    }, new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));
    
    mapInstance.fitBounds(bounds, { 
      padding: { top: 120, bottom: 120, left: 80, right: 80 }, 
      duration: 2000,
      essential: true
    });
  }, [quietRoute, mapInstance]);

  // ✈️ Paper Airplane Click Handler Logic (State-aware)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: any) => {
      if (isDroppingMode) {
        const point = map.project([e.lngLat.lng, e.lngLat.lat]);
        setDraftLocation({ 
          lat: e.lngLat.lat, 
          lng: e.lngLat.lng, 
          screenX: point.x, 
          screenY: point.y 
        });
        setDraftMessage("");
        setIsDroppingMode(false); // Turn off mode immediately after selection
      }
    };

    map.on('click', handleMapClick);
    
    // ✨ The magic touch: Change cursor to crosshair in dropping mode
    if (isDroppingMode) {
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.getCanvas().style.cursor = '';
    }

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDroppingMode]);

  // ⛈️ Get dynamic sentiment based on current city
  const getSentimentUI = (cityName: string) => {
    // If they switch to Dallas (Error / High Stress)
    if (cityName.includes("Dallas") || cityName.includes("DALLAS")) {
      return {
        wrapper: "bg-rose-900/20 border-rose-500/30 hover:bg-rose-900/40",
        icon: "⛈️",
        iconShadow: "drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]",
        textClass: "text-rose-400",
        title: "High Stress Area",
        tooltipBorder: "border-rose-500/30",
        tooltipTitle: "Thunderstorms Likely",
        tooltipDesc: `High concentration of stress detected in the ${cityName} area near campus.`
      };
    }
    
    // Default / Philadelphia (Good / Calm)
    return {
      wrapper: "bg-emerald-900/20 border-emerald-500/30 hover:bg-emerald-900/40",
      icon: "✨",
      iconShadow: "drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]",
      textClass: "text-emerald-400",
      title: "Calm Atmosphere",
      tooltipBorder: "border-emerald-500/30",
      tooltipTitle: "Clear Skies & Quiet",
      tooltipDesc: "Low stress levels detected today. It's a great time for a campus walk!"
    };
  };

  const sentiment = getSentimentUI(city.name);

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      

      <EmotionWeatherOverlay 
        map={mapInstance} 
        checkins={checkins} 
        isARModeActive={isARModeActive} 
        setIsARModeActive={setIsARModeActive} 
      />
      <ResourceMarkers map={mapInstance} resources={getResourcesByCity(city.name)} />
      <CampusLayer
        map={mapInstance}
        campuses={campuses}
        registeredCollege={registeredCollege}
        campusInsights={campusInsights}
      />
      <UserLocationLayer
        map={mapInstance}
        latitude={userLatitude}
        longitude={userLongitude}
        accuracy={userAccuracy}
      />

      {/* Safe Space Modal — shown on right-click */}
      {draftSafeSpace && (
        <AddSafeSpaceModal
          lat={draftSafeSpace.lat}
          lng={draftSafeSpace.lng}
          onClose={() => setDraftSafeSpace(null)}
          onAdded={() => safeSpacesRefetchRef.current()}
        />
      )}

      {/* ✈️ PAPER AIRPLANE DRAFT UI */}
      {draftLocation && (
        <div
          className="absolute z-[100] pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          style={{ left: draftLocation.screenX, top: draftLocation.screenY, transform: 'translate(-50%, -110%)' }}
        >
          <div className="bg-neutral-950/95 border border-purple-500/50 p-3 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-xl flex flex-col gap-2 w-52">
            <div className="flex items-center gap-2">
              <img src="/neon_airplane.png" alt="" className="w-6 h-6" />
              <span className="text-xs text-purple-300 font-bold tracking-wide">Drop a Note</span>
            </div>
            <input
              id="airplane-input"
              autoFocus
              type="text"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              placeholder="You're doing amazing..."
              className="bg-black/60 text-white text-xs p-2 rounded-lg border border-white/10 outline-none focus:border-purple-500/50 placeholder:text-neutral-600"
              onKeyDown={(e) => e.key === 'Enter' && dropAirplane()}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => setDraftLocation(null)}
                className="text-xs text-neutral-600 hover:text-white transition-colors"
              >Cancel</button>
              <button
                onClick={dropAirplane}
                disabled={!draftMessage.trim()}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                Send <img src="/neon_airplane.png" alt="" className="w-4 h-4 drop-shadow-[0_0_5px_rgba(168,85,247,0.9)] drop-shadow-[0_0_15px_rgba(168,85,247,0.7)]" />
              </button>
            </div>
          </div>
          {/* Arrow pointer */}
          <div className="w-3 h-3 bg-neutral-950 border-r border-b border-purple-500/50 rotate-45 mx-auto -mt-1.5" />
        </div>
      )}



      {/* 🏫 COMPACT CAMPUS SELECTOR & TOOLS */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        
        {/* 1. The Sliding List (Visible when isDrawerOpen is true) */}
        <div className={`flex flex-col gap-2 transition-all duration-500 ease-in-out origin-bottom ${
          isDrawerOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
        }`}>
          {ALL_COLLEGES
            .filter((uni) => uni.city === (city.name === "New York City" ? "New York City" : city.name) && uni.name !== selectedCampusName)
            .map((uni) => (
              <button
                key={uni.name}
                onClick={() => {
                  if (mapRef.current) {
                    mapRef.current.flyTo({
                      center: [uni.longitude, uni.latitude],
                      zoom: 15.5,
                      pitch: 45,
                      duration: 2000
                    });
                  }
                  setSelectedCampusName(uni.name);
                  localStorage.setItem('aura_campus', uni.name);
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 pr-4 rounded-xl border border-white/10 text-white pointer-events-auto transition-all shadow-xl group"
              >
                <div className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-md overflow-hidden">
                  <img 
                    src={`https://img.logo.dev/${uni.domain}?token=pk_VG_5jIWbQH2FsoADC0Lfqw&size=128`} 
                    className="w-5 h-5 object-contain"
                    alt=""
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${uni.name.charAt(0)}&background=random&color=fff`;
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-indigo-300 transition-colors">
                  {uni.name}
                </span>
              </button>
            ))}
        </div>

        {/* 2. The Main Trigger (Switch Campus / Home Campus) */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className={`bg-indigo-600 hover:bg-indigo-500 text-white p-2 pr-4 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-indigo-400/30 transition-all pointer-events-auto flex items-center gap-3 ${
            isDrawerOpen ? 'ring-2 ring-white scale-105' : ''
          }`}
        >
          <div className="bg-white/10 p-1.5 rounded-lg">
            <img 
              src={`https://img.logo.dev/${userCampus?.domain}?token=pk_VG_5jIWbQH2FsoADC0Lfqw&size=128`} 
              className="w-7 h-7 object-contain"
              alt="Home"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${userCampus?.name?.charAt(0) || 'H'}&background=random&color=fff`;
              }}
            />
          </div>
          <span className="text-xs font-black tracking-tighter uppercase">
            {isDrawerOpen ? "CLOSE SELECTOR" : "SWITCH CAMPUS"}
          </span>
        </button>

        {/* 3. Aura Lens Trigger Button */}
        <button
          onClick={() => setIsARModeActive(true)}
          className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md text-white font-bold py-2.5 px-4 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.5)] border border-indigo-400/30 transition-all flex items-center gap-2 pointer-events-auto"
        >
          <span className="text-lg">👁️</span> Aura Lens
        </button>

        {/* 4. Cleaner Cinematic Button */}
        <button
          onClick={() => onToggleSpin?.(!isSpinning)}
          className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md text-white p-2.5 rounded-xl shadow-lg border border-indigo-400/30 transition-all flex items-center justify-center pointer-events-auto"
        >
          <span className="text-lg">🔄</span>
        </button>
      </div>



      {/* THE UPGRADED CLOCK & STATUS DASHBOARD (Bottom Left) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-6 bg-black/80 border border-white/10 backdrop-blur-xl p-4 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 pointer-events-auto">
        
        {/* Left Side: Sentiment, Date, and Time */}
        <div className="flex flex-col min-w-[140px] relative">
          
          {/* 🌟 DYNAMIC Campus Sentiment Pill */}
          <div className={`flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full w-fit group cursor-help transition-all ${sentiment.wrapper}`}>
            <span className={`text-xs animate-pulse ${sentiment.iconShadow}`}>
              {sentiment.icon}
            </span>
            <span className={`text-[9px] font-bold tracking-widest uppercase ${sentiment.textClass}`}>
              {sentiment.title}
            </span>
            
            {/* 💬 The Hover Tooltip */}
            <div className={`absolute bottom-full left-0 mb-3 w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/95 backdrop-blur-md border p-2.5 rounded-xl text-[10px] text-neutral-200 pointer-events-none shadow-2xl z-50 ${sentiment.tooltipBorder}`}>
              <span className={`font-bold block mb-1 ${sentiment.textClass}`}>
                {sentiment.tooltipTitle}
              </span>
              {sentiment.tooltipDesc}
            </div>
          </div>

          <div className="text-[10px] text-neutral-400 font-medium tracking-wider mb-1 uppercase">
            {currentTime.date} <span className="text-purple-400 ml-1">📍 {city.name}, {CITIES.find(c => c.name === city.name)?.state || "PA"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black text-white tracking-tighter flex items-baseline gap-1 tabular-nums">
              {currentTime.time} <span className="text-xs font-bold text-neutral-500 uppercase">{currentTime.period}</span>
            </div>

            {/* ✨ Integrated Thermal Mood Matrix ✨ */}
            {onToggleThermal && (
              <ThermalMoodMatrix 
                onToggle={onToggleThermal} 
                lat={city.lat} 
                lng={city.lng} 
              />
            )}
          </div>
        </div>

        {/* Right Side: The Interactive Controls */}
        <div className="flex flex-col gap-2 pl-4 border-l border-white/10">
          
          {/* 1. Existing Safe Circle Toggle */}
          <div className="flex items-center justify-between gap-4 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isSharingLocation ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`}></span>
              <span className="text-[9px] text-neutral-400 font-bold tracking-widest uppercase">
                Safe Circle
              </span>
            </div>
            {/* iOS Style Switch */}
            <button 
              onClick={() => toggleSafeCircle(!isSharingLocation)}
              className={`w-10 h-5 rounded-full transition-all duration-300 relative flex items-center px-1 shadow-inner ${
                isSharingLocation ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
            >
              <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 shadow-md ${
                isSharingLocation ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* 2. NEW: Minimalist Anon Check-In Button */}
          <button 
            onClick={() => setIsDroppingMode(!isDroppingMode)}
            className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-lg border transition-all duration-300 ${
              isDroppingMode 
                ? "bg-purple-900/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]" 
                : "bg-white/5 border-white/5 hover:border-purple-500/50 hover:bg-white/10"
            }`}
          >
            <span className={`text-[9px] font-bold tracking-widest uppercase ${isDroppingMode ? "text-purple-300" : "text-purple-400"}`}>
              Anon Check-In
            </span>
            <span className={`text-xs ${isDroppingMode ? "animate-pulse drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" : "opacity-70"}`}>
              ✈️
            </span>
          </button>

        </div>
      </div>

      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center justify-center pointer-events-none z-50">
        
        {/* STATE 1: IDLE BUTTON */}
        {!isSettingUp && !quietRoute && (
          <button
            onClick={() => setIsSettingUp(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3 bg-neutral-900 border border-neutral-700 text-neutral-50 hover:border-violet-500/50 shadow-2xl backdrop-blur-md transition-all"
          >
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            <span className="font-semibold text-sm">Find Quiet Route</span>
          </button>
        )}

        {/* STATE 2: ADDRESS ENTRY BAR (Sleek & Horizontal) */}
        {isSettingUp && !quietRoute && (
          <div className="pointer-events-auto flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 p-2 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-300">
            <input 
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="From..."
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-200 w-40 focus:outline-none focus:border-violet-500/50"
            />
            <div className="text-neutral-600">→</div>
            <input 
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="To: (e.g. Founder's Garden)"
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-200 w-48 focus:outline-none focus:border-violet-500/50"
            />
            <button 
              onClick={() => {
                if (fromAddress === "My Current Location" && userLocation) {
                  calculateQuietRoute(userLocation);
                } else {
                  calculateQuietRoute();
                }
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 text-xs font-bold transition-colors"
            >
              Go
            </button>
            <button onClick={() => setIsSettingUp(false)} className="text-neutral-500 hover:text-neutral-300 px-2 text-lg">×</button>
          </div>
        )}
      </div>

      {/* STATE 3: THE COMPACT ACTIVE HUD (Top of Screen) */}
      {quietRoute && (
        <div className="absolute top-6 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-6 bg-neutral-900/80 border border-violet-500/30 backdrop-blur-md px-5 py-2.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-4 duration-500">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 border-r border-neutral-800 pr-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Quiet Route</span>
            </div>

            <div className="w-px h-6 bg-neutral-700" />

            {/* THE NEW POV BUTTON */}
            <button 
              onClick={() => {
                const coords = quietRoute.geometry.coordinates;
                if (coords && coords.length >= 2) {
                  enterPOVMode(coords[0], coords[1]);
                }
              }}
              className="flex items-center gap-2 group cursor-pointer hover:bg-neutral-800 px-3 py-1 rounded-lg transition-colors"
            >
              <span className="text-white font-bold text-lg group-hover:text-violet-400 transition-colors">{routeStats?.eta}</span>
              <span className="text-neutral-500 text-sm font-medium">{routeStats?.distance}</span>
              <span className="ml-2 bg-violet-500/20 text-violet-300 px-2 py-1 rounded text-[10px] font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                ENTER POV
              </span>
            </button>

            <div className="w-px h-6 bg-neutral-700" />

            {/* Instruction Section (The "Sleek" part) */}
            <div className="hidden md:flex items-center gap-2 text-xs text-neutral-300 font-medium max-w-[200px] truncate">
              <svg className="w-3 h-3 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              {routeStats?.nextTurn}
            </div>

            {/* End Button */}
            <button 
              onClick={(e) => {
                e.preventDefault(); // Prevents any weird page reloads
                handleEndNavigation();
              }} 
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors border border-red-500/20 z-50 pointer-events-auto"
            >
              End
            </button>
          </div>
        </div>
      )}

    </>
  );
}
