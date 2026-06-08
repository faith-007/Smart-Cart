import React from "react";
import { Bike } from "lucide-react";

interface RiderAvatarProps {
  name: string;
  className?: string;
}

export default function RiderAvatar({ name, className = "h-10 w-10 text-xs" }: RiderAvatarProps) {
  const getInitials = (n: string) => {
    if (!n) return "R";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Generate a consistent vibrant color scheme based on the name hash
  const getColorScheme = (n: string) => {
    const colors = [
      { bg: "bg-orange-100 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-900/50", text: "text-orange-600 dark:text-orange-400" },
      { bg: "bg-emerald-100 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-900/50", text: "text-emerald-600 dark:text-emerald-400" },
      { bg: "bg-indigo-100 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-900/50", text: "text-indigo-600 dark:text-indigo-400" },
      { bg: "bg-cyan-100 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-900/50", text: "text-cyan-600 dark:text-cyan-400" },
      { bg: "bg-rose-100 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-900/50", text: "text-rose-600 dark:text-rose-400" },
      { bg: "bg-amber-100 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900/50", text: "text-amber-600 dark:text-amber-400" }
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const initials = getInitials(name);
  const scheme = getColorScheme(name);

  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 font-bold rounded-xl border select-none ${scheme.bg} ${scheme.border} ${scheme.text} ${className}`}
      id={`rider-avatar-${name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <span className="font-sans leading-none uppercase tracking-wider">{initials}</span>
      <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 p-0.5 rounded-full border border-gray-100 dark:border-slate-800 text-orange-500 shadow-xs">
        <Bike className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}
