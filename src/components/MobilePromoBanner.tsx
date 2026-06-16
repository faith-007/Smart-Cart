import React from "react";
import { Sparkles, ArrowRight, Zap } from "lucide-react";

export default function MobilePromoBanner() {
  return (
    <div className="mx-4 my-3 block md:hidden">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-green-600 p-4 text-white shadow-lg">
        
        {/* Abstract Background Accents */}
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-lg" />

        {/* Content Wrapper */}
        <div className="flex items-center justify-between relative z-10">
          
          <div className="flex-1 pr-2">
            <span className="inline-flex items-center space-x-1 rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-black tracking-wider text-[#FACC15] uppercase">
              <Zap className="h-2 w-2 fill-[#FACC15]" />
              <span>SUPER SAVER OFFER</span>
            </span>

            <h3 className="mt-1.5 text-sm font-black leading-tight tracking-tight">
              Fresh Farms Harvest <br />
              <span className="text-[#FACC15]">Up to 45% OFF</span>
            </h3>

            <p className="mt-1 text-[10px] text-emerald-50/90 font-semibold">
              Sweet mangoes, crisp organic greens & safe farm-fresh milk.
            </p>

            <button className="mt-2.5 flex items-center space-x-1 rounded-lg bg-[#FACC15] px-2.5 py-1 text-[9px] font-black text-gray-950 shadow-xs hover:bg-yellow-300 transition active:scale-95">
              <span>ORDER NOW</span>
              <ArrowRight className="h-2.5 w-2.5 stroke-[2.5px]" />
            </button>
          </div>

          {/* Graphics Box */}
          <div className="relative w-24 h-20 shrink-0">
            <img
              src="https://res.cloudinary.com/dkduejkuj/image/upload/v1781242107/grocery_ali1ph.jpg"
              alt="Fresh vegetables"
              className="w-full h-full object-cover rounded-xl border border-white/20 shadow-md brightness-95"
              referrerPolicy="no-referrer"
            />
            {/* Arrival Badge */}
            <div className="absolute -bottom-1 -left-1 rounded bg-orange-500 px-1 py-0.5 text-[7px] font-black text-white shadow-xs tracking-tight">
              ⚡ 15 MINS
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
