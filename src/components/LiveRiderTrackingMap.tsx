import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Rider, Order } from "../types";
import { getOrderGridCoordinates } from "./RiderDashboard";

interface LiveRiderTrackingMapProps {
  riders: Rider[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string) => void;
  orders: Order[];
}

export function projectPercentToDelhi(latPercent: number, lngPercent: number): [number, number] {
  // Center around Delhi area
  const minLat = 28.5000;
  const maxLat = 28.7000;
  const minLng = 77.0500;
  const maxLng = 77.2500;
  
  const lat = minLat + (latPercent / 100) * (maxLat - minLat);
  const lng = minLng + (lngPercent / 100) * (maxLng - minLng);
  return [lat, lng];
}

export default function LiveRiderTrackingMap({
  riders,
  selectedRiderId,
  onSelectRider,
  orders,
}: LiveRiderTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);

  // Initialize leafel map in container
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use Delhi center as starting point
    const delhiCenter = projectPercentToDelhi(50, 50);

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: delhiCenter,
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      });

      // Standard slick gray/white modern map tiles from CartoDB or OpenStreetMap
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when riders change in real-time
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Filter to on-duty riders only
    const activeRiders = riders.filter((r) => r.isActiveOnDuty);
    const activeRiderIds = new Set(activeRiders.map((r) => r.id));

    // Remove stale markers for riders who went off-duty or deleted
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeRiderIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers for active riders
    activeRiders.forEach((rider) => {
      const position = projectPercentToDelhi(rider.lat, rider.lng);
      
      const isSelected = rider.id === selectedRiderId;

      // Create a gorgeous SVG live indicator marker
      const customRiderIcon = L.divIcon({
        className: "custom-rider-tracking-icon",
        html: `
          <div class="relative flex flex-col items-center">
            <!-- Label bubble with rider name -->
            <div class="absolute -top-10 bg-gray-900 border border-gray-700 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-50 transform scale-95 transition-transform">
              ${rider.name.split(" ")[0]} 
              <span class="text-orange-400 font-mono text-[8px] ml-1">#${rider.vehicleNumber.slice(-4)}</span>
            </div>
            
            <!-- Map marker pin -->
            <div class="flex items-center justify-center h-10 w-10 select-none cursor-pointer">
              <!-- Concentric live waves -->
              <div class="absolute inset-0 bg-orange-500/30 rounded-full animate-ping scale-75 opacity-75"></div>
              
              <!-- Core Icon Frame -->
              <div class="relative flex items-center justify-center p-2 rounded-full border-2 ${
                isSelected 
                  ? "bg-orange-500 border-white text-white scale-110 ring-4 ring-orange-500/30 font-black" 
                  : "bg-white border-orange-500 text-orange-600 scale-100 hover:scale-105"
              } shadow-xl transition-all duration-200">
                <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
            
            <!-- Drop shadow dot -->
            <div class="w-1.5 h-1.5 bg-gray-900/40 rounded-full blur-[1px] -mt-1.5"></div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 38],
      });

      if (markersRef.current[rider.id]) {
        // Update existing marker position
        markersRef.current[rider.id].setLatLng(position);
        markersRef.current[rider.id].setIcon(customRiderIcon);
      } else {
        // Create new marker
        const marker = L.marker(position, { icon: customRiderIcon })
          .addTo(map)
          .on("click", () => {
            onSelectRider(rider.id);
          });
        markersRef.current[rider.id] = marker;
      }
    });
  }, [riders, selectedRiderId, onSelectRider]);

  // Adjust view and render routing polyline if selected rider has assigned orders
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous line
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Clear previous customer marker
    if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }

    if (!selectedRiderId) return;

    const rider = riders.find((r) => r.id === selectedRiderId);
    if (!rider || !rider.isActiveOnDuty) return;

    const riderPos = projectPercentToDelhi(rider.lat, rider.lng);

    // Find active order assigned to this rider
    const assignedOrder = orders.find(
      (o) =>
        o.deliveryPartner?.name === rider.name &&
        o.status !== "delivered" &&
        o.status !== "cancelled"
    );

    if (assignedOrder) {
      const orderCoords = getOrderGridCoordinates(
        assignedOrder.address.addressLine,
        assignedOrder.id
      );
      const customerPos = projectPercentToDelhi(orderCoords.lat, orderCoords.lng);

      // Create beautiful customer house marker
      const customerIcon = L.divIcon({
        className: "custom-customer-icon",
        html: `
          <div class="relative flex flex-col items-center">
            <div class="absolute -top-8 bg-green-900 border border-green-700 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-md pointer-events-none whitespace-nowrap">
              Customer: ${assignedOrder.address.name || "Home"}
            </div>
            <div class="flex items-center justify-center p-1.5 rounded-full bg-green-500 text-white border-2 border-white shadow-xl scale-95">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div class="w-1 h-1 bg-gray-900/30 rounded-full blur-[0.5px]"></div>
          </div>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 26],
      });

      const customerMarker = L.marker(customerPos, { icon: customerIcon }).addTo(map);
      customerMarkerRef.current = customerMarker;

      // Draw dashed line representing delivery transit route
      const polyline = L.polyline([riderPos, customerPos], {
        color: "#f97316",
        weight: 3,
        opacity: 0.8,
        dashArray: "6, 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      polylineRef.current = polyline;

      // Zoom map to fit both endpoints elegantly
      const bounds = L.latLngBounds([riderPos, customerPos]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // No active order, just pan to rider location gently
      map.setView(riderPos, 14, { animate: true });
    }
  }, [selectedRiderId, riders, orders]);

  return (
    <div className="relative w-full h-[400px] lg:h-[480px] rounded-3xl bg-gray-900 border border-gray-800 overflow-hidden shadow-inner flex items-center justify-center">
      {/* Grid Lines Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#2d3748_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-40 z-20 pointer-events-none" />
      
      {/* Real Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Mini Legend overlay */}
      <div className="absolute bottom-4 left-4 z-30 bg-white/90 backdrop-blur-xs px-3 py-2 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <div className="h-2.5 w-2.5 bg-orange-500 rounded-full shadow-xs animate-pulse"></div>
          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">On Duty Rider</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="h-2.5 w-2.5 bg-green-500 rounded-full shadow-xs"></div>
          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Customer Destination</span>
        </div>
      </div>
    </div>
  );
}
