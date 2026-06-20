import React from "react";
import { Dog } from "lucide-react";

export default function PetProductRequest() {
  return (
    <div className="bg-green-50 border border-green-200/80 rounded-3xl p-5 sm:p-6 my-5 flex flex-col md:flex-row items-center justify-between gap-5 animate-fade-in shadow-sm shadow-green-100 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
        <div className="h-14 w-14 bg-green-100 rounded-2xl flex items-center justify-center shrink-0 border border-green-200 shadow-sm">
          <Dog className="h-7 w-7 text-green-700 animate-pulse" />
        </div>
        <div>
          <h4 className="text-base sm:text-lg font-extrabold text-green-955 flex items-center justify-center sm:justify-start gap-1">
            <span>🐾</span> Can't Find Your Pet Product?
          </h4>
          <p className="text-xs text-green-800 font-semibold mt-1 max-w-xl leading-relaxed">
            Looking for a pet product that is not available on SmartCart? Send us your request and we'll try to add it to our inventory.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto shrink-0">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLScYN_LCW5NxP0iGHdtRyEZm0YxQ87Q5tQI2Kh2YP2Td8xt0cQ/viewform?usp=publish-editor"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto text-center px-6 py-3 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-green-200 cursor-pointer min-w-[185px] h-11 flex items-center justify-center"
        >
          Request a Product
        </a>
        <p className="text-[10px] text-green-700 font-bold text-center md:text-right leading-none">
          Your requested product may be added to SmartCart in future updates.
        </p>
      </div>
    </div>
  );
}
