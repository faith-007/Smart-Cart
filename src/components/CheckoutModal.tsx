import React, { useState } from "react";
import { X, MapPin, ChevronRight, Check, Plus, ArrowLeft, ShieldCheck, Compass, Loader2, AlertTriangle } from "lucide-react";
import { Address } from "../types";
import DeliveryMap from "./DeliveryMap";
import { calculateDistance } from "../lib/firebase";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses: Address[];
  onAddAddress: (addr: Omit<Address, "id">, setAsDefault?: boolean) => Promise<any> | void;
  selectedAddress: Address | null;
  onSelectAddress: (addr: Address) => void;
  totalAmount: number;
  onCompletePayment: (address: Address, payMethod: string) => void;
  isStoreOpen?: boolean;
  onStoreClosedClick?: () => void;
  deliveryZoneSettings?: any;
  onServiceNotAvailable?: () => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  savedAddresses,
  onAddAddress,
  selectedAddress,
  onSelectAddress,
  totalAmount,
  onCompletePayment,
  isStoreOpen = true,
  onStoreClosedClick,
  deliveryZoneSettings,
  onServiceNotAvailable,
}: CheckoutModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Address Form State
  const [newLabel, setNewLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [newName, setNewName] = useState("");
  const [newHouseFlatNumber, setNewHouseFlatNumber] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("New Delhi");
  const [newStateVal, setNewStateVal] = useState("Delhi");
  const [newPincode, setNewPincode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [formError, setFormError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newGpsAccuracy, setNewGpsAccuracy] = useState<number | null>(null);

  // Payment State
  const [payMethod, setPayMethod] = useState("Cash on Delivery (COD)");
  const [upiId, setUpiId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancellationPolicyConfirm, setShowCancellationPolicyConfirm] = useState(false);

  if (!isOpen) return null;

  // Browser Geolocation Detector
  const handleDetectLocation = () => {
    setIsDetecting(true);
    setFormError("");
    if (!navigator.geolocation) {
      setFormError("Geolocation is not supported by your browser software.");
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setNewLat(rawLat);
        setNewLng(rawLng);
        setNewGpsAccuracy(accuracy);

        // Query OpenStreetMap Nominatim for Reverse Geocoding (Fully client-side, keyless)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${rawLat}&lon=${rawLng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setNewStreet(data.display_name);
              if (data.address) {
                const cityVal = data.address.city || data.address.town || data.address.suburb || data.address.state_district || "New Delhi";
                const pinVal = data.address.postcode || "";
                const stateVal = data.address.state || "Delhi";
                setNewCity(cityVal);
                setNewStateVal(stateVal);
                if (pinVal) setNewPincode(pinVal);
              }
            } else {
              setNewStreet(`Estimated Location (Lat: ${rawLat.toFixed(4)}, Lng: ${rawLng.toFixed(4)})`);
            }
          })
          .catch((err) => {
            console.error("[SmartCart Geolocation] OSM lookup failed, using coordinates:", err);
            setNewStreet(`Coordinates (Lat: ${rawLat.toFixed(4)}, Lng: ${rawLng.toFixed(4)})`);
          })
          .finally(() => {
            setIsDetecting(false);
          });
      },
      (error) => {
        console.warn("[SmartCart Geolocation] Permission denied or timed out:", error);
        setFormError("GPS not available. Fallback mock-map loaded - please drag pin manually.");
        setNewLat(28.6139); // Delhi Fallback
        setNewLng(77.2090); // Delhi Fallback
        setNewGpsAccuracy(150);
        setIsDetecting(false);
      },
      { timeout: 8000 }
    );
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHouseFlatNumber.trim() || !newStreet.trim() || !newPincode.trim() || !newPhone.trim() || !newStateVal.trim()) {
      setFormError("All fields marked with * are strictly mandatory.");
      return;
    }
    if (newPhone.replace(/\D/g, "").length < 10) {
      setFormError("Please provide a valid 10-digit mobile number.");
      return;
    }

    const cleanedPhone = "+91 " + newPhone.replace(/\D/g, "").slice(-10);
    const combinedAddress = `${newHouseFlatNumber.trim()}, ${newStreet.trim()}`;

    setIsSavingAddress(true);
    setFormError("");

    try {
      await onAddAddress({
        label: newLabel,
        name: newName.trim(),
        addressLine: combinedAddress,
        city: newCity.trim(),
        pincode: newPincode.trim(),
        phone: cleanedPhone,
        fullName: newName.trim(),
        phoneNumber: cleanedPhone,
        houseFlatNumber: newHouseFlatNumber.trim(),
        street: newStreet.trim(),
        landmark: newLabel,
        state: newStateVal.trim(),
        isDefault: newIsDefault,
        lat: newLat || undefined,
        lng: newLng || undefined,
        gpsAccuracy: newGpsAccuracy || undefined,
      }, newIsDefault);

      // Reset Address Form State
      setIsAddingAddress(false);
      setNewName("");
      setNewHouseFlatNumber("");
      setNewStreet("");
      setNewPincode("");
      setNewPhone("");
      setNewIsDefault(false);
      setNewLat(null);
      setNewLng(null);
      setFormError("");
    } catch (err: any) {
      console.error("[CheckoutModal] Failed to save address:", err);
      let msg = "Could not save address. Please check your network and try again.";
      if (err instanceof Error) {
        msg = err.message;
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            msg = `Firestore Error: ${parsed.error}`;
          }
        } catch (_) {}
      }
      setFormError(msg);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleTriggerPayment = () => {
    if (payMethod.includes("UPI") || payMethod.includes("Unified")) {
      setPaymentError("UPI payments are currently disabled. Please select Cash on Delivery to place your order.");
      return;
    }

    setPaymentError("");
    setShowCancellationPolicyConfirm(true);
  };

  const handleConfirmFinalOrderPlacement = () => {
    setShowCancellationPolicyConfirm(false);
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      if (selectedAddress) {
        onCompletePayment(selectedAddress, payMethod);
      }
    }, 2000);
  };

  const METHODS = [
    {
      label: "Unified Payments Interface (UPI)",
      value: "UPI (Instantly Verified)",
      description: "Pay securely with instant verification via Google Pay, PhonePe, or Paytm",
      isComingSoon: true,
    },
    {
      label: "Cash on Delivery / POD",
      value: "Cash on Delivery (COD)",
      description: "Pay with Cash or scan QR code on parcel handoff",
      isComingSoon: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      {/* Container Box */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[92vh] text-left"
        id="checkout-wizard-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Secure Instant Checkout</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Fast 2-Step fulfillment workflow</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Timeline indicators */}
        <div className="my-5 flex items-center justify-between px-2">
          <button
            disabled={isProcessing}
            onClick={() => setStep(1)}
            className={`flex items-center space-x-1.5 text-xs font-bold transition ${
              step >= 1 ? "text-green-600 font-black" : "text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                step >= 1 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              1
            </span>
            <span>Delivery Address</span>
          </button>

          <div className={`flex-1 h-[2px] mx-4 rounded-full ${step >= 2 ? "bg-green-500" : "bg-gray-200"}`} />

          <div
            className={`flex items-center space-x-1.5 text-xs font-bold transition ${
              step >= 2 ? "text-green-600 font-black" : "text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                step >= 2 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              2
            </span>
            <span>Payment Method</span>
          </div>
        </div>

        {/* ================= STEP 1: ADDRESS SELECTION ================= */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Select Delivery Location</h3>
              {!isAddingAddress && (
                <button
                  onClick={() => setIsAddingAddress(true)}
                  className="flex items-center space-x-1 text-xs font-bold text-green-600 hover:text-green-700 hover:underline cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Address</span>
                </button>
              )}
            </div>

            {isAddingAddress ? (
              <form
                onSubmit={handleAddNewAddress}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 gap-3 grid grid-cols-1 sm:grid-cols-2"
              >
                <div className="col-span-full flex justify-between items-center bg-white p-3 rounded-xl border border-gray-150 shadow-xs mb-1">
                  <div>
                    <h5 className="text-xs font-black text-gray-900 leading-none">Instant Location Detection</h5>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 leading-none">Request GPS coordinates via browser API</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetecting}
                    className="flex items-center space-x-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100 transition cursor-pointer disabled:opacity-50"
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="h-3.5 w-3.5" />
                        <span>Grab Current GPS</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="col-span-full">
                  <label className="text-[10px] font-bold text-gray-450 uppercase">Address Type Label</label>
                  <div className="flex space-x-2 mt-1">
                    {(["Home", "Work", "Other"] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setNewLabel(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          newLabel === type
                            ? "bg-green-500 border-green-500 text-white font-semibold"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Map */}
                {newLat && newLng && (
                  <div className="col-span-full space-y-1.5 mt-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Drag Pin to Match Your Doorstep</label>
                    <DeliveryMap
                      lat={newLat}
                      lng={newLng}
                      accuracy={newGpsAccuracy || undefined}
                      onLocationChange={(newLatVal, newLngVal) => {
                        setNewLat(newLatVal);
                        setNewLng(newLngVal);
                        
                        // Reverse Lookups
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLatVal}&lon=${newLngVal}`)
                          .then((res) => res.json())
                          .then((data) => {
                            if (data && data.display_name) {
                              setNewStreet(data.display_name);
                              if (data.address) {
                                const cityVal = data.address.city || data.address.town || data.address.suburb || data.address.state_district || newCity;
                                const pinVal = data.address.postcode || newPincode;
                                const stateVal = data.address.state || newStateVal;
                                setNewCity(cityVal);
                                setNewStateVal(stateVal);
                                if (pinVal) setNewPincode(pinVal);
                              }
                            }
                          })
                          .catch((err) => console.warn("Map drag reverse lookup failed:", err));
                      }}
                    />
                    {newGpsAccuracy && newGpsAccuracy > 100 && (
                      <div className="p-2.5 border border-yellow-250 bg-yellow-50 text-yellow-850 rounded-xl text-[10.5px] font-bold flex items-start gap-1.5 animate-pulse leading-normal">
                        <span>⚠️</span>
                        <span>
                          Low GPS accuracy ({newGpsAccuracy.toFixed(0)}m). Please drag the green pin on the map to focus directly on your entrance.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Contact Recipient Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    placeholder="Enter full name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">House / Flat / Floor *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                    placeholder="e.g. Flat 302, 3rd Floor"
                    value={newHouseFlatNumber}
                    onChange={(e) => setNewHouseFlatNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Street Row / Sector *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                    placeholder="e.g. Cyber City, Sector 24"
                    value={newStreet}
                    onChange={(e) => setNewStreet(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">City *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">State *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                    value={newStateVal}
                    onChange={(e) => setNewStateVal(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Pincode *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                    placeholder="6-digit Area code"
                    maxLength={6}
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="col-span-full flex items-center space-x-2 mt-1 py-1">
                  <input
                    type="checkbox"
                    id="checkout-default-checkbox"
                    checked={newIsDefault}
                    onChange={(e) => setNewIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer"
                  />
                  <label htmlFor="checkout-default-checkbox" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                    Set as Default Address
                  </label>
                </div>

                {formError && <p className="col-span-full text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">{formError}</p>}

                <div className="col-span-full flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    disabled={isSavingAddress}
                    onClick={() => setIsAddingAddress(false)}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="px-5 py-2 bg-green-500 text-white font-black text-xs rounded-xl hover:bg-green-600 transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSavingAddress ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Address</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {savedAddresses.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-150 p-6">
                    <MapPin className="h-8 w-8 text-gray-450 mx-auto" />
                    <h4 className="text-xs font-black text-gray-700 uppercase mt-3">No Saved Address Found</h4>
                    <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      You haven't configured any shipping endpoints. Add your delivery location or grab coordinates automatically to order.
                    </p>
                    <button
                      onClick={() => setIsAddingAddress(true)}
                      className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md shadow-green-100"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add First Address</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddress?.id === addr.id;
                      const isUnserviceable = addr.serviceable === false;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => onSelectAddress(addr)}
                          className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                            isUnserviceable
                              ? "border-red-200 bg-red-50/10 opacity-70"
                              : isSelected
                              ? "border-green-500 bg-green-50/10 shadow-sm"
                              : "border-gray-150 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                              isUnserviceable ? "text-rose-700 bg-rose-50 border border-rose-100" : "text-green-700 bg-green-50"
                            }`}>
                              {addr.label} {isUnserviceable && "• Out of Area"}
                            </span>
                            {isSelected && !isUnserviceable && <Check className="h-4 w-4 text-green-600" />}
                          </div>
                          <p className="text-xs font-bold text-gray-800">{addr.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 font-medium leading-normal">{addr.addressLine}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1">
                            {addr.city} • {addr.pincode}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Phone: {addr.phone}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
 
            {/* Step Continue buttons */}
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                id="checkout-continue-btn"
                disabled={isAddingAddress || !selectedAddress || !isStoreOpen}
                onClick={() => {
                  if (!isStoreOpen) {
                    if (onStoreClosedClick) onStoreClosedClick();
                    return;
                  }
                  if (!selectedAddress) return;

                  const lat = selectedAddress.lat;
                  const lng = selectedAddress.lng;
                  const storeLat = deliveryZoneSettings?.storeLat ?? 28.0793575;
                  const storeLng = deliveryZoneSettings?.storeLng ?? 80.4672899;
                  const radiusLimit = deliveryZoneSettings?.deliveryRadius ?? 3.0;

                  let isServiceable = true;
                  if (typeof lat === "number" && typeof lng === "number") {
                    const dist = calculateDistance(lat, lng, storeLat, storeLng);
                    if (dist > radiusLimit) {
                      isServiceable = false;
                    }
                  } else if (selectedAddress.serviceable === false) {
                    isServiceable = false;
                  }

                  if (!isServiceable) {
                    if (onServiceNotAvailable) {
                      onServiceNotAvailable();
                    }
                    return;
                  }

                  setStep(2);
                }}
                className="flex items-center space-x-1.5 rounded-xl bg-gray-900 text-white px-5 py-2.5 font-black text-xs hover:bg-gray-800 transition disabled:bg-gray-150 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Continue to Payment</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PAYMENT TYPE ================= */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Select Payment Method</h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Orders arrive via 15-minute ultra fast instant delivery</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Payment Methods selector column */}
              <div className="md:col-span-2 space-y-2">
                {METHODS.map((method) => {
                  const isUPI = method.isComingSoon;
                  const isSelected = !isUPI && payMethod === method.value;
                  return (
                    <div
                      key={method.value}
                      onClick={() => {
                        if (isUPI) {
                          setPaymentError("UPI payments are currently disabled. Please select Cash on Delivery.");
                          return;
                        }
                        setPayMethod(method.value);
                        setPaymentError("");
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        isUPI 
                          ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200" 
                          : isSelected 
                            ? "border-green-500 bg-green-50/10 shadow-xs" 
                            : "border-gray-150 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${isUPI ? "text-gray-400" : "text-gray-800"}`}>{method.label}</span>
                          {method.isComingSoon && (
                            <span id="upi-coming-soon-badge-list" className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 border border-amber-250 text-amber-600 font-sans tracking-wide">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div
                          className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${
                            isUPI 
                              ? "border-gray-200 bg-gray-100" 
                              : isSelected 
                                ? "border-green-500" 
                                : "border-gray-300"
                          }`}
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-green-500" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-450 leading-normal font-medium mt-0.5">{method.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic inputs based on choice */}
              <div className="bg-gray-50/70 border border-gray-150 rounded-2xl p-3.5 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] font-black text-gray-450 uppercase mb-2 font-sans">Payment Details</h4>

                  {payMethod.startsWith("UPI") ? (
                    <div className="space-y-3">
                      {/* PROFESSIONALLY STYLED COMING SOON BADGE */}
                      <div id="upi-coming-soon-pill" className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100/70 text-amber-700 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider font-sans leading-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Coming Soon
                      </div>

                      {/* DETAILED INFORMATIONAL MESSAGE */}
                      <p className="text-[11px] text-amber-800 font-semibold bg-amber-50/30 border border-amber-100/25 p-2 rounded-lg leading-relaxed">
                        UPI payments will be available soon. Please use Cash on Delivery for now.
                      </p>

                      {/* FUTURE UPI INTEGRATION POINT: 
                          To integrate real UPI payment processing in the future:
                          1. Integrate a payment gateway like Razorpay Standard Checkout or PhonePe SDK.
                          2. Validate user VPA format strictly.
                          3. Submit dynamic UPI intent payload to backend server.ts route.
                      */}
                      <div className="opacity-40 pointer-events-none select-none">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">UPI Address (VPA)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold placeholder-gray-400 outline-hidden"
                          placeholder="disabled"
                          value={upiId}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 leading-normal">
                        Your delivery is fully secure. Pay a sum of <strong>₹{totalAmount}</strong> in cash or scan QR upon doorstep arrival!
                      </p>
                    </div>
                  )}

                  {paymentError && <p className="text-[10px] font-bold text-red-500 mt-2 bg-red-50 p-2 rounded-lg">{paymentError}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-150 flex items-center justify-center space-x-1.5 text-green-700">
                  <ShieldCheck className="h-4.5 w-4.5" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">Secure Payment Node</span>
                </div>
              </div>
            </div>

            {/* Total summary info */}
            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 rounded-2xl border border-gray-150 text-xs">
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Fulfillment Endpoint</p>
                <p className="font-extrabold text-gray-800 capitalize leading-none mt-1">
                  {selectedAddress?.label} Delivery • Instant 15-Min Delivery
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-sm">{selectedAddress?.addressLine}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Grand Total</p>
                <p className="text-base font-black text-gray-900 leading-none mt-1">₹{totalAmount}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                disabled={isProcessing}
                onClick={() => setStep(1)}
                className="flex items-center space-x-1.5 rounded-xl border border-gray-200 px-4 py-2 font-bold text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                disabled={isProcessing || !selectedAddress || payMethod !== "Cash on Delivery (COD)" || !isStoreOpen}
                onClick={() => {
                  if (!isStoreOpen) {
                    if (onStoreClosedClick) onStoreClosedClick();
                    return;
                  }
                  handleTriggerPayment();
                }}
                className="flex items-center space-x-2 rounded-xl bg-green-500 text-white px-6 py-3 font-black text-xs hover:bg-green-600 transition shadow-lg shadow-green-100 disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Securely...</span>
                  </>
                ) : !isStoreOpen ? (
                  <>
                    <span>Store Closed</span>
                  </>
                ) : payMethod.startsWith("UPI") ? (
                  <>
                    <span>UPI Option Disabled (Use COD)</span>
                  </>
                ) : (
                  <>
                    <span>Authorise Payment of ₹{totalAmount}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer-Friendly Order Confirmation Modal */}
      {showCancellationPolicyConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-gray-150 shadow-2xl relative overflow-hidden flex flex-col items-center">
            
            {/* Title */}
            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-1.5 mb-1.5">
              🛒 Confirm Your Order
            </h3>
            
            {/* Intro Message */}
            <p className="text-xs text-gray-500 font-medium text-center">
              Please review your order before placing it.
            </p>

            {/* Warning Section (Cancellation Rule Block) */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 mt-4 text-left w-full">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                  Orders can only be canceled before a delivery rider accepts them. Once a rider accepts the order, it cannot be canceled, modified, or refunded.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-5 flex gap-3 w-full">
              <button
                onClick={() => setShowCancellationPolicyConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
              >
                Back
              </button>
              <button
                disabled={!isStoreOpen}
                onClick={() => {
                  if (!isStoreOpen) {
                    if (onStoreClosedClick) onStoreClosedClick();
                    return;
                  }
                  handleConfirmFinalOrderPlacement();
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-lg shadow-green-150 disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                id="accept-cancellation-policy-btn"
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
