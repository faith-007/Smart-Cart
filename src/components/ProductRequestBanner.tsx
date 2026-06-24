import React from "react";
import { HelpCircle, ArrowRight, Sparkles } from "lucide-react";

export default function ProductRequestBanner() {
  const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSeWkg09ksB5WP-LRTKIJSunS7T2ji-97TOKCCLG214Qw1t3CA/viewform?usp=publish-editor";

  return (
    <div id="product-request-banner" className="bg-gradient-to-r from-orange-50/70 to-amber-50/70 border border-orange-100/80 rounded-3xl p-5 sm:p-6 my-4 flex flex-col sm:flex-row items-center justify-between gap-6 animate-fade-in shadow-xs max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 max-w-2xl">
        <div className="h-12 w-12 bg-orange-100/80 rounded-2xl flex items-center justify-center shrink-0 border border-orange-200/50 shadow-xs">
          <HelpCircle className="h-6 w-6 text-orange-600 animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm sm:text-base font-black text-gray-900 flex items-center justify-center sm:justify-start gap-1.5 uppercase tracking-wide">
            <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span>Can't find what you are looking for?</span>
          </h4>
          <p className="text-xs text-gray-500 font-semibold mt-1 leading-relaxed">
            Looking for a specific brand, grocery, snack, or organic delight not in our lists? Request any item you want, and we'll source and add it to our inventory instantly!
          </p>
        </div>
      </div>

      <a
        href={formUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center px-6 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-md shadow-orange-100/60 cursor-pointer h-11 flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto"
      >
        <span>Ask for Product</span>
        <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
      </a>
    </div>
  );
}
