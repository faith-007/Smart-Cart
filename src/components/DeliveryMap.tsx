import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface DeliveryMapProps {
  lat: number;
  lng: number;
  accuracy?: number; // GPS accuracy in meters
  onLocationChange: (lat: number, lng: number, accuracy: number) => void;
}

export default function DeliveryMap({
  lat,
  lng,
  accuracy,
  onLocationChange,
}: DeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  // Custom modern HTML SVG delivery pin
  const customMarkerIcon = L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute -top-10 flex flex-col items-center">
          <div class="flex items-center justify-center bg-green-500 text-white rounded-full p-2.5 shadow-xl border-2 border-white transform hover:scale-115 transition duration-150">
            <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="w-2 h-2 bg-green-500 rotate-45 -mt-1 shadow-md border-b border-r border-white"></div>
        </div>
        <div class="w-3.5 h-3.5 bg-green-500/30 rounded-full animate-ping absolute -bottom-1"></div>
        <div class="w-2 h-2 bg-green-600 rounded-full border border-white shadow-sm absolute -bottom-1"></div>
      </div>
    `,
    iconSize: [40, 42],
    iconAnchor: [20, 42],
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

      // Add OpenStreetMap tile layer (light, clean, performant)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add a draggable marker
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: customMarkerIcon,
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onLocationChange(position.lat, position.lng, accuracy || 10);
      });

      markerRef.current = marker;

      // Add accuracy circle if accuracy is known
      if (accuracy && accuracy > 0) {
        const circle = L.circle([lat, lng], {
          radius: accuracy,
          color: accuracy > 100 ? "#ef4444" : "#10b981",
          fillColor: accuracy > 100 ? "#f87171" : "#34d399",
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);
        accuracyCircleRef.current = circle;
      }

      // Allow clicking on map to place pin
      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        onLocationChange(clickLat, clickLng, accuracy || 10);
      });
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, []);

  // Update map and marker if lat/lng search propagates from parent
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const currentCenter = mapRef.current.getCenter();
      if (
        Math.abs(currentCenter.lat - lat) > 0.0001 ||
        Math.abs(currentCenter.lng - lng) > 0.0001
      ) {
        mapRef.current.setView([lat, lng], 16);
        markerRef.current.setLatLng([lat, lng]);

        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([lat, lng]);
          accuracyCircleRef.current.setRadius(accuracy || 10);
          accuracyCircleRef.current.setStyle({
            color: accuracy && accuracy > 100 ? "#ef4444" : "#10b981",
            fillColor: accuracy && accuracy > 100 ? "#f87171" : "#34d399",
          });
        }
      }
    }
  }, [lat, lng, accuracy]);

  return (
    <div className="relative group">
      {/* Map Element */}
      <div
        ref={mapContainerRef}
        className="w-full h-[225px] rounded-2xl border border-gray-200 shadow-md bg-slate-50 overflow-hidden"
      />

      {/* Floating map hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-35 bg-gray-900/85 backdrop-blur-xs text-white px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-md pointer-events-none transition duration-150">
        📍 Drag the Delivery Pin to Adjust Location
      </div>
    </div>
  );
}
