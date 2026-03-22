"use client";

// We need to pass the setIsARModeActive down from the parent!
export default function AuraLens({ isActive, setIsActive }: { isActive: boolean, setIsActive: (val: boolean) => void }) {
  return (
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
        👁️
      </div>
      <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-opacity duration-300 ${
        isActive ? "opacity-100" : "opacity-0 group-hover/btn:opacity-100 delay-100"
      }`}>
        Aura Lens
      </span>
    </button>
  );
}
