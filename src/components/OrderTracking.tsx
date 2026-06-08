import React, { useState, useEffect } from "react";
import { X, Check, Truck, Clock, User, Phone, Star, ShieldCheck, MapPin, Sparkles, Navigation, ShieldAlert, AlertCircle } from "lucide-react";
import { Order } from "../types";
import RiderAvatar from "./RiderAvatar";

interface OrderTrackingProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrderStatus: (orderId: string, status: Order["status"]) => void;
  onAssignPartnerToOrder?: (
    orderId: string,
    partner: { id?: string; name: string; phone: string; avatar: string; vehicleNumber?: string },
    newStatus?: Order["status"]
  ) => void;
}

const STAGES: { status: Order["status"]; label: string; desc: string }[] = [
  { status: "placed", label: "Order Placed", desc: "Received and acknowledged by our store" },
  { status: "confirmed", label: "Order Confirmed", desc: "Assigned to nearest smart fulfillment hub" },
  { status: "packed", label: "Packed", desc: "Washed twice & packed safely in temperature-insulated bags" },
  { status: "out_for_delivery", label: "Out For Delivery", desc: "Rider dispatched with express route GPS" },
  { status: "delivered", label: "Delivered", desc: "Safely handed over to you" },
];

export default function OrderTracking({
  order,
  isOpen,
  onClose,
  onUpdateOrderStatus,
  onAssignPartnerToOrder,
}: OrderTrackingProps) {
  const [etaTimer, setEtaTimer] = useState(12);

  // Auto-progress stages simulator (advances every 20 seconds)
  useEffect(() => {
    if (!isOpen || !order || order.status === "delivered") return;

    const timer = setInterval(() => {
      const currentIdx = STAGES.findIndex((s) => s.status === order?.status);
      if (currentIdx < STAGES.length - 1) {
        const nextStatus = STAGES[currentIdx + 1].status;
        
        // Prevent auto-progressing to delivery stage if no rider is assigned yet
        if ((nextStatus === "out_for_delivery" || nextStatus === "delivered") && !order.deliveryPartner) {
          return;
        }

        onUpdateOrderStatus(order.id, nextStatus);

        // Adjust mock timer
        setEtaTimer((prev) => Math.max(0, prev - 3));
      }
    }, 20000); // 20s auto skip

    return () => clearInterval(timer);
  }, [isOpen, order?.status, order?.id, order?.deliveryPartner, onUpdateOrderStatus]);

  if (!isOpen || !order) return null;

  const isCancelled = order.status === "cancelled";

  // Find active stage index
  const activeIdx = isCancelled ? 0 : STAGES.findIndex((s) => s.status === order.status);

  // Handle manual skip for fast testing
  const triggerManualNextStep = () => {
    if (!order || isCancelled) return;
    const currentIdx = STAGES.findIndex((s) => s.status === order.status);
    if (currentIdx < STAGES.length - 1) {
      const nextStatus = STAGES[currentIdx + 1].status;
      
      // Prevent manual speed-up into dispatch / delivery stages if no partner is assigned
      if ((nextStatus === "out_for_delivery" || nextStatus === "delivered") && !order.deliveryPartner) {
        alert("Rider assignment is pending! To simulate delivery, please log in to the Rider Portal (from the footer) to accept the request, or allocate a rider manually in the Admin Portal.");
        return;
      }

      onUpdateOrderStatus(order.id, nextStatus);
      setEtaTimer((prev) => Math.max(0, prev - 3));
    }
  };

  // Live progress percentage calculation
  const progressPercent = isCancelled ? 0 : ((activeIdx) / (STAGES.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      
      {/* Tracker Card */}
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        id={`tracking-modal-${order.id}`}
      >
        
        {/* Close Switch */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Branding */}
        <div className="text-left border-b border-gray-100 pb-4">
          <span className="inline-flex items-center space-x-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-700 uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>SmartCart Live Tracker</span>
          </span>
          <h2 className="text-xl font-black text-gray-950">Fulfilling Your Grocery Cart</h2>
          <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">Order Target: #{order.id} • Date: {order.date}</p>
        </div>

        {/* ETA Header dashboard */}
        {isCancelled ? (
          <div className="my-5 bg-gradient-to-r from-red-500 to-red-650 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-left shadow-lg shadow-red-100">
            <div className="flex items-center space-x-3.5">
              <div className="h-12 w-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <ShieldAlert className="h-6 w-6 text-yellow-300 animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] text-red-100 font-extrabold uppercase tracking-widest leading-none font-sans">DELIVERY DISRUPTED</p>
                <h3 className="text-xl font-black mt-1 leading-none">Order Cancelled/Rejected</h3>
                <p className="text-xs text-red-600 bg-white/95 px-1.5 py-0.5 rounded-sm inline-block font-extrabold mt-1 sm:mt-1.5 uppercase leading-none">
                  Declined by Delivery Agent
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[8px] font-black uppercase text-red-700 bg-white border border-red-200 px-2.5 py-1 rounded-full leading-none">
                UNABLE TO DELIVER
              </span>
            </div>
          </div>
        ) : (
          <div className="my-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-left shadow-lg shadow-green-150">
            <div className="flex items-center space-x-3.5">
              <div className="h-12 w-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="h-6 w-6 text-yellow-300 animate-spin" style={{ animationDuration: "12s" }} />
              </div>
              <div>
                <p className="text-[10px] text-green-100 font-extrabold uppercase tracking-widest leading-none">Estimated Arrival Time</p>
                <h3 className="text-2xl font-black mt-1 leading-none">
                  {order.status === "delivered" ? "Delivered Safely!" : `${etaTimer} - ${etaTimer + 3} Minutes`}
                </h3>
                <p className="text-xs text-green-500 bg-white/70 px-1.5 py-0.5 rounded-sm inline-block font-extrabold mt-1 sm:mt-1.5 uppercase leading-none">
                  {STAGES[activeIdx].label}
                </p>
              </div>
            </div>
            
            {/* Quick simulator trigger details */}
            <div className="flex flex-col items-center sm:items-end">
              <p className="text-[9px] text-green-100 font-bold mb-1.5 uppercase">Test Delivery Stage</p>
              <button
                onClick={triggerManualNextStep}
                disabled={order.status === "delivered"}
                className="rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black text-[10px] uppercase p-2 border-none transition active:scale-95 disabled:bg-gray-100/10 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                ⚡ Speed Up Rider
              </button>
            </div>
          </div>
        )}

        {/* Map route visualizer representation */}
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 mb-6 relative overflow-hidden h-28 flex items-center justify-between text-left">
          
          {/* Faint road background */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1.5 bg-gray-200 rounded-full" />
          
          <div 
            className="absolute left-8 h-1.5 bg-green-500 rounded-full transition-all duration-500" 
            style={{ width: `calc(${progressPercent}% - 16px)` }}
          />

          {/* Start Store Hub */}
          <div className="z-10 flex flex-col items-center">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shadow-md transition ${
              activeIdx >= 0 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-black uppercase text-gray-400 mt-1.5">Fulfillment Hub</span>
          </div>

          {/* Running Delivery Rider marker */}
          {order.status !== "delivered" && order.status !== "placed" && (
            <div 
              className="absolute z-20 top-7 transition-all duration-500 flex flex-col items-center shrink-0"
              style={{ left: `calc(${progressPercent}% * 0.78 + 36px)` }}
            >
              <div className="bg-orange-500 text-white p-1.5 rounded-full shadow-lg animate-bounce">
                <Truck className="h-4.5 w-4.5" />
              </div>
              <span className="text-[8px] bg-gray-900 text-white font-black px-1 rounded-sm mt-1 uppercase whitespace-nowrap">Express Rider</span>
            </div>
          )}

          {/* End Customer Hub */}
          <div className="z-10 flex flex-col items-center">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shadow-md transition ${
              order.status === "delivered" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              <MapPin className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-black uppercase text-gray-400 mt-1.5">My Home door</span>
          </div>

        </div>

        {/* Timeline Stages nodes */}
        <div className="space-y-4 mb-6 text-left pl-2">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIdx;
            const isActive = idx === activeIdx;
            
            return (
              <div key={stage.status} className="flex gap-4 relative">
                
                {/* Visual Line connector helper */}
                {idx < STAGES.length - 1 && (
                  <div className={`absolute left-3.5 top-7 w-[2px] h-8 ${
                    idx < activeIdx ? "bg-green-500" : "bg-gray-200"
                  }`} />
                )}

                {/* Node circle */}
                <div className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isCompleted 
                    ? "bg-green-500 border-green-500 text-white" 
                    : isActive 
                      ? "border-green-500 text-green-600 animate-pulse bg-white" 
                      : "border-gray-250 text-gray-400 bg-white"
                }`}>
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 font-bold" />
                  ) : (
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  )}
                </div>

                {/* Content description text */}
                <div>
                  <h4 className={`text-xs font-black ${
                    isActive ? "text-green-700" : idx < activeIdx ? "text-gray-800" : "text-gray-400"
                  }`}>
                    {stage.label}
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-normal font-medium">{stage.desc}</p>
                </div>

              </div>
            );
          })}
        </div>

        {/* Delivery Partner Details list */}
        {order.deliveryPartner ? (
          <div className="bg-gray-50/50 border border-gray-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center space-x-3.5">
              <RiderAvatar name={order.deliveryPartner.name} className="h-12 w-12 text-sm" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-none">Your Delivery Valet</p>
                <h4 className="text-sm font-black text-gray-800 mt-1 leading-none">{order.deliveryPartner.name}</h4>
                <div className="flex items-center space-x-1.5 mt-1.5">
                  <div className="flex items-center bg-yellow-400 px-1 py-0.5 rounded text-[9px] font-bold text-gray-900 leading-none">
                    <Star className="h-2.5 w-2.5 fill-gray-900 mr-0.5" />
                    <span>{order.deliveryPartner.rating}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold">• Gold Partner</span>
                </div>
              </div>
            </div>

            {/* Direct phone simulate trigger */}
            <a
              href={`tel:${order.deliveryPartner.phone}`}
              onClick={(e) => {
                e.preventDefault();
                alert(`Calling delivery agent ${order.deliveryPartner?.name} at simulated phone line ${order.deliveryPartner?.phone}`);
              }}
              className="flex items-center space-x-2 shrink-0 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 text-white font-bold text-xs shadow-xs transition"
            >
              <Phone className="h-4 w-4" />
              <span>Call Rider Partner</span>
            </a>
          </div>
        ) : (
          <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center space-x-3.5">
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Truck className="h-6 w-6 text-orange-600 animate-pulse" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide leading-none">RIDER ASSIGNMENT PENDING</p>
                <h4 className="text-xs font-black text-gray-850 mt-1 leading-none">Searching for nearby dispatch couriers...</h4>
                <p className="text-[9px] text-gray-500 font-semibold mt-1">Order will be delivered as soon as a partner claims it in their console.</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[8px] font-black uppercase text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse leading-none">
                PENDING ACCEPTANCE
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
