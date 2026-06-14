import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Gift, Sparkles, ChevronLeft, ChevronRight, Zap } from "lucide-react";

interface Banner {
  id: string;
  tagline: string;
  title: string;
  subtitle: string;
  highlightText: string;
  colorClass: string;
  imgUrl: string;
}

const BANNERS: Banner[] = [
  {
    id: "b1",
    tagline: "⚡ 15-MINUTE FAST DELIVERY GUARANTEE",
    title: "Fresh Groceries Delivered in a Flash",
    subtitle: "From farm-fresh organic vegetables to dairy essentials, get everything delivered to your doorstep in 15 minutes flat.",
    highlightText: "Quality products at affordable prices",
    colorClass: "from-green-600 to-emerald-800",
    imgUrl: "https://res.cloudinary.com/dkduejkuj/image/upload/v1781242107/grocery_ali1ph.jpg",
  },
  {
    id: "b2",
    tagline: "🍎 HEALTHY SUMMER HARVEST SPECIAL",
    title: "Organic Fruits & Vegetables up to 40% Off",
    subtitle: "Sourced directly from local sustainable farms. Sweet mangoes, crisp gala apples, and pure green spinach ready to deliver.",
    highlightText: "Farm-to-table freshness guaranteed",
    colorClass: "from-orange-500 to-red-600",
    imgUrl: "https://res.cloudinary.com/dkduejkuj/image/upload/v1781242025/fruits_lvf6ip.jpg",
  },
  {
    id: "b3",
    tagline: "🍿 WEEKEND MATCH DAY BINGE PARTY",
    title: "Snacks, Munchies & Cold Fizzy Drinks",
    subtitle: "Score amazing combo deals on premium potato crisps, double-choc cookies, and chilled cold sodas for your late night streams.",
    highlightText: "Save ₹20 flat on snacks",
    colorClass: "from-slate-800 to-indigo-900 border border-slate-750",
    imgUrl: "https://res.cloudinary.com/dkduejkuj/image/upload/v1781242104/drinks_aokc9l.webp",
  }
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % BANNERS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % BANNERS.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + BANNERS.length) % BANNERS.length);
  };

  const activeBanner = BANNERS[currentSlide];

  return (
    <div className="relative overflow-hidden bg-gray-50 py-6" id="hero-carousel-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative h-[280px] sm:h-[340px] md:h-[380px] w-full overflow-hidden rounded-3xl shadow-xl shadow-gray-100 bg-white">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeBanner.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className={`absolute inset-0 bg-gradient-to-r ${activeBanner.colorClass} flex flex-col md:flex-row items-center justify-between p-6 sm:p-10 md:p-12 text-white`}
            >
              
              {/* Content Box */}
              <div className="flex-1 max-w-xl z-10 flex flex-col justify-center h-full">
                <span className="inline-flex self-start items-center space-x-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] sm:text-xs font-black tracking-widest text-[#FACC15] uppercase">
                  <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-[#FACC15]" />
                  <span>{activeBanner.tagline}</span>
                </span>

                <h1 className="mt-4 text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  {activeBanner.title}
                </h1>

                <p className="mt-2.5 text-xs sm:text-sm md:text-base text-gray-100 font-medium line-clamp-2 sm:line-clamp-none">
                  {activeBanner.subtitle}
                </p>

                {/* Offer Highlights */}
                <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="rounded-xl bg-black/15 border border-white/5 p-2 px-3.5 flex items-center space-x-2">
                    <Gift className="h-4 sm:h-5 sm:w-5 text-[#FACC15]" />
                    <div className="text-left">
                      <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">EXCLUSIVE OFFER</p>
                      <p className="text-xs sm:text-sm font-black text-white">{activeBanner.highlightText}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Graphic / Image Box */}
              <div className="hidden md:block flex-1 max-w-sm lg:max-w-md h-full ml-6 relative">
                <img
                  src={activeBanner.imgUrl}
                  alt={activeBanner.title}
                  className="w-full h-full object-cover rounded-2xl shadow-lg mix-blend-initial brightness-95 opacity-90"
                />
                
                {/* 15 min tag overlay */}
                <div className="absolute -bottom-2 -left-4 rounded-2xl bg-orange-500 p-3 text-center shadow-lg transform rotate-2 animate-bounce duration-[2000ms]">
                  <p className="text-[10px] font-black text-orange-100 uppercase">⚡ FAST ARRIVAL</p>
                  <p className="text-lg font-black text-white leading-none">15 MINS</p>
                </div>
              </div>

            </motion.div>
          </AnimatePresence>

          {/* Banner Controls */}
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-xs transition z-20"
            id="hero-banner-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-xs transition z-20"
            id="hero-banner-next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-20">
            {BANNERS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 transition-all rounded-full ${
                  currentSlide === idx ? "w-6 bg-white" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
