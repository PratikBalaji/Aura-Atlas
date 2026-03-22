"use client";
import { useEffect, useRef, useState } from "react";
import {
  FACTOR_WEIGHTS, BUILDING_ATTRIBUTES, AURA_FEATURES,
  getAuraGrade, getSmileScoreReward, getBuildingSmileReward, MAX_AURA_SCORE,
} from "@/lib/auraPoints";
import type { EnvironmentFactor, ScanResult, IndoorAuraResult, BuildingResult } from "@/lib/auraPoints";

export default function AuraPointsScanner({
  onClose,
  onPointsAwarded,
  userLatitude,
  userLongitude,
}: {
  onClose: () => void;
  onPointsAwarded?: (points: number) => void;
  userLatitude?: number | null;
  userLongitude?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [parsedFactors, setParsedFactors] = useState<EnvironmentFactor[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [smileReward, setSmileReward] = useState(0);

  // ── Camera ──────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access denied!", err);
      }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── Animated score counter ──────────────────────────────────────
  useEffect(() => {
    if (!scanResult) return;
    const target = scanResult.type === 'aura'
      ? Object.values(scanResult.factors).reduce((sum, f) => sum + f.score, 0)
      : scanResult.smileyScore;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 60));
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      setAnimatedScore(current);
      if (current >= target) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [scanResult]);

  // ── Parse indoor factors ────────────────────────────────────────
  useEffect(() => {
    if (!scanResult || scanResult.type !== 'aura') { setParsedFactors([]); return; }
    const factors: EnvironmentFactor[] = Object.entries(scanResult.factors).map(([key, val]) => {
      const weight = FACTOR_WEIGHTS[key as keyof typeof FACTOR_WEIGHTS];
      return {
        name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        score: val.score,
        maxScore: weight?.max ?? 100,
        icon: weight?.icon ?? '?',
        description: val.description,
        category: weight?.category ?? 'spatial',
      };
    });
    setParsedFactors(factors);
  }, [scanResult]);

  // ── Capture & Analyze (NON-BLOCKING on location) ────────────────
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setScanResult(null);
    setAnimatedScore(0);
    setShowBreakdown(false);
    setPointsAwarded(false);
    setSmileReward(0);
    setScanProgress(0);

    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 1.5, 90));
    }, 100);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL("image/jpeg", 0.7);

    try {
      // Send location if available — never block on it
      const res = await fetch("/api/aura-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          latitude: userLatitude ?? null,
          longitude: userLongitude ?? null,
        }),
      });
      const data: ScanResult = await res.json();
      clearInterval(progressInterval);
      setScanProgress(100);
      setScanResult(data);

      // Award Smile Score based on result type
      let reward: number;
      let historyScore: number;
      let historySummary: string;

      if (data.type === 'aura') {
        const total = Object.values(data.factors).reduce((sum, f) => sum + f.score, 0);
        reward = getSmileScoreReward(total);
        historyScore = total;
        historySummary = data.summary;
      } else {
        reward = getBuildingSmileReward(data.smileyScore);
        historyScore = data.smileyScore;
        historySummary = `${data.buildingName} — ${data.vibe}`;
      }

      setSmileReward(reward);
      const currentScore = parseInt(localStorage.getItem('aura_smileScore') || '0');
      const newScore = currentScore + reward;
      localStorage.setItem('aura_smileScore', newScore.toString());

      // Save to history
      const history = JSON.parse(localStorage.getItem('aura_pointsHistory') || '[]');
      history.push({
        score: historyScore,
        timestamp: Date.now(),
        summary: historySummary,
        type: data.type,
        campus: data.locationContext?.campus,
      });
      if (history.length > 50) history.shift();
      localStorage.setItem('aura_pointsHistory', JSON.stringify(history));

      setPointsAwarded(true);
      onPointsAwarded?.(newScore);
    } catch (err) {
      console.error("Aura Points analysis failed", err);
      clearInterval(progressInterval);
    } finally {
      setIsScanning(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────
  const isIndoor = scanResult?.type === 'aura';
  const isBuilding = scanResult?.type === 'building';
  const indoorResult = isIndoor ? (scanResult as IndoorAuraResult) : null;
  const buildingResult = isBuilding ? (scanResult as BuildingResult) : null;

  const actualTotal = indoorResult
    ? Object.values(indoorResult.factors).reduce((sum, f) => sum + f.score, 0)
    : 0;
  const grade = isIndoor ? getAuraGrade(actualTotal) : { grade: '', color: '#14b8a6' };

  // Location badge helper
  const locationCtx = scanResult?.locationContext;
  const showCampusBadge = locationCtx && locationCtx.campus === 'UVA';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden font-sans animate-fade-in">

      {/* Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scanLine { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
        .animate-scan-line { animation: scanLine 3s ease-in-out infinite; }
        @keyframes scoreReveal { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        .animate-score-reveal { animation: scoreReveal 0.8s ease-out forwards; }
        @keyframes factorSlide { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-factor-slide { animation: factorSlide 0.4s ease-out forwards; }
        @keyframes emojiPop { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
        .animate-emoji-pop { animation: emojiPop 0.5s ease-out forwards; }
      `}} />

      {/* Live Video Feed */}
      <video ref={videoRef} autoPlay playsInline muted
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
          scanResult ? "opacity-20 blur-lg scale-105" : "opacity-70"
        }`}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Scanning Overlay ──────────────────────────────────────── */}
      {isScanning && !scanResult && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute left-0 right-0 h-0.5 bg-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.8)] animate-scan-line" />
          <div className="absolute top-16 left-8 w-12 h-12 border-t-2 border-l-2 border-teal-400/80" />
          <div className="absolute top-16 right-8 w-12 h-12 border-t-2 border-r-2 border-teal-400/80" />
          <div className="absolute bottom-32 left-8 w-12 h-12 border-b-2 border-l-2 border-teal-400/80" />
          <div className="absolute bottom-32 right-8 w-12 h-12 border-b-2 border-r-2 border-teal-400/80" />
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-64">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }} />
            </div>
            <p className="text-center text-teal-300 text-[9px] font-bold uppercase tracking-[0.3em] mt-3 animate-pulse">
              Classifying Scene...
            </p>
          </div>
        </div>
      )}

      {/* ── INDOOR AURA RESULTS ───────────────────────────────────── */}
      {isIndoor && indoorResult && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 pointer-events-auto overflow-y-auto">

          {/* Campus Badge */}
          {showCampusBadge && (
            <div className="bg-orange-500/10 border border-orange-500/30 backdrop-blur-xl px-4 py-1.5 rounded-full mb-3 animate-fade-in">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                UVA Campus {locationCtx?.confidence === 'low' ? '(estimated)' : ''}
              </span>
            </div>
          )}

          {/* Aura Feature Ring */}
          <div className="flex gap-2 mb-4 animate-fade-in">
            {Object.entries(indoorResult.features).map(([key, val]) => {
              const cfg = AURA_FEATURES[key as keyof typeof AURA_FEATURES];
              return (
                <div key={key} className="flex flex-col items-center bg-white/5 border border-white/5 rounded-xl px-2.5 py-2 backdrop-blur-md">
                  <span className="text-sm">{cfg?.icon}</span>
                  <span className="text-xs font-black text-white tabular-nums">{val}</span>
                  <span className="text-[7px] text-white/40 uppercase tracking-wider">{cfg?.label}</span>
                </div>
              );
            })}
          </div>

          {/* Score Orb */}
          <div className="animate-score-reveal mb-4">
            <div className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center border-2"
              style={{
                borderColor: grade.color,
                boxShadow: `0 0 60px ${grade.color}40, inset 0 0 30px ${grade.color}20`,
                background: `radial-gradient(circle, ${grade.color}15 0%, transparent 70%)`
              }}
            >
              <span className="text-4xl font-black text-white tabular-nums">{animatedScore}</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/50">/ {MAX_AURA_SCORE}</span>
              <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border-2 bg-black"
                style={{ borderColor: grade.color, color: grade.color }}
              >
                {grade.grade}
              </div>
            </div>
          </div>

          {/* Summary */}
          <h2 className="text-2xl font-black text-white tracking-tight mb-1 animate-fade-in">{indoorResult.summary}</h2>
          <p className="text-neutral-500 text-xs max-w-xs text-center mb-1 animate-fade-in italic">{indoorResult.explanation}</p>
          <p className="text-neutral-400 text-sm max-w-sm text-center mb-4 animate-fade-in">{indoorResult.recommendation}</p>

          {/* Smile Score Reward */}
          {pointsAwarded && (
            <div className="bg-teal-500/10 border border-teal-500/30 backdrop-blur-xl px-5 py-2 rounded-full mb-4 animate-fade-in-up">
              <span className="text-sm font-bold text-teal-300">+{smileReward} Smile Score</span>
            </div>
          )}

          {/* Toggle Breakdown */}
          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors mb-3">
            {showBreakdown ? 'Hide' : 'Show'} Factor Breakdown
          </button>

          {/* Factor Breakdown */}
          {showBreakdown && (
            <div className="w-full max-w-sm space-y-2 mb-6">
              {parsedFactors
                .sort((a, b) => (b.score / b.maxScore) - (a.score / a.maxScore))
                .map((factor, i) => {
                  const pct = Math.round((factor.score / factor.maxScore) * 100);
                  const factorGrade = getAuraGrade((pct / 100) * 1000);
                  return (
                    <div key={factor.name}
                      className="animate-factor-slide bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{factor.icon}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{factor.name}</span>
                        </div>
                        <span className="text-xs font-black tabular-nums" style={{ color: factorGrade.color }}>
                          {factor.score}/{factor.maxScore}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${factorGrade.color}, ${factorGrade.color}80)` }}
                        />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1 leading-tight">{factor.description}</p>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Actions */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button onClick={captureAndAnalyze}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all shadow-2xl">
              Scan Again
            </button>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl border border-white/10 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-all">
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {/* ── BUILDING EXTERIOR RESULTS ─────────────────────────────── */}
      {isBuilding && buildingResult && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 pointer-events-auto overflow-y-auto">

          {/* Campus Badge */}
          {showCampusBadge && (
            <div className="bg-orange-500/10 border border-orange-500/30 backdrop-blur-xl px-4 py-1.5 rounded-full mb-3 animate-fade-in">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                UVA Campus {locationCtx?.confidence === 'low' ? '(estimated)' : ''}
              </span>
            </div>
          )}

          {/* Building Name Badge */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-xl px-5 py-2 rounded-full mb-5 animate-fade-in">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">{buildingResult.buildingName}</span>
          </div>

          {/* Smiley + Mood Orbs */}
          <div className="flex gap-8 mb-5 animate-score-reveal">
            {/* Smiley Score */}
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center border-2 border-indigo-400"
                style={{ boxShadow: '0 0 40px rgba(99,102,241,0.3)', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }}
              >
                <span className="text-3xl animate-emoji-pop" style={{ animationDelay: '0.3s' }}>{buildingResult.smileyEmoji}</span>
                <span className="text-2xl font-black text-white tabular-nums">{animatedScore}</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-300 mt-2">Smiley Score</span>
            </div>

            {/* Mood Score */}
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center border-2 border-purple-400"
                style={{ boxShadow: '0 0 40px rgba(168,85,247,0.3)', background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)' }}
              >
                <span className="text-3xl animate-emoji-pop" style={{ animationDelay: '0.5s' }}>{buildingResult.moodEmoji}</span>
                <span className="text-2xl font-black text-white tabular-nums">{buildingResult.moodScore}</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-300 mt-2">Mood Score</span>
            </div>
          </div>

          {/* Vibe */}
          <p className="text-lg font-bold text-white/90 mb-1 animate-fade-in capitalize">{buildingResult.vibe}</p>

          {/* Reasoning */}
          {buildingResult.reasoning && (
            <p className="text-neutral-500 text-xs max-w-xs text-center mb-4 animate-fade-in italic">
              {buildingResult.reasoning}
            </p>
          )}

          {/* Smile Score Reward */}
          {pointsAwarded && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-xl px-5 py-2 rounded-full mb-5 animate-fade-in-up">
              <span className="text-sm font-bold text-indigo-300">+{smileReward} Smile Score</span>
            </div>
          )}

          {/* Toggle Attributes */}
          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors mb-3">
            {showBreakdown ? 'Hide' : 'Show'} Building Attributes
          </button>

          {/* Building Attributes */}
          {showBreakdown && (
            <div className="w-full max-w-sm space-y-2 mb-6">
              {Object.entries(buildingResult.attributes).map(([key, val], i) => {
                const cfg = BUILDING_ATTRIBUTES[key as keyof typeof BUILDING_ATTRIBUTES];
                const attrGrade = getAuraGrade(val * 10);
                return (
                  <div key={key}
                    className="animate-factor-slide bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cfg?.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{cfg?.label}</span>
                      </div>
                      <span className="text-xs font-black tabular-nums" style={{ color: attrGrade.color }}>
                        {val}/100
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${val}%`, background: `linear-gradient(90deg, ${attrGrade.color}, ${attrGrade.color}80)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button onClick={captureAndAnalyze}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all shadow-2xl">
              Scan Again
            </button>
            <button onClick={onClose}
              className="w-full py-3 rounded-2xl border border-white/10 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-all">
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {/* ── Pre-scan UI ───────────────────────────────────────────── */}
      {!scanResult && !isScanning && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-between p-8">
          <div className="w-full flex justify-between items-center pointer-events-auto">
            <div className="bg-black/50 backdrop-blur-md border border-teal-500/50 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 bg-teal-400 rounded-full shadow-[0_0_8px_rgba(20,184,166,1)]" />
              <span className="text-teal-300 text-[10px] font-bold tracking-widest uppercase">Aura Points Scanner</span>
            </div>
            <button onClick={onClose}
              className="bg-black/50 backdrop-blur-md border border-neutral-700 text-neutral-300 px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase pointer-events-auto">
              Cancel
            </button>
          </div>

          <div className="relative flex flex-col items-center justify-center">
            <div className="relative w-72 h-72 flex items-center justify-center">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-teal-400/60" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-teal-400/60" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-teal-400/60" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-teal-400/60" />
              <div className="w-px h-8 bg-teal-400/30" />
              <div className="absolute w-8 h-px bg-teal-400/30" />
            </div>
            <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">
              Point at a room or building
            </p>
          </div>

          <div className="pointer-events-auto w-full max-w-sm">
            <button onClick={captureAndAnalyze}
              className="w-full py-4 rounded-2xl bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all shadow-2xl">
              Scan Environment
            </button>
          </div>
        </div>
      )}

      {/* Scanning CTA */}
      {isScanning && !scanResult && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md border border-teal-500/30 px-6 py-3 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-teal-300 text-[10px] font-bold tracking-widest uppercase">Processing with GPT-4o...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
