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
  const [selectedCampusName, setSelectedCampusName] = useState<string>(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('aura_campus') || "Temple University"
      : "Temple University"
  );
  
  const userCampus = ALL_COLLEGES.find(college => college.name === selectedCampusName);
  const [isDroppingMode, setIsDroppingMode] = useState(false);

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
            className="absolute top-6 right-28 bg-neutral-900 border border-white/15 p-3 rounded-full hover:bg-neutral-800 transition-colors z-[60] pointer-events-auto"
          >
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[10px] text-white font-bold items-center justify-center">!</span>
            </span>
            <Heart className="h-5 w-5 text-teal-400" />
          </button>
        )}

        {/* Top Center: Location Search */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
          <div className="flex flex-col items-center pointer-events-auto">
            <CityNavigator currentIndex={cityIndex} onNavigate={setCityIndex} />
          </div>
        </div>

        {/* Bottom-left HUD */}
        <div className="absolute bottom-10 left-6 z-[50] flex items-end gap-6 pointer-events-none">
          
          {/* Left Side: Clock + Thermal */}
          <div className="flex flex-col gap-1">
            {/* Clock */}
            <div className="flex items-baseline gap-1 drop-shadow-lg">
              <h1 className="text-5xl font-black text-white/90 tracking-tighter tabular-nums">
                {currentTime.time}
              </h1>
              <span className="text-lg font-medium text-white/50 uppercase ml-1">{currentTime.period}</span>
            </div>

            {/* Thermal radar */}
            <div className="pointer-events-auto mt-2">
              <ThermalMoodMatrix 
                onToggle={setShowThermalRadar} 
                lat={city.lat} 
                lng={city.lng} 
              />
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-16 bg-white/10 mb-2 invisible sm:visible" />

          <div className="flex flex-col gap-2 mb-2 pointer-events-auto">
            {userLocation.latitude !== null && (
              <button
                onClick={() => setLocateMeTrigger(n => n + 1)}
                className="flex items-center gap-2 px-3.5 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-black/60 hover:border-white/20 transition-colors"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium tracking-wide">Locate Me</span>
              </button>
            )}

            <button
              onClick={() => setIsDroppingMode(!isDroppingMode)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-colors backdrop-blur-xl ${
                isDroppingMode
                  ? "bg-purple-900/30 border-purple-500/50 text-purple-300"
                  : "bg-black/40 border-white/10 text-white/70 hover:border-white/20 hover:text-white"
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium tracking-wide">Anon Check-In</span>
            </button>
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
                    <span className="text-[11px] font-medium text-white/80 group-hover:text-white transition-colors">
                      {uni.name}
                    </span>
                  </button>
                ))}
            </div>

            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`bg-slate-800 hover:bg-slate-700 text-white p-2 pr-4 rounded-xl border border-white/10 transition-colors flex items-center gap-3 ${
                isDrawerOpen ? 'ring-1 ring-teal-400/50' : ''
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
              <span className="text-xs font-semibold tracking-tight">
                {isDrawerOpen ? "Close" : "Switch Campus"}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => setIsARModeActive(true)}
              className="bg-slate-800 hover:bg-slate-700 backdrop-blur-md text-white font-medium py-2.5 px-4 rounded-xl border border-white/10 transition-colors flex items-center gap-2"
            >
              <Eye className="h-4 w-4 text-teal-400" /> Aura Lens
            </button>

            <button
              onClick={() => setIsSpinning(!isSpinning)}
              className={`backdrop-blur-md text-white p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
                isSpinning ? 'bg-teal-600 border-teal-500/50' : 'bg-slate-800 hover:bg-slate-700 border-white/10'
              }`}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* Location error toast */}
        {userLocation.error && (
          <div className="pointer-events-none absolute bottom-32 left-1/2 z-[50] -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/80 px-4 py-2 text-xs text-red-300 shadow-lg backdrop-blur-md">
            {userLocation.error}
          </div>
        )}
      </div>

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

