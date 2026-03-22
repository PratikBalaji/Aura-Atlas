"use client";
import { useState, useEffect, useRef } from "react";

export default function PresageMonitor() {
  const [isActive, setIsActive] = useState(false);
  const [vitals, setVitals] = useState({ pulse: "--", breathing: "--" });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let eventSource: EventSource;

    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });

      eventSource = new EventSource("/api/presage-stream");
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setVitals(data);
      };
    } else {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isActive]);

  return (
    <div className="relative flex flex-col items-start z-[60]">
      {isActive && (
        <div className="relative w-64 h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/50 animate-fade-in-up mb-3">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-70 grayscale" />
          
          {/* Facial Tracking / UI Overlay */}
          <div className="absolute inset-0 border-[1px] border-white/10 m-4 rounded-lg flex items-center justify-center">
            <div className="w-24 h-32 border border-emerald-400/50 rounded-full border-dashed animate-pulse"></div>
          </div>

          {/* Live Metrics */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-3 flex justify-between border-t border-white/10">
             <div>
               <div className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Pulse</div>
               <div className="text-xl font-black text-rose-400 leading-none">{vitals.pulse} <span className="text-[10px] text-rose-400/50">BPM</span></div>
             </div>
             <div className="text-right">
               <div className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Breathing</div>
               <div className="text-xl font-black text-emerald-400 leading-none">{vitals.breathing} <span className="text-[10px] text-emerald-400/50">BPM</span></div>
             </div>
          </div>
          
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-white text-[8px] font-black uppercase tracking-widest shadow-lg">Presage</span>
          </div>
        </div>
      )}

      {/* The Dynamic Expanding Button */}
      <button 
        onClick={() => setIsActive(!isActive)}
        className={`flex items-center gap-3 h-12 rounded-full transition-[width,background-color,border-color] duration-500 ease-out overflow-hidden text-left group/btn shadow-lg ${
          isActive 
            ? "w-48 bg-white/20 border border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
            : "w-12 hover:w-48 bg-transparent border border-transparent hover:bg-black text-white/70 hover:text-white"
        }`}
      >
        <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full transition-colors ${
          isActive ? "bg-transparent" : "bg-white/10 group-hover/btn:bg-transparent"
        }`}>
          🫀
        </div>
        <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
        }`}>
          Vitals Scan
        </span>
      </button>
    </div>
  );
}
