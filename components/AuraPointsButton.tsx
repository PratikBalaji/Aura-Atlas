"use client";

export default function AuraPointsButton({
  isActive,
  onToggle
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 h-12 rounded-full transition-[width,background-color,border-color] duration-500 ease-out overflow-hidden text-left group/btn shadow-lg ${
        isActive
          ? "w-48 bg-teal-500/20 border border-teal-400/40 text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]"
          : "w-12 hover:w-48 bg-transparent border border-transparent hover:bg-white/10 text-white/70 hover:text-white"
      }`}
    >
      <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-xl rounded-full transition-colors ${
        isActive ? "bg-transparent" : "bg-white/10 group-hover/btn:bg-transparent"
      }`}>
        ✨
      </div>
      <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
        isActive ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
      }`}>
        Aura Points
      </span>
    </button>
  );
}
