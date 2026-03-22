"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, MapPin, Eye, RotateCw, Heart, ChevronDown, Crosshair, Send } from "lucide-react";
import CityNavigator from "@/components/CityNavigator";
import DailyCheckInModal from "@/components/DailyCheckInModal";
import DailyCheckInReminder from "@/components/DailyCheckInReminder";
import LocalClock from "@/components/LocalClock";
import { useDailyCheckIn } from "@/hooks/useDailyCheckIn";
import {
  CampusEmotionResponse,
  CheckIn,
  CITIES,
  College,
} from "@/lib/types";
import { generateSeedCheckins } from "@/lib/seedCheckins";
import { useUserLocation } from "@/hooks/useUserLocation";
import ThermalMoodMatrix from "@/components/ThermalMoodMatrix";
import { ALL_COLLEGES } from "@/lib/collegeList";
import AuraLens from "@/components/AuraLens";
import PresageMonitor from "@/components/PresageMonitor";
import AuraPointsButton from "@/components/AuraPointsButton";

const AuraPointsScanner = dynamic(() => import("@/components/AuraPointsScanner"), {
  ssr: false,
});

const Map3DView = dynamic(() => import("@/components/Map3DView"), {
  ssr: false,
});

export default function Home() {

  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [cityIndex, setCityIndex] = useState(0);
  const [timeFilter, setTimeFilter] = useState("All");
  const [isCampusMode, setIsCampusMode] = useState(false);
  const [registeredCollege, setRegisteredCollege] = useState<College | null>(null);
  const [cityColleges, setCityColleges] = useState<College[]>([]);
  const [campusInsights, setCampusInsights] = useState<CampusEmotionResponse | null>(null);

  const [isSpinning, setIsSpinning] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  
  const [smileScore, setSmileScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isNewUser, setIsNewUser] = useState(true);
  const [showThermalRadar, setShowThermalRadar] = useState(false);
  const [showQuietRoute, setShowQuietRoute] = useState(false);
  const [showAuraPointsScanner, setShowAuraPointsScanner] = useState(false);
  const [showDeloittePulse, setShowDeloittePulse] = useState(false);
  const [hoveredDockItem, setHoveredDockItem] = useState<string | null>(null);

  const didAutoCenterRef = useRef(false);
  const city = CITIES[cityIndex];

  // ── Live user location ──────────────────────────────────────────
  const userLocation = useUserLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [locateMeTrigger, setLocateMeTrigger] = useState(0);

  const [currentTime, setCurrentTime] = useState<{ time: string; period: string; date: string }>({
    time: "00:00:00",
    period: "PM",
    date: ""
  });

  // Navigation & AR state
  const [isARModeActive, setIsARModeActive] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCampusName, setSelectedCampusName] = useState<string>("Temple University");

  // Defer localStorage read to avoid SSR/client hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem('aura_campus');
    if (saved) setSelectedCampusName(saved);
  }, []);
  
  const userCampus = ALL_COLLEGES.find(college => college.name === selectedCampusName);
  const [isDroppingMode, setIsDroppingMode] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [demoStatus, setDemoStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  const fetchCheckins = useCallback(async () => {
    try {
      const response = await fetch(`/api/checkins?city=${encodeURIComponent(city.name)}`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      setCheckins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load checkins:", err);
      setCheckins([]);
    }
  }, [city.name]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  useEffect(() => {
    // Load saved data on mount
    const storedScore = localStorage.getItem('aura_smileScore');
    const storedStreak = localStorage.getItem('aura_streak');
    const lastCheckInStr = localStorage.getItem('lastAuraCheckIn');
    
    if (storedScore) {
      setSmileScore(parseInt(storedScore));
      setStreak(parseInt(storedStreak || '0'));
      setIsNewUser(false);
    } else {
      // If no score exists, they are a new user!
      setIsNewUser(true);
      setNeedsCheckIn(true); 
      return;
    }

    // 24-Hour Lock Logic
    const lastCheckInTime = parseInt(lastCheckInStr || '0', 10);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (Date.now() - lastCheckInTime > TWENTY_FOUR_HOURS) {
      setNeedsCheckIn(true);
    }
  }, []);

  const handleLiveScoreUpdate = (newScore: number) => {
    setSmileScore(newScore);
  };

  const handleCheckInComplete = (newScore: number, newStreak: number) => {
    setSmileScore(newScore);
    setStreak(newStreak);
    setNeedsCheckIn(false);
    setIsNewUser(false);
    fetchCheckins(); // refresh map immediately after user submits check-in
  };

  const handleNewCheckin = useCallback(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  const handleLocateMe = useCallback(() => {
    if (userLocation.latitude === null || userLocation.longitude === null) {
      userLocation.start();
    }

    setLocateMeTrigger((n) => n + 1);
  }, [userLocation]);

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    setDemoStatus('idle');
    try {
      const res = await fetch('/api/dev/seed', { method: 'POST' });
      if (res.ok) {
        await fetchCheckins();
        setDemoStatus('ok');
      } else {
        const body = await res.json().catch(() => ({}));
        console.error('Seed failed:', body?.error);
        setDemoStatus('err');
      }
    } catch (e) {
      console.error('Seed failed:', e);
      setDemoStatus('err');
    } finally {
      setIsSeeding(false);
      setTimeout(() => setDemoStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetch("/api/campus/me")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const college = payload?.college as College | null;
        setRegisteredCollege(college ?? null);

        if (!didAutoCenterRef.current && college?.city) {
          const campusCityIndex = CITIES.findIndex((candidate) => candidate.name === college.city);
          if (campusCityIndex >= 0) {
            setCityIndex(campusCityIndex);
            didAutoCenterRef.current = true;
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load campus profile:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/colleges?city=${encodeURIComponent(city.name)}`)
      .then(async (response) => {
        if (!response.ok) {
          // colleges table may not exist yet — silently fall back
          if (isMounted) setCityColleges([]);
          return;
        }
        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        setCityColleges(Array.isArray(payload?.colleges) ? payload.colleges : []);
      })
      .catch(() => {
        if (isMounted) {
          setCityColleges([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [city.name]);

  useEffect(() => {
    if (!registeredCollege?.id) {
      setCampusInsights(null);
      return;
    }

    let isMounted = true;

    fetch(`/api/campus/${encodeURIComponent(registeredCollege.id)}/emotions`)
      .then(async (response) => {
        if (!response.ok) {
          if (isMounted) setCampusInsights(null);
          return;
        }
        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        setCampusInsights(payload as CampusEmotionResponse);
      })
      .catch(() => {
        if (isMounted) {
          setCampusInsights(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [registeredCollege?.id]);

  // Clock (city-aware timezone)
  useEffect(() => {
    const tzMap: Record<string, string> = {
      'New York City': 'America/New_York',
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
      const timeStr = now.toLocaleTimeString('en-US', { 
        timeZone: tz, 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const dateStr = now.toLocaleDateString('en-US', { 
        timeZone: tz, 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      const [timePart, period] = timeStr.split(' ');
      setCurrentTime({ time: timePart, period, date: dateStr });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [city.name]);

  // Keyboard navigation
  useEffect(() => {
    setIsCampusMode(false);

    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setCityIndex((index) => (index - 1 + CITIES.length) % CITIES.length);
      } else if (event.key === "ArrowRight") {
        setCityIndex((index) => (index + 1) % CITIES.length);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const effectiveCampusName = registeredCollege?.name ?? checkins.find((checkin) => checkin.campus_name)?.campus_name;

  // Generate deterministic seed points for the current city so weather
  // overlays always have enough data to display emotional weather events.
  const seedPoints = useMemo(() => generateSeedCheckins(city), [city]);

  const filteredCheckins = useMemo(() => {
    const realFiltered = checkins.filter((checkin) => {
      if (isCampusMode) {
        if (registeredCollege?.id) {
          const matchesId = checkin.college_id === registeredCollege.id;
          const matchesName = checkin.campus_name === registeredCollege.name;
          if (!matchesId && !matchesName) {
            return false;
          }
        } else if (!checkin.campus_name) {
          return false;
        }
      }

      if (timeFilter === "All") return true;
      const hour = new Date(checkin.timestamp).getHours();
      if (timeFilter === "Morning") return hour >= 5 && hour < 12;
      if (timeFilter === "Afternoon") return hour >= 12 && hour < 17;
      if (timeFilter === "Evening") return hour >= 17 && hour < 21;
      if (timeFilter === "Night") return hour >= 21 || hour < 5;
      return true;
    });

    // Merge seed points (they also respect time filter)
    const filteredSeeds = timeFilter === "All"
      ? seedPoints
      : seedPoints.filter((checkin) => {
          const hour = new Date(checkin.timestamp).getHours();
          if (timeFilter === "Morning") return hour >= 5 && hour < 12;
          if (timeFilter === "Afternoon") return hour >= 12 && hour < 17;
          if (timeFilter === "Evening") return hour >= 17 && hour < 21;
          if (timeFilter === "Night") return hour >= 21 || hour < 5;
          return true;
        });

    return [...realFiltered, ...filteredSeeds];
  }, [checkins, isCampusMode, registeredCollege?.id, registeredCollege?.name, timeFilter, seedPoints]);

  return (
    <div className="h-screen w-full overflow-hidden bg-black p-2 sm:p-4">
      <div ref={mapContainerRef} className="relative h-full w-full overflow-hidden rounded-[26px] border border-[var(--border-soft)] shadow-2xl sm:rounded-[32px]">
        <Map3DView
          checkins={filteredCheckins}
          city={city}
          focusedCampus={isCampusMode ? effectiveCampusName : undefined}
          campuses={cityColleges}
          registeredCollege={registeredCollege}
          campusInsights={campusInsights}
          focusRegisteredCampus={isCampusMode}
          isSpinning={isSpinning}
          onToggleSpin={setIsSpinning}
          showThermalRadar={showThermalRadar}
          onToggleThermal={setShowThermalRadar}
          userLatitude={userLocation.latitude}
          userLongitude={userLocation.longitude}
          userAccuracy={userLocation.accuracy}
          locateMeTrigger={locateMeTrigger}
          isARModeActive={isARModeActive}
          setIsARModeActive={setIsARModeActive}
          selectedCampusName={selectedCampusName}
          setSelectedCampusName={setSelectedCampusName}
          isDroppingMode={isDroppingMode}
          setIsDroppingMode={setIsDroppingMode}
          isSettingUp={showQuietRoute}
          setIsSettingUp={setShowQuietRoute}
          onNewCheckin={handleNewCheckin}
          showDeloittePulse={showDeloittePulse}
        />

        {!isNewUser && (
          <Link
            href="/report"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 border border-white/10 backdrop-blur-xl px-5 py-2.5 rounded-full z-40 hover:bg-black/70 hover:border-white/20 transition-all pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium leading-none">Smile Score</span>
                <span className="text-white font-mono font-semibold text-lg leading-tight">{smileScore.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-white font-medium text-sm">{streak} Day{streak !== 1 && 's'}</span>
            </div>
          </Link>
        )}

{needsCheckIn && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="absolute top-6 right-28 bg-neutral-900 border border-white/15 p-3 rounded-full hover:bg-black hover:translate-x-3 transition-all duration-250 ease-out z-[60] pointer-events-auto"
          >
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[10px] text-white font-bold items-center justify-center">!</span>
            </span>
            <Heart className="h-5 w-5 text-teal-400" />
          </button>
        )}

        {/* 🏝️ THE DYNAMIC ISLAND (Top-Center) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[50] pointer-events-auto animate-fade-in-down group">
          
          <div className="flex items-center gap-4 bg-black/30 backdrop-blur-3xl border border-white/10 px-6 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:bg-black/40 hover:border-white/20 transition-all cursor-default">
            
            {/* 1. Location (Now Dynamic) */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] drop-shadow-md">📍</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-white tracking-widest uppercase drop-shadow-sm leading-tight">
                  {city.name}
                </span>
                <span className="text-[8px] font-medium text-white/40 uppercase tracking-tighter">Current City</span>
              </div>
            </div>

            {/* 2. Glass Separator */}
            <div className="w-[1px] h-4 bg-white/20 rounded-full"></div>

            {/* 3. The Integrated Real-Time Clock */}
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-white tracking-wider drop-shadow-md tabular-nums">
                {currentTime.time}
              </span>
              <span className="text-[9px] font-bold text-white/60 uppercase">{currentTime.period}</span>
            </div>

            {/* 4. Glass Separator */}
            <div className="w-[1px] h-4 bg-white/20 rounded-full"></div>

            {/* 5. Vibe / Weather */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] drop-shadow-md">☁️</span>
              <span className="text-[11px] font-black text-white/90 tracking-widest">
                65°
              </span>
            </div>

          </div>
          
          {/* Subtle City Switcher Overlay (Hidden until hover) */}
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
             <CityNavigator currentIndex={cityIndex} onNavigate={setCityIndex} />
          </div>
        </div>

        {/* 🎛️ THE VISION PRO EXPANDING DOCK (Bottom-Left) */}
        <div className="absolute bottom-6 left-6 z-[50] pointer-events-auto">
          <div className="flex flex-col gap-2 bg-neutral-900/90 backdrop-blur-3xl border border-white/10 p-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] w-16 overflow-visible">

            {/* The React Components */}
            <div
              onMouseEnter={() => setHoveredDockItem('thermal')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'thermal' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'thermal' ? 'opacity-35' : 'opacity-100'}`}
            >
              <ThermalMoodMatrix onToggle={setShowThermalRadar} lat={city.lat} lng={city.lng} />
            </div>
            <div
              onMouseEnter={() => setHoveredDockItem('lens')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'lens' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'lens' ? 'opacity-35' : 'opacity-100'}`}
            >
              <AuraLens isActive={isARModeActive} setIsActive={setIsARModeActive} />
            </div>
            <div
              onMouseEnter={() => setHoveredDockItem('presage')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'presage' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'presage' ? 'opacity-35' : 'opacity-100'}`}
            >
              <PresageMonitor />
            </div>
            <div
              onMouseEnter={() => setHoveredDockItem('aurapoints')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'aurapoints' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'aurapoints' ? 'opacity-35' : 'opacity-100'}`}
            >
              <AuraPointsButton isActive={showAuraPointsScanner} onToggle={() => setShowAuraPointsScanner(!showAuraPointsScanner)} />
            </div>

            {/* 📊 DELOITTE URBAN PULSE */}
            <div
              onMouseEnter={() => setHoveredDockItem('deloitte')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'deloitte' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'deloitte' ? 'opacity-35' : 'opacity-100'}`}
            >
              <button 
                onClick={() => setShowDeloittePulse(!showDeloittePulse)}
                className={`flex items-center gap-3 h-12 rounded-full transition-[width,background-color,border-color] duration-500 ease-out overflow-hidden text-left group/btn shadow-lg outline-none ${
                  showDeloittePulse 
                    ? "w-72 bg-black border border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                    : "w-12 hover:w-72 bg-transparent border border-transparent hover:bg-black text-white/70 hover:text-white"
                }`}
              >
                <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full transition-colors ${
                  showDeloittePulse ? "bg-transparent" : "bg-white/10 group-hover/btn:bg-transparent"
                }`}>
                  📊
                </div>
                <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
                  showDeloittePulse ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
                }`}>
                  Deloitte Urban Pulse
                </span>
              </button>
            </div>

            {/* Locate Me */}
             <div
               onMouseEnter={() => setHoveredDockItem('locate')}
               onMouseLeave={() => setHoveredDockItem(null)}
               className={`transition-all duration-250 ease-out origin-left ${
                 hoveredDockItem === 'locate' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
               } ${hoveredDockItem && hoveredDockItem !== 'locate' ? 'opacity-35' : 'opacity-100'}`}
             >
               <button
                 onClick={handleLocateMe}
                 className="flex items-center gap-3 h-12 w-12 hover:w-48 rounded-full transition-[width,background-color] duration-500 ease-out overflow-hidden text-left group/btn bg-transparent hover:bg-black text-white/70 hover:text-white border border-transparent"
               >
                 <div className="w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full bg-white/10 group-hover/btn:bg-transparent transition-colors">📍</div>
                 <span className="text-[10px] font-bold tracking-widest uppercase whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 delay-100">Locate Me</span>
               </button>
             </div>

            {/* Elegant Separator Line */}
            <div className={`w-8 h-[1px] bg-white/20 mx-auto my-1 rounded-full transition-opacity duration-250 ${hoveredDockItem ? 'opacity-10' : ''}`}></div>

            {/* Anon Check-In Button */}
            <div
              onMouseEnter={() => setHoveredDockItem('checkin')}
              onMouseLeave={() => setHoveredDockItem(null)}
              className={`transition-all duration-250 ease-out origin-left ${
                hoveredDockItem === 'checkin' ? 'translate-x-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''
              } ${hoveredDockItem && hoveredDockItem !== 'checkin' ? 'opacity-35' : 'opacity-100'}`}
            >
              <button
                onClick={() => setIsDroppingMode(!isDroppingMode)}
                className={`flex items-center gap-3 h-12 rounded-full transition-[width,background-color] duration-500 ease-out overflow-hidden text-left group/btn border border-transparent ${
                  isDroppingMode
                    ? "w-48 bg-white/20 border-white/40 text-white"
                    : "w-12 hover:w-48 bg-transparent hover:bg-black text-white/70 hover:text-white"
                }`}
              >
                <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full transition-colors ${
                  isDroppingMode ? "bg-transparent" : "bg-white/10 group-hover/btn:bg-transparent"
                }`}>
                  ✈️
                </div>
                <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
                  isDroppingMode ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
                }`}>
                  Anon Check-In
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* Bottom-right controls */}
        <div className="absolute bottom-10 right-6 z-[50] flex flex-col items-end gap-3 pointer-events-auto">
          
          {/* Campus selector & tools */}
          <div className="flex flex-col items-end gap-3">
            
            {/* Campus list */}
            <div className={`flex flex-col gap-2 transition-all duration-500 ease-in-out origin-bottom ${
              isDrawerOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
            }`}>
              {ALL_COLLEGES
                .filter((uni) => uni.city === (city.name === "New York City" ? "New York City" : city.name) && uni.name !== selectedCampusName)
                .map((uni) => (
                  <button
                    key={uni.name}
                    onClick={() => {
                      setLocateMeTrigger(n => n + 1); // Trigger a re-center if handled by Map3DView for campus
                      // Note: We need a way to fly to the uni. 
                      // For now, updating state will let Map3DView handle if it reacts to selectedCampusName
                      setSelectedCampusName(uni.name);
                      localStorage.setItem('aura_campus', uni.name);
                      setIsDrawerOpen(false);
                    }}
                    className="flex items-center gap-3 bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 pr-4 rounded-xl border border-white/10 text-white transition-all shadow-xl group"
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
                    <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-indigo-300 transition-colors text-white/80">
                      {uni.name}
                    </span>
                  </button>
                ))}
            </div>

            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`bg-indigo-600 hover:bg-indigo-500 text-white p-2 pr-4 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-indigo-400/30 transition-all flex items-center gap-3 ${
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
              <span className="text-xs font-black tracking-tighter uppercase text-white">
                {isDrawerOpen ? "CLOSE SELECTOR" : "SWITCH CAMPUS"}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-indigo-200 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Cinematic Button */}
            <button
              onClick={() => setIsSpinning(!isSpinning)}
              className={`backdrop-blur-md text-white p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
                isSpinning ? 'bg-teal-600 border-teal-500/50' : 'bg-slate-800 hover:bg-slate-700 border-white/10'
              }`}
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Demo Mode */}
            <button
              onClick={handleSeedDemo}
              disabled={isSeeding}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                demoStatus === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : demoStatus === 'err'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
              }`}
              title="Load demo data"
            >
              {isSeeding ? '⏳' : demoStatus === 'ok' ? '✓ Seeded' : demoStatus === 'err' ? '✗ Failed' : 'Demo'}
            </button>
          </div>
        </div>

        {/* Location error toast */}
        {userLocation.error && userLocation.hasRequested && (
          <div className="pointer-events-none absolute bottom-32 left-1/2 z-[50] -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/80 px-4 py-2 text-xs text-red-300 shadow-lg backdrop-blur-md">
            {userLocation.error}
          </div>
        )}
      </div>

      {/* Aura Points Scanner */}
      {showAuraPointsScanner && (
        <AuraPointsScanner
          onClose={() => setShowAuraPointsScanner(false)}
          onPointsAwarded={(newScore) => setSmileScore(newScore)}
          userLatitude={userLocation.latitude}
          userLongitude={userLocation.longitude}
        />
      )}

      {/* Daily check-in modal */}
      {isModalOpen && (
        <DailyCheckInModal 
          isNewUser={isNewUser}
          onClose={() => setIsModalOpen(false)} 
          onScoreUpdate={handleLiveScoreUpdate} // Pass the live updater
          onComplete={handleCheckInComplete} 
        />
      )}
    </div>
  );
}
