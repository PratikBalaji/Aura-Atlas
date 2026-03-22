"use client";
import { useState, useEffect } from "react";

export default function ThermalMoodMatrix({ 
  onToggle, 
  lat, 
  lng 
}: { 
  onToggle: (active: boolean) => void;
  lat: number;
  lng: number;
}) {
  const [isActive, setIsActive] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; humidity: number; condition: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ impact: string; recommendation: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = () => {
    const newState = !isActive;
    setIsActive(newState);
    onToggle(newState);
  };

  useEffect(() => {
    if (!isActive) return;

    const fetchThermalData = async () => {
      setIsLoading(true);
      try {
        const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,is_day&temperature_unit=fahrenheit`);
        const meteoData = await meteoRes.json();

        const temp = Math.round(meteoData.current.temperature_2m);
        const humidity = meteoData.current.relative_humidity_2m;
        const condition = meteoData.current.is_day ? "Daytime" : "Nighttime";

        setWeather({ temp, humidity, condition });

        const aiRes = await fetch("/api/thermal-mood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temp, humidity, condition })
        });
        
        const aiData = await aiRes.json();
        setAnalysis(aiData);
      } catch (error) {
        console.error("Thermal Matrix Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThermalData();
  }, [isActive, lat, lng]);

  return (
    // 'relative' ensures the popup card anchors directly to this tiny button!
    <div className="relative z-[50] flex flex-col items-start pointer-events-auto">
      
      {/* 🧠 The AI Popup Card (Renders absolute, popping UP above the button) */}
      {isActive && (
        <div className="absolute bottom-full mb-3 left-0 w-64 bg-black/75 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl animate-fade-in-up origin-bottom-left">
          {isLoading ? (
            <div className="flex items-center gap-3 py-1">
               <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-neutral-300 text-[9px] uppercase tracking-widest font-bold animate-pulse">Scanning Atmosphere...</span>
            </div>
          ) : weather && analysis ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white tracking-tighter">{weather.temp}°</span>
                  <span className="text-[9px] text-neutral-400 uppercase tracking-widest">{weather.humidity}% Hum</span>
                </div>
                <div className="text-[8px] font-bold text-rose-300 uppercase tracking-widest bg-rose-500/20 px-2 py-1 rounded border border-rose-500/30">
                  Mood Matrix
                </div>
              </div>
              <p className="text-neutral-300 text-[10px] leading-relaxed line-clamp-3">
                {analysis.impact}
              </p>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <p className="text-rose-200 text-[9px] font-medium tracking-wide leading-tight">
                  <span className="mr-1">💡</span>{analysis.recommendation}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 🎛️ The Dynamic Expanding Button */}
      <button 
        onClick={handleToggle}
        className={`flex items-center gap-3 h-12 rounded-full transition-[width,background-color,border-color] duration-500 ease-out overflow-hidden text-left group/btn shadow-lg ${
          isActive 
            ? "w-48 bg-white/20 border border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
            : "w-12 hover:w-48 bg-transparent border border-transparent hover:bg-black text-white/70 hover:text-white"
        }`}
      >
        <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full transition-colors ${
          isActive ? "bg-transparent" : "bg-white/10 group-hover/btn:bg-transparent"
        }`}>
          🌡️
        </div>
        <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
        }`}>
          Thermal Radar
        </span>
      </button>
    </div>
  );
}
