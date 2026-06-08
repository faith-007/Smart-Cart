import React, { useState, useEffect } from "react";
import { 
  Bike, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Check, 
  ShoppingBag, 
  Bell, 
  Navigation, 
  Compass, 
  Loader2, 
  Power, 
  LogOut, 
  TrendingUp, 
  Star, 
  ShieldAlert, 
  Truck, 
  DollarSign, 
  FileText,
  AlertCircle
} from "lucide-react";
import { Rider, Order } from "../types";
import { fetchOrdersFromFirebase, syncRiderToFirebase } from "../lib/firebase";
import { motion } from "motion/react";
import RiderAvatar from "./RiderAvatar";

interface RiderDashboardProps {
  riders: Rider[];
  setRiders: React.Dispatch<React.SetStateAction<Rider[]>>;
  orders: Order[];
  onUpdateOrderStatus: (id: string, status: Order["status"]) => void;
  onAssignPartnerToOrder: (
    id: string,
    partner: { id?: string; name: string; phone: string; avatar: string; vehicleNumber?: string },
    newStatus?: Order["status"]
  ) => void;
  onPassOrder: (orderId: string, riderId: string) => void;
  riderSession: Rider | null;
  setRiderSession: React.Dispatch<React.SetStateAction<Rider | null>>;
}

