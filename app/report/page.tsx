"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { supabase } from "@/lib/supabase";

const dummyData = [
  { day: 'Mon', score: 400 },
  { day: 'Tue', score: 450 },
  { day: 'Wed', score: 300 },
  { day: 'Thu', score: 550 },
  { day: 'Fri', score: 520 },
  { day: 'Sat', score: 600 },
  { day: 'Sun', score: 680 },
];

export default function AuraReport() {
  const [smileScore, setSmileScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [miles, setMiles] = useState(0);
  const [lastAuraPoints, setLastAuraPoints] = useState(0);
  const [auraScansCount, setAuraScansCount] = useState(0);

  useEffect(() => {
    // Load snapshot from localStorage
    setSmileScore(parseInt(localStorage.getItem('aura_smileScore') || '0'));
    setStreak(parseInt(localStorage.getItem('aura_streak') || '0'));
    setMiles(parseInt(localStorage.getItem('aura_capOneMiles') || '0'));

    // Load Aura Points history
    const history = JSON.parse(localStorage.getItem('aura_pointsHistory') || '[]');
    if (history.length > 0) {
      setLastAuraPoints(history[history.length - 1].score);
      setAuraScansCount(history.length);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-violet-500/30">
      
      {/* 🔙 Navigation */}
      <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors mb-12 group">
        <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-bold uppercase tracking-widest">Back to Map</span>
      </Link>

      <header className="max-w-5xl mx-auto mb-16">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 bg-gradient-to-r from-white via-white to-white/20 bg-clip-text text-transparent">
          Aura Report
        </h1>
        <p className="text-neutral-500 text-lg md:text-xl max-w-2xl leading-relaxed">
          Your personal resilience dashboard. Tracking your emotional growth and financial rewards in real-time.
        </p>
      </header>

      <main className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3 mb-12">
        
        {/* Statistics Cards */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 blur-3xl -mr-16 -mt-16 group-hover:bg-violet-600/20 transition-all" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 mb-2 block">Current Score</span>
          <div className="text-5xl font-black tabular-nums">{smileScore.toLocaleString()}</div>
          <div className="mt-4 text-xs text-neutral-500 font-medium">✨ Smile Score</div>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-3xl -mr-16 -mt-16 group-hover:bg-orange-600/20 transition-all" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 mb-2 block">Check-in Streak</span>
          <div className="text-5xl font-black tabular-nums">{streak}</div>
          <div className="mt-4 text-xs text-neutral-500 font-medium font-bold">🔥 Day{streak !== 1 ? 's' : ''} Record</div>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/20 transition-all" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block">CapOne Miles</span>
          <div className="text-5xl font-black tabular-nums">{miles.toLocaleString()}</div>
          <div className="mt-4 text-xs text-neutral-500 font-medium">💳 Financial Resilience</div>
        </div>

        {/* Aura Points (Environment Scanner) */}
        {auraScansCount > 0 && (
          <div className="md:col-span-3 bg-white/5 border border-white/10 p-8 rounded-[2rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-600/10 blur-3xl -mr-16 -mt-16 group-hover:bg-teal-600/20 transition-all" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-2 block">Last Environment Scan</span>
                <div className="text-5xl font-black tabular-nums">{lastAuraPoints.toLocaleString()}<span className="text-lg text-neutral-500 ml-1">/ 1,000</span></div>
                <div className="mt-4 text-xs text-neutral-500 font-medium">✨ Aura Points</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black tabular-nums text-teal-400">{auraScansCount}</div>
                <div className="text-xs text-neutral-500 font-medium mt-1">Total Scans</div>
              </div>
            </div>
          </div>
        )}

        {/* The Big Chart */}
        <div className="md:col-span-3 bg-neutral-900/50 border border-white/5 p-8 rounded-[2.5rem] shadow-inner">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-xl font-bold mb-1">Resilience Pulse</h3>
              <p className="text-sm text-neutral-500">Weekly emotional trend across all check-ins</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
                <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
                <span className="text-[10px] font-bold text-violet-300 uppercase">Aura Score</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dummyData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#4b5563', fontSize: 12, fontWeight: 600}} 
                  dy={10}
                />
                <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#0a0a0a', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8b5cf6" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto py-12 border-t border-white/5 flex justify-between items-center opacity-40">
        <p className="text-xs font-medium tracking-widest uppercase">Aura Atlas Research Project v0.1</p>
        <div className="flex gap-6">
            <span className="text-xs font-bold underline">Terms</span>
            <span className="text-xs font-bold underline">Privacy</span>
        </div>
      </footer>
    </div>
  );
}
