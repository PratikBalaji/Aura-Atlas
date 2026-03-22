"use client";
import { useEffect, useRef, useState } from "react";
import { FACTOR_WEIGHTS, getAuraGrade, getSmileScoreReward, MAX_AURA_SCORE } from "@/lib/auraPoints";
import type { EnvironmentFactor } from "@/lib/auraPoints";

interface FactorResult {
  score: number;
  description: string;
}

interface AnalysisResult {
  factors: Record<string, FactorResult>;
  summary: string;
  recommendation: string;
}

export default function AuraPointsScanner({
  onClose,
  onPointsAwarded
}: {
  onClose: () => void;
  onPointsAwarded?: (points: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [parsedFactors, setParsedFactors] = useState<EnvironmentFactor[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  // Start camera
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

  // Animated score counter
  useEffect(() => {
    if (!result) return;
    const total = Object.values(result.factors).reduce((sum, f) => sum + f.score, 0);
    let current = 0;
    const step = Math.max(1, Math.floor(total / 60));
    const interval = setInterval(() => {
      current = Math.min(current + step, total);
      setTotalScore(current);
      if (current >= total) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [result]);

  // Parse factors from API result
  useEffect(() => {
    if (!result) return;
    const factors: EnvironmentFactor[] = Object.entries(result.factors).map(([key, val]) => {
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
  }, [result]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setResult(null);
    setTotalScore(0);
    setShowBreakdown(false);
    setPointsAwarded(false);
    setScanProgress(0);

    // Animate scan progress bar
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
      const res = await fetch("/api/aura-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image }),
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setScanProgress(100);
      setResult(data);

      // Award Smile Score
      const total = Object.values(data.factors as Record<string, FactorResult>).reduce((sum, f) => sum + f.score, 0);
      const reward = getSmileScoreReward(total);
      const currentScore = parseInt(localStorage.getItem('aura_smileScore') || '0');
      const newScore = currentScore + reward;
      localStorage.setItem('aura_smileScore', newScore.toString());

      // Save scan to history
      const history = JSON.parse(localStorage.getItem('aura_pointsHistory') || '[]');
      history.push({ score: total, timestamp: Date.now(), summary: data.summary });
      if (history.length > 50) history.shift(); // Keep last 50
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

  const actualTotal = result ? Object.values(result.factors).reduce((sum, f) => sum + f.score, 0) : 0;
  const grade = getAuraGrade(actualTotal);
  const reward = getSmileScoreReward(actualTotal);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden font-sans animate-fade-in">

      {/* Scan line animation CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scanLine {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-scan-line { animation: scanLine 3s ease-in-out infinite; }
        @keyframes scoreReveal {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-score-reveal { animation: scoreReveal 0.8s ease-out forwards; }
        @keyframes factorSlide {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-factor-slide { animation: factorSlide 0.4s ease-out forwards; }
      `}} />

      {/* Live Video Feed */}
      <video
        ref={videoRef} autoPlay playsInline muted
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
          result ? "opacity-20 blur-lg scale-105" : "opacity-70"
        }`}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning Overlay */}
      {isScanning && !result && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Scan line */}
          <div className="absolute left-0 right-0 h-0.5 bg-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.8)] animate-scan-line" />

          {/* Corner brackets */}
          <div className="absolute top-16 left-8 w-12 h-12 border-t-2 border-l-2 border-teal-400/80" />
          <div className="absolute top-16 right-8 w-12 h-12 border-t-2 border-r-2 border-teal-400/80" />
          <div className="absolute bottom-32 left-8 w-12 h-12 border-b-2 border-l-2 border-teal-400/80" />
          <div className="absolute bottom-32 right-8 w-12 h-12 border-b-2 border-r-2 border-teal-400/80" />

          {/* Progress bar */}
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-64">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-center text-teal-300 text-[9px] font-bold uppercase tracking-[0.3em] mt-3 animate-pulse">
              Analyzing Environment...
            </p>
          </div>
        </div>
      )}

      {/* Results Overlay */}
      {result && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 pointer-events-auto overflow-y-auto">

          {/* Score Orb */}
          <div className="animate-score-reveal mb-6">
            <div
              className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center border-2"
              style={{
                borderColor: grade.color,
                boxShadow: `0 0 60px ${grade.color}40, inset 0 0 30px ${grade.color}20`,
                background: `radial-gradient(circle, ${grade.color}15 0%, transparent 70%)`
              }}
            >
              <span className="text-5xl font-black text-white tabular-nums">{totalScore}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/50">/ {MAX_AURA_SCORE}</span>
              <div
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-2 bg-black"
                style={{ borderColor: grade.color, color: grade.color }}
              >
                {grade.grade}
              </div>
            </div>
          </div>

          {/* Summary */}
          <h2 className="text-2xl font-black text-white tracking-tight mb-1 animate-fade-in">{result.summary}</h2>
          <p className="text-neutral-400 text-sm max-w-sm text-center mb-4 animate-fade-in">{result.recommendation}</p>

          {/* Smile Score Reward Toast */}
          {pointsAwarded && (
            <div className="bg-teal-500/10 border border-teal-500/30 backdrop-blur-xl px-5 py-2 rounded-full mb-6 animate-fade-in-up">
              <span className="text-sm font-bold text-teal-300">+{reward} Smile Score</span>
            </div>
          )}

          {/* Toggle Breakdown */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors mb-4"
          >
            {showBreakdown ? 'Hide' : 'Show'} Breakdown
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
                    <div
                      key={factor.name}
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
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${factorGrade.color}, ${factorGrade.color}80)`
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1 leading-tight">{factor.description}</p>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button
              onClick={captureAndAnalyze}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all shadow-2xl"
            >
              Scan Again
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl border border-white/10 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-all"
            >
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {/* Main UI (pre-scan) */}
      {!result && !isScanning && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-between p-8">

          {/* Header */}
          <div className="w-full flex justify-between items-center pointer-events-auto">
            <div className="bg-black/50 backdrop-blur-md border border-teal-500/50 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 bg-teal-400 rounded-full shadow-[0_0_8px_rgba(20,184,166,1)]" />
              <span className="text-teal-300 text-[10px] font-bold tracking-widest uppercase">Aura Points Scanner</span>
            </div>
            <button
              onClick={onClose}
              className="bg-black/50 backdrop-blur-md border border-neutral-700 text-neutral-300 px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase pointer-events-auto"
            >
              Cancel
            </button>
          </div>

          {/* Center Reticle */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="relative w-72 h-72 flex items-center justify-center">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-teal-400/60" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-teal-400/60" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-teal-400/60" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-teal-400/60" />
              {/* Crosshair */}
              <div className="w-px h-8 bg-teal-400/30" />
              <div className="absolute w-8 h-px bg-teal-400/30" />
            </div>
            <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">
              Point at your surroundings
            </p>
          </div>

          {/* Capture Button */}
          <div className="pointer-events-auto w-full max-w-sm">
            <button
              onClick={captureAndAnalyze}
              className="w-full py-4 rounded-2xl bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all shadow-2xl"
            >
              Scan Environment
            </button>
          </div>
        </div>
      )}

      {/* Scanning state CTA */}
      {isScanning && !result && (
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
