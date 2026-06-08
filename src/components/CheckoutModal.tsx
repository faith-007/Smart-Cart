import React, { useState } from "react";
import { X, MapPin, ChevronRight, Check, Plus, ArrowLeft, ShieldCheck, Compass, Loader2 } from "lucide-react";
import { Address } from "../types";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses: Address[];
  onAddAddress: (addr: Omit<Address, "id">) => void;
  selectedAddress: Address | null;
  onSelectAddress: (addr: Address) => void;
  totalAmount: number;
  onCompletePayment: (address: Address, payMethod: string) => void;
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
}: CheckoutModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Address Form State
  const [newLabel, setNewLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [newName, setNewName] = useState("");
  const [newAddressLine, setNewAddressLine] = useState("");
  const [newCity, setNewCity] = useState("New Delhi");
  const [newPincode, setNewPincode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);

  // Payment State
  const [payMethod, setPayMethod] = useState("Cash on Delivery (COD)");
  const [upiId, setUpiId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Query OpenStreetMap Nominatim for Reverse Geocoding (Fully client-side, keyless)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setNewAddressLine(data.display_name);
              if (data.address) {
                const cityVal = data.address.city || data.address.town || data.address.suburb || data.address.state_district || "New Delhi";
                const pinVal = data.address.postcode || "";
                setNewCity(cityVal);
                if (pinVal) setNewPincode(pinVal);
              }
            } else {
              setNewAddressLine(`Estimated Location (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
            }
          })
          .catch((err) => {
            console.error("[SmartCart Geolocation] OSM lookup failed, using coordinates:", err);
            setNewAddressLine(`Coordinates (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
          })
          .finally(() => {
            setIsDetecting(false);
          });
      },
      (error) => {
        console.warn("[SmartCart Geolocation] Permission denied or timed out:", error);
        setFormError("Could not retrieve GPS coordinates. Please check location permissions or input manually.");
        setIsDetecting(false);
      },
      { timeout: 8000 }
    );
  };

  const handleAddNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAddressLine.trim() || !newPincode.trim() || !newPhone.trim()) {
      setFormError("All fields marked with * are strictly mandatory.");
      return;
    }
    if (newPhone.trim().length < 10) {
      setFormError("Please provide a valid 10-digit mobile number.");
      return;
    }

    onAddAddress({
      label: newLabel,
      name: newName.trim(),
      addressLine: newAddressLine.trim(),
      city: newCity.trim(),
      pincode: newPincode.trim(),
      phone: "+91 " + newPhone.replace(/\D/g, "").slice(-10),
    });

    // Reset Address Form State
    setIsAddingAddress(false);
    setNewName("");
    setNewAddressLine("");
    setNewPincode("");
    setNewPhone("");
    setFormError("");
  };

  const handleTriggerPayment = () => {
    if (payMethod.startsWith("UPI") && (!upiId.trim() || !upiId.includes("@"))) {
      setPaymentError("Please provide a valid UPI ID (e.g. yourname@upi).");
      return;
    }

    setPaymentError("");
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

                <div className="col-span-full">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Street Address / House Line *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    placeholder="Flat/House No., Building Name, Street Name"
                    value={newAddressLine}
                    onChange={(e) => setNewAddressLine(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">City *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Pincode *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    placeholder="6-digit Area code"
                    maxLength={6}
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                {formError && <p className="col-span-full text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">{formError}</p>}

                <div className="col-span-full flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(false)}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-green-500 text-white font-black text-xs rounded-xl hover:bg-green-600 transition cursor-pointer"
                  >
                    Save Address
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
                      return (
                        <div
                          key={addr.id}
                          onClick={() => onSelectAddress(addr)}
                          className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                            isSelected ? "border-green-500 bg-green-50/10 shadow-sm" : "border-gray-150 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded uppercase">
                              {addr.label}
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-green-600" />}
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
                disabled={isAddingAddress || !selectedAddress}
                onClick={() => setStep(2)}
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
                  const isSelected = payMethod === method.value;
                  return (
                    <div
                      key={method.value}
                      onClick={() => {
                        setPayMethod(method.value);
                        setPaymentError("");
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        isSelected ? "border-green-500 bg-green-50/10 shadow-xs" : "border-gray-150 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-800">{method.label}</span>
                          {method.isComingSoon && (
                            <span id="upi-coming-soon-badge-list" className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 border border-amber-250 text-amber-600 font-sans tracking-wide">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div
                          className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-green-500" : "border-gray-300"
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
                disabled={isProcessing || !selectedAddress || payMethod !== "Cash on Delivery (COD)"}
                onClick={handleTriggerPayment}
                className="flex items-center space-x-2 rounded-xl bg-green-500 text-white px-6 py-3 font-black text-xs hover:bg-green-600 transition shadow-lg shadow-green-100 disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Securely...</span>
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
    </div>
  );
}