export default function RiderDashboard({
  riders,
  setRiders,
  orders,
  onUpdateOrderStatus,
  onAssignPartnerToOrder,
  onPassOrder,
  riderSession,
  setRiderSession,
}: RiderDashboardProps) {
  // Login Form States
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [requestingGPS, setRequestingGPS] = useState(false);
  const [gpsApproved, setGpsApproved] = useState(false);

  // Performance simulation states
  const [simulatedPathPercent, setSimulatedPathPercent] = useState<number>(0);
  const [isAutoDriving, setIsAutoDriving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isAcceptingOrder, setIsAcceptingOrder] = useState<string | null>(null);

  // Geolocation tracking state
  const [watchId, setWatchId] = useState<number | null>(null);

  // Automatically sync riderSession changes to Firebase
  useEffect(() => {
    if (riderSession) {
      syncRiderToFirebase(riderSession).catch((err) =>
        console.error("[RiderDashboard] Failed to sync rider session to Firebase:", err)
      );
    }
  }, [riderSession]);

  // Auto-notification for incoming orders
  useEffect(() => {
    if (!riderSession) return;

    // Filter orders that are "placed" or "confirmed" and not assigned or assigned to this rider, and not rejected
    const pendingOrders = orders.filter((o) => {
      const isUnassigned = (o.status === "placed" || o.status === "confirmed" || o.status === "packed") && !o.deliveryPartner;
      const isMyOrder = o.deliveryPartner && (o.deliveryPartner.id === riderSession.id || o.rider_id === riderSession.id || o.deliveryPartner.name === riderSession.name) && o.status !== "delivered" && o.status !== "cancelled";
      const isRejected = o.rejectedByRiders?.includes(riderSession.id);
      return (isUnassigned || isMyOrder) && !isRejected;
    });

    if (pendingOrders.length > 0) {
      const latestOrder = pendingOrders[0];
      if ((latestOrder.status === "placed" || latestOrder.status === "confirmed" || latestOrder.status === "packed") && !latestOrder.deliveryPartner) {
        setNotification(`🚨 Alert: New Delivery Request (Order #${latestOrder.id}) is available near your zone!`);
        // Clear alert after 7 seconds
        const t = setTimeout(() => setNotification(null), 7000);
        return () => clearTimeout(t);
      }
    }
  }, [orders, riderSession]);

  // Request GPS permission during login
  const handleRequestGPS = () => {
    setRequestingGPS(true);
    setLoginError("");

    if (!navigator.geolocation) {
      setLoginError("Geolocation is not supported by your browser.");
      setRequestingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsApproved(true);
        setRequestingGPS(false);
      },
      (err) => {
        console.warn("[Rider GPX] Permission rejected or timed out:", err);
        setLoginError("GPS Permission required to clock-in on duty. Please allow location access.");
        setRequestingGPS(false);
      },
      { timeout: 7000 }
    );
  };

  // Perform login matching against the shared DB
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const term = loginPhone.trim();
    const pin = loginPassword.trim();

    if (!term || !pin) {
      setLoginError("Please enter your Rider ID or Phone and PIN.");
      return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setLoginError("Your Login Access PIN must be exactly 6 numeric digits.");
      return;
    }

    // Match by ID (exact or case-insensitive) OR ends with the same 10 digits of phone OR exact email address
    const matchedRider = riders.find((r) => {
      const isIdMatch = r.id.toLowerCase() === term.toLowerCase();
      
      const cleanInput = term.replace(/\D/g, "");
      const rClean = r.phone.replace(/\D/g, "");
      const isPhoneMatch = cleanInput.length >= 8 && rClean.endsWith(cleanInput.slice(-10));
      
      const isEmailMatch = r.email && r.email.toLowerCase().trim() === term.toLowerCase().trim();
      
      return isIdMatch || isPhoneMatch || isEmailMatch;
    });

    if (!matchedRider) {
      setLoginError("Rider account not found in database. Registered Rider slots are created by Administrators.");
      return;
    }

    // Checking password (default '123456' if not specified in types)
    const storedPassword = matchedRider.password || "123456";
    if (pin !== storedPassword) {
      setLoginError("Invalid password credentials. Please check with your supervisor or Admin Panel.");
      return;
    }

    // Request GPS permission tracker
    if (!gpsApproved) {
      handleRequestGPS();
      return;
    }

    // Sign in
    const authenticatedRider = { ...matchedRider, isActiveOnDuty: true };
    setRiderSession(authenticatedRider);
    localStorage.setItem("smartcart_rider_session", JSON.stringify(authenticatedRider));

    // Update global state
    setRiders((prev) => 
      prev.map((r) => r.id === matchedRider.id ? { ...r, isActiveOnDuty: true } : r)
    );

    // Boot real-time watchPosition
    startLiveGpstWatch(matchedRider.id);
  };

  // Live navigator.geolocation watching
  const startLiveGpstWatch = (riderId: string) => {
    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          updateRiderCoordinates(riderId, pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn("[Rider Watch] GPS stream skipped:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      setWatchId(id);
    }
  };

  const updateRiderCoordinates = (riderId: string, latitude: number, longitude: number) => {
    // Convert GPS latitude & longitude coordinates to simulated percentage grid bounds of Delhi area for visuals (e.g. 28N, 77E)
    // Map bounds approximately Delhi area: Lat 28.4 to 28.8, Lng 76.9 to 77.3
    const relativeLat = Math.max(10, Math.min(90, ((latitude - 28.4) / 0.4) * 100));
    const relativeLng = Math.max(10, Math.min(90, ((longitude - 76.9) / 0.4) * 100));

    setRiders((prev) => {
      const updated = prev.map((r) => 
        r.id === riderId 
          ? { ...r, lat: relativeLat, lng: relativeLng } 
          : r
      );
      localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
      return updated;
    });

    setRiderSession((prev) => {
      if (prev && prev.id === riderId) {
        return { ...prev, lat: relativeLat, lng: relativeLng };
      }
      return prev;
    });
  };

  // Duty Toggle handler
  const handleToggleDuty = () => {
    if (!riderSession) return;

    const newDuty = !riderSession.isActiveOnDuty;
    const updatedRider = { ...riderSession, isActiveOnDuty: newDuty };

    setRiderSession(updatedRider);
    localStorage.setItem("smartcart_rider_session", JSON.stringify(updatedRider));

    setRiders((prev) => {
      const updated = prev.map((r) => r.id === riderSession.id ? { ...r, isActiveOnDuty: newDuty } : r);
      localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
      return updated;
    });

    if (!newDuty && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    } else if (newDuty) {
      startLiveGpstWatch(riderSession.id);
    }
  };

  const handleLogout = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    if (riderSession) {
      // Put rider off-duty on logout as a safety measure
      setRiders((prev) => {
        const updated = prev.map((r) => r.id === riderSession.id ? { ...r, isActiveOnDuty: false } : r);
        localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
        return updated;
      });
    }

    setRiderSession(null);
    localStorage.removeItem("smartcart_rider_session");
    setIsAutoDriving(false);
    setSimulatedPathPercent(0);
  };

  // Delivery Requests operations (Accept offer)
  const handleAcceptOrder = async (orderId: string) => {
    if (!riderSession) return;
    setIsAcceptingOrder(orderId);
    setNotification(null);

    console.log(`[RiderDashboard] Starting safe verification and assignment for Order #${orderId}`);
    try {
      // 1. Fetch fresh list from Firebase first
      const freshOrders = await fetchOrdersFromFirebase("Rider", true);
      const targetOrder = freshOrders.find((o) => o.id === orderId);

      // 2. Validate double claim or race condition
      if (targetOrder && targetOrder.deliveryPartner && targetOrder.deliveryPartner.id !== riderSession.id) {
        console.warn(`[RiderDashboard] Race condition detected: Order #${orderId} was already accepted by ${targetOrder.deliveryPartner.name}`);
        setNotification(`⚠️ Too slow! Order #${orderId} has already been claimed by another Rider.`);
        setIsAcceptingOrder(null);
        return;
      }

      // 3. Perform assignment through our consolidated top-level handler
      onAssignPartnerToOrder(
        orderId,
        {
          id: riderSession.id,
          name: riderSession.name,
          phone: riderSession.phone,
          avatar: riderSession.avatar,
          vehicleNumber: riderSession.vehicleNumber,
        },
        "confirmed"
      );

      // 4. Update local rider analytics in memory / localStorage
      setRiders((prev) => {
        const updated = prev.map((r) => {
          if (r.id === riderSession.id) {
            return {
              ...r,
              activeDeliveries: r.activeDeliveries + 1,
              status: "delivering" as const,
            };
          }
          return r;
        });
        localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
        return updated;
      });

      setRiderSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          activeDeliveries: prev.activeDeliveries + 1,
          status: "delivering",
        };
      });

      setSimulatedPathPercent(0);
      setNotification(`🎉 Successfully claimed Order #${orderId}! Route optimized & synced!`);
    } catch (err: any) {
      console.error("[RiderDashboard] Critical failure in handleAcceptOrder:", err);
      setNotification(`❌ Error claiming order: ${err?.message || String(err)}`);
    } finally {
      setIsAcceptingOrder(null);
    }
  };

  // Pass/skip request (hides from this rider, keeps active for others)
  const handlePassOrderAction = (orderId: string) => {
    if (!riderSession) return;
    onPassOrder(orderId, riderSession.id);
    setNotification("Passed request. Order remains available for other partners.");
  };

  // Outright cancel/reject order (cancels completely across system)
  const handleRejectOrderAction = (orderId: string) => {
    if (!riderSession) return;
    onUpdateOrderStatus(orderId, "cancelled");
    setNotification(`🚨 Order #${orderId} has been rejected & cancelled.`);
  };

  // Start simulated delivery journey action
  const handleStartDelivery = (orderId: string) => {
    onUpdateOrderStatus(orderId, "out_for_delivery");
    setSimulatedPathPercent(10);
    setNotification("Order status changed to Out for Delivery. Satellites and beacons connected!");
  };

  // Auto glide/drive GPS coordinates mock engine to destination
  useEffect(() => {
    if (!isAutoDriving || simulatedPathPercent >= 100 || !riderSession) return;

    const interval = setInterval(() => {
      const next = Math.min(100, simulatedPathPercent + 15);
      setSimulatedPathPercent(next);
      
      if (next === 100) {
        setIsAutoDriving(false);
        setNotification("You have arrived at the destination! Complete the delivery physically.");
      }
      
      // Simulating coordinate movement on grid toward target bounds
      // Fulfillment hub was set near (45%, 45%), Customer destination is simulated randomly
      const progressFactor = next / 100;
      const startLat = 45;
      const startLng = 45;
      const destLat = 30; // Mock customer coordinate target
      const destLng = 70;

      const currentLat = startLat + (destLat - startLat) * progressFactor;
      const currentLng = startLng + (destLng - startLng) * progressFactor;

      setRiders((prevRiders) => {
        const updated = prevRiders.map((r) => 
          r.id === riderSession.id 
            ? { ...r, lat: currentLat, lng: currentLng } 
            : r
        );
        localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoDriving, simulatedPathPercent, riderSession, setRiders]);

  const handleCompleteDelivery = (orderId: string) => {
    setIsAutoDriving(false);
    onUpdateOrderStatus(orderId, "delivered");

    // Complete transaction record
    setRiders((prev) => {
      const updated = prev.map((r) => {
        if (r.id === riderSession?.id) {
          return {
            ...r,
            completedDeliveries: r.completedDeliveries + 1,
            activeDeliveries: Math.max(0, r.activeDeliveries - 1),
            status: "idle" as const
          };
        }
        return r;
      });
      localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
      return updated;
    });

    setRiderSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        completedDeliveries: prev.completedDeliveries + 1,
        activeDeliveries: Math.max(0, prev.activeDeliveries - 1),
        status: "idle"
      };
    });

    setSimulatedPathPercent(100);
    setNotification(`Fulfillment success! Order #${orderId} delivered.`);
  };

  const handleNudgeSimulatedGPX = () => {
    if (!riderSession) return;
    
    const next = Math.min(100, simulatedPathPercent + 20);
    setSimulatedPathPercent(next);
      
    const progressFactor = next / 100;
    const startLat = 45;
    const startLng = 45;
    const destLat = 30;
    const destLng = 70;

    const currentLat = startLat + (destLat - startLat) * progressFactor;
    const currentLng = startLng + (destLng - startLng) * progressFactor;

    setRiders((prevRiders) => {
      const updated = prevRiders.map((r) => 
        r.id === riderSession.id 
          ? { ...r, lat: currentLat, lng: currentLng } 
          : r
      );
      localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
      return updated;
    });

    if (next === 100) {
      setNotification("Arrived at client destination coords!");
    }
  };

  // Filter lists of active delivery actions
  const myDeliveries = orders.filter((o) => {
    const isMine = o.deliveryPartner && (o.deliveryPartner.id === riderSession?.id || o.rider_id === riderSession?.id || o.deliveryPartner.name === riderSession?.name);
    return isMine && o.status !== "delivered" && o.status !== "cancelled";
  });

  const availableRequests = orders.filter((o) => {
    const isUnassigned = (o.status === "placed" || o.status === "confirmed" || o.status === "packed") && !o.deliveryPartner;
    const isNotRejected = !o.rejectedByRiders?.includes(riderSession?.id || "");
    return isUnassigned && isNotRejected;
  });

  const deliveryHistory = orders.filter((o) => {
    return o.deliveryPartner && (o.deliveryPartner.id === riderSession?.id || o.rider_id === riderSession?.id || o.deliveryPartner.name === riderSession?.name) && o.status === "delivered";
  });

  // Render Login page if caller session is offline
  if (!riderSession) {
    return (
      <div className="mx-auto max-w-lg min-h-[75vh] flex flex-col items-center justify-center px-4 py-8" id="rider-auth-portal">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl relative overflow-hidden text-left"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 h-32 w-32 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 bg-green-500/10 rounded-full blur-3xl" />

          {/* Heading */}
          <div className="text-center pb-4 border-b border-slate-800">
            <div className="h-14 w-14 bg-gradient-to-tr from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/20">
              <Bike className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-wider text-slate-100">Rider Partner Terminal</h2>
            <p className="text-xs text-slate-400 font-medium mt-1">Clock-in and receive express unassigned delivery routes</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 mt-5">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rider ID, Email or Registered Phone</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. rider@smartcart.com or rider-1"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold focus:border-orange-500 text-white focus:ring-1 focus:ring-orange-550 focus:outline-none"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Access PIN (6 Digits)</label>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit PIN"
                  className="block w-full px-3 py-2.5 bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold focus:border-orange-500 text-white focus:ring-1 focus:ring-orange-550 focus:outline-none tracking-widest text-center"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            {/* GPS Authorization request */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 flex items-center justify-between gap-3 text-left">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-200 flex items-center gap-1">
                  <Compass className={`h-3 w-3 ${watchId !== null ? "text-green-400 animate-spin" : "text-orange-400"}`} /> 
                  1. Location Verification
                </span>
                <p className="text-[9px] text-slate-400 font-medium">Duty status triggers real-time GPS coordinates stream for customer tracking.</p>
              </div>

              {!gpsApproved ? (
                <button
                  type="button"
                  onClick={handleRequestGPS}
                  disabled={requestingGPS}
                  className="px-3 py-1.5 bg-orange-500 rounded-lg text-[9px] font-extrabold uppercase tracking-widest leading-none disabled:opacity-55 hover:bg-orange-600 transition shrink-0 cursor-pointer text-white"
                >
                  {requestingGPS ? "Detecting..." : "Enable GPS"}
                </button>
              ) : (
                <div className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase flex items-center gap-1 tracking-wider leading-none shrink-0">
                  <Check className="h-3 w-3" /> Enabled
                </div>
              )}
            </div>

            {loginError && (
              <p className="text-xs font-bold text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:scale-[1.01] active:scale-98 text-white text-xs font-black uppercase tracking-widest rounded-xl transition shadow-lg shadow-orange-500/10 cursor-pointer"
            >
              <Power className="h-4 w-4" />
              <span>Clock-In on Duty</span>
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 text-left" id="rider-authorized-dashboard">
      
      {/* Real-Time Notification Toast */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-55 w-full max-w-lg bg-orange-600 border border-orange-500 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between"
        >
          <div className="flex items-center space-x-2.5">
            <Bell className="h-5 w-5 animate-bounce shrink-0" />
            <p className="text-xs font-bold">{notification}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-extrabold uppercase ml-3 bg-orange-700/20 px-2 py-1 rounded">Ok</button>
        </motion.div>
      )}

      {/* Rider Header Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-md">
        
        {/* Bio */}
        <div className="flex items-center space-x-3.5 w-full md:w-auto">
          <RiderAvatar name={riderSession.name} className="h-12 w-12 text-sm border-2 border-orange-500" />
          <div className="text-left">
            <span className="inline-flex items-center space-x-1.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-black text-orange-400 uppercase tracking-widest">
              <Bike className="h-3 w-3" />
              <span>Verified Agent</span>
            </span>
            <h2 className="text-base font-black text-slate-100">{riderSession.name}</h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">{riderSession.vehicleNumber} • {riderSession.phone}</p>
          </div>
        </div>

        {/* Live GPS beacon diagnostics & power switch */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="bg-slate-950 px-3.5 py-2.5 border border-slate-850 rounded-2xl text-[10px] text-left">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${riderSession.isActiveOnDuty ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className="font-extrabold uppercase tracking-wider text-slate-300">Beacon Status</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {riderSession.isActiveOnDuty 
                ? `ON-DUTY (${riderSession.lat.toFixed(2)}N, ${riderSession.lng.toFixed(2)}E)` 
                : "OFF-DUTY (GPS Inactive)"
              }
            </p>
          </div>

          <button
            onClick={handleToggleDuty}
            className={`flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition active:scale-95 cursor-pointer ${
              riderSession.isActiveOnDuty 
                ? "bg-red-550 hover:bg-red-650 text-white shadow-lg shadow-red-500/10" 
                : "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/10"
            }`}
          >
            <Power className="h-4 w-4" />
            <span>{riderSession.isActiveOnDuty ? "Go Off-Duty" : "Go On-Duty"}</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 hover:text-red-400 rounded-xl transition text-slate-400 cursor-pointer"
            title="Clock-out & Logout"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>

      </div>

      {/* KPI stats section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-left">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Active Runs</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-gray-800">{myDeliveries.length}</span>
            <span className="text-[10px] text-gray-400">On-Going</span>
          </div>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-left">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Completed Runs</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-green-600">{riderSession.completedDeliveries}</span>
            <span className="text-[10px] text-gray-400">Fulfillments</span>
          </div>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-left">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Daily Payout</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-orange-500">₹{riderSession.completedDeliveries * 50}</span>
            <span className="text-[10px] text-gray-400">@₹50/order</span>
          </div>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-left">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Partner Rating</p>
          <div className="flex items-center space-x-1.5 mt-1">
            <span className="text-xl font-extrabold text-yellow-500">4.9</span>
            <div className="flex h-4 w-4 items-center justify-center bg-yellow-400 rounded p-0.5 text-[8px] font-black text-gray-900 leading-none">★ Gold</div>
          </div>
        </div>
      </div>

      {/* Off-Duty warning cover */}
      {!riderSession.isActiveOnDuty ? (
        <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 text-center max-w-2xl mx-auto my-12 space-y-4">
          <AlertCircle className="h-10 w-10 text-orange-500 animate-bounce mx-auto" />
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">You are Currently Off-Duty</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Toggle your <strong>Beacon Status to On-Duty</strong> at the top bar to initialize location services and start receiving real-time client delivery invitations.
          </p>
          <button
            onClick={handleToggleDuty}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 font-extrabold text-xs uppercase tracking-widest text-white rounded-xl shadow-md transition cursor-pointer"
          >
            Clock-In Now
          </button>
        </div>
      ) : (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Col 1 & 2: Deliveries panels */}
          <div className="lg:col-span-2 space-y-6">

            {/* My Active Running Delivery */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2.5">
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Active Deliveries</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Assigned shipments active currently</p>
                </div>
                <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase leading-none">{myDeliveries.length} Active</span>
              </div>

              {myDeliveries.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-xs text-gray-450 font-medium">
                  No active shipment assigned right now. Accept an incoming request below!
                </div>
              ) : (
                <div className="space-y-4">
                  {myDeliveries.map((order) => {
                    const isOut = order.status === "out_for_delivery";
                    const isPacked = order.status === "packed";
                    const isConfirmed = order.status === "confirmed";

                    return (
                      <div key={order.id} className="bg-white border-2 border-orange-500 rounded-3xl p-5 shadow-xs relative overflow-hidden">
                        
                        {/* Glowing progress line */}
                        {isOut && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-green-500 animate-pulse" />
                        )}

                        <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-3.5">
                          <div>
                            <span className="text-[10px] font-extrabold text-orange-500 font-sans tracking-wide">#{order.id}</span>
                            <div className="text-xs font-black text-gray-900 mt-0.5 capitalize">{order.address.name}</div>
                          </div>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${
                            isOut ? "bg-orange-100 text-orange-700 animate-pulse" : "bg-green-100 text-green-700"
                          }`}>
                            {order.status === "confirmed" ? "Accepted" : order.status === "packed" ? "Packed & Ready" : "On the way"}
                          </span>
                        </div>

                        {/* Customer Address Details */}
                        <div className="space-y-2 mb-4 text-xs text-gray-700 bg-gray-50 p-3 rounded-2xl border border-gray-100 font-medium">
                          <div className="flex items-start gap-2.5">
                            <MapPin className="h-4.5 w-4.5 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-gray-900 capitalize text-xs">Fulfillment Destination ({order.address.label})</p>
                              <p className="text-gray-500 text-[11px] mt-0.5 leading-normal">{order.address.addressLine}, {order.address.city} - {order.address.pincode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 border-t border-gray-200/60 pt-2.5 mt-2.5">
                            <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                            <a href={`tel:${order.address.phone}`} className="font-bold text-gray-700 hover:underline">{order.address.phone}</a>
                          </div>
                          
                          {/* Instructions */}
                          <div className="border-t border-gray-200/60 pt-2.5 mt-2.5 flex items-start gap-2 text-[10px]">
                            <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold uppercase text-gray-500">Delivery Instructions:</span>
                              <p className="text-gray-800 font-semibold italic mt-0.5">"{order.deliveryInstructions || "Leave at door, ring bell once."}"</p>
                            </div>
                          </div>
                        </div>

                        {/* Order Items Summary */}
                        <div className="mb-4">
                          <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 tracking-wider">Shipment Items ({order.items.length})</h4>
                          <div className="space-y-1.5 font-sans bg-gray-50/50 p-3 rounded-xl border border-gray-100 max-h-32 overflow-y-auto">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-gray-700">
                                <span>{item.product.name} <strong className="text-gray-500 font-sans">x{item.quantity}</strong></span>
                                <span className="font-semibold text-gray-900">₹{item.product.sellingPrice * item.quantity}</span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t border-gray-100 pt-1.5 mt-1.5 text-xs font-black text-gray-900">
                              <span>TOTAL SHIPMENT VALUE</span>
                              <span>₹{order.total} • ({order.paymentMethod.toUpperCase()})</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Selection Dropdown */}
                        <div className="space-y-4 mt-4 pt-4 border-t border-gray-100 text-left">
                          <div>
                            <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest leading-none mb-2">Select Progress Status</p>
                            <div className="relative">
                              <select
                                value={order.status}
                                onChange={(e) => {
                                  const val = e.target.value as Order["status"];
                                  if (val === "packed") {
                                    onUpdateOrderStatus(order.id, "packed");
                                    setNotification(`Order #${order.id} marked as Packed.`);
                                  } else if (val === "out_for_delivery") {
                                    handleStartDelivery(order.id);
                                  } else if (val === "delivered") {
                                    handleCompleteDelivery(order.id);
                                  } else if (val === "confirmed") {
                                    onUpdateOrderStatus(order.id, "confirmed");
                                    setNotification(`Order #${order.id} marked as Accepted.`);
                                  }
                                }}
                                className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-xs font-black uppercase outline-none cursor-pointer transition ${
                                  order.status === "delivered"
                                    ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-100"
                                    : order.status === "out_for_delivery"
                                    ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-100 animate-pulse"
                                    : order.status === "packed"
                                    ? "bg-yellow-400 border-yellow-400 text-gray-900 shadow-md shadow-yellow-100"
                                    : "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-100"
                                }`}
                              >
                                <option value="confirmed" className="text-gray-900 bg-white font-bold">Accepted (Confirmed)</option>
                                <option value="packed" className="text-gray-900 bg-white font-bold">Packed & Loaded</option>
                                <option value="out_for_delivery" className="text-gray-900 bg-white font-bold">On the way (Out For Delivery)</option>
                                <option value="delivered" className="text-gray-900 bg-white font-bold">Delivered / Cash Collected</option>
                              </select>
                            </div>
                          </div>

                          {/* Live simulator controls showing up if they select Onway */}
                          {isOut && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-250">
                              {/* Simulate path coordinates tracker map box */}
                              <div className="border border-gray-200 rounded-2xl p-3 bg-gray-900 text-white relative overflow-hidden text-[10px]">
                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-[8px] font-bold text-gray-400 uppercase">GPS streaming active</span>
                                </div>
                                <h5 className="font-bold uppercase tracking-wider mb-1.5 text-orange-400">Client Route Beacon Map</h5>
                                <div className="flex items-center gap-3 bg-black/50 p-2 rounded-xl mb-2 border border-slate-800">
                                  <div className="h-2 flex-grow bg-slate-800 rounded-full relative">
                                    <div 
                                      className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-400 to-green-400 rounded-full transition-all duration-1000"
                                      style={{ width: `${simulatedPathPercent}%` }}
                                    />
                                    {/* Bicycle position helper */}
                                    <div 
                                      className="absolute -top-1.5 h-5 w-5 bg-orange-500 rounded-full flex items-center justify-center border border-white shadow-md transition-all duration-1000 shrink-0"
                                      style={{ left: `calc(${simulatedPathPercent}% - 8px)` }}
                                    >
                                      <Bike className="h-3 w-3 text-white" />
                                    </div>
                                  </div>
                                  <span className="font-sans font-bold text-gray-300 w-8">{simulatedPathPercent}%</span>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleNudgeSimulatedGPX}
                                    disabled={simulatedPathPercent >= 100}
                                    className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-white font-extrabold uppercase text-[9px] rounded-lg tracking-wider transition disabled:opacity-40 cursor-pointer"
                                  >
                                    Nudge GPS
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsAutoDriving(!isAutoDriving)}
                                    disabled={simulatedPathPercent >= 100}
                                    className={`flex-grow-2 py-1 font-extrabold uppercase text-[9px] rounded-lg tracking-wider transition disabled:opacity-40 cursor-pointer ${
                                      isAutoDriving ? "bg-red-500 text-white animate-pulse" : "bg-orange-500 text-white"
                                    }`}
                                  >
                                    {isAutoDriving ? "Auto-Drive active..." : "Auto Drive (Walk Route)"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unassigned Incoming Delivery requests list */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2.5 mt-8">
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Incoming Delivery Requests</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Open unassigned orders near you</p>
                </div>
                <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase leading-none">{availableRequests.length} Near Hub</span>
              </div>

              {availableRequests.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center text-xs text-gray-400 font-medium">
                  We'll sound the radar when new unassigned shipments are placed. Stand by!
                </div>
              ) : (
                <div className="space-y-4">
                  {availableRequests.map((order) => (
                    <motion.div 
                      key={order.id} 
                      initial={{ scale: 0.98, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm text-left relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 text-[8px] font-black tracking-widest px-2.5 py-1 uppercase rounded-bl-xl shadow-xs leading-none">
                        🔥 REQUEST
                      </div>

                      <div className="flex justify-between items-start border-b border-gray-50 pb-2.5 mb-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase font-sans"># {order.id}</span>
                          <h4 className="text-xs font-black text-gray-800 leading-normal capitalize">{order.address.name}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-orange-500">₹{order.total}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{order.paymentMethod}</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-gray-500 mb-3.5 font-medium">
                        <p className="line-clamp-1"><strong className="text-gray-700">Hub Target:</strong> SmartCart ND01 Hub</p>
                        <p className="line-clamp-1"><strong className="text-gray-700">Fulfill Point:</strong> {order.address.addressLine}, {order.address.city}</p>
                        <p className="line-clamp-1 font-bold italic text-slate-500">"{order.deliveryInstructions || "Deliver fast, organic products requested"}"</p>
                      </div>

                      {/* Items loop */}
                      <div className="border border-gray-100 bg-gray-50/50 p-2.5 rounded-xl text-[10px] space-y-1 font-mono mb-4 text-gray-600">
                        {order.items.map((x, i) => (
                          <div key={i} className="flex justify-between">
                            <span>• {x.product.name} x{x.quantity}</span>
                            <span>₹{x.product.sellingPrice * x.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleAcceptOrder(order.id)}
                          className="py-2.5 bg-green-500 hover:bg-green-600 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl transition cursor-pointer"
                        >
                          Accept Order to Deliver
                        </button>
                        <button
                          onClick={() => handleRejectOrderAction(order.id)}
                          className="py-2.5 bg-red-50 text-red-650 border border-red-150 hover:bg-red-100 font-extrabold uppercase tracking-wider text-xs rounded-xl transition cursor-pointer"
                          title="Outright reject and cancel this order"
                        >
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Col 3: Side histories and charts */}
          <div className="space-y-6">

            <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-xs">
              <div className="border-b border-gray-50 pb-3 mb-4 text-left">
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Completed Deliveries</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Your record of fulfilled orders</p>
              </div>

              {deliveryHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-450 font-medium">
                  Deliveries will list here once successfully closed!
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {deliveryHistory.map((item) => (
                    <div key={item.id} className="bg-gray-50/50 border border-gray-100 p-3 rounded-xl flex items-center justify-between text-left">
                      <div className="text-xs">
                        <p className="font-bold text-gray-800 font-sans">#{item.id}</p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{item.address.addressLine}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-600">₹{item.total}</p>
                        <span className="text-[9px] text-gray-400 font-semibold">{item.date.split(",")[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance target badge */}
            <div className="bg-gradient-to-tr from-slate-900 to-slate-850 p-5 rounded-3xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 h-24 w-24 bg-green-500/10 rounded-full blur-2xl" />
              <Bike className="h-8 w-8 text-orange-500 animate-pulse mb-3" />
              <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">Courier Performance Tier</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                You are currently placed on the <strong>Gold Valet tier</strong>. Receive a ₹10 payout bonus for maintaining coordinates compliance and 15-minute speed records.
              </p>
              <div className="flex justify-between items-center bg-black/40 border border-slate-850 p-3 rounded-2xl mt-4 text-[11px] font-bold">
                <span className="text-gray-400">Target Accuracy:</span>
                <span className="text-green-400">99.8% Perfect</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
