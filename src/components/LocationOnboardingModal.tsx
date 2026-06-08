import React, { useState } from "react";
import { Compass, Loader2, MapPin, Check } from "lucide-react";
import { Address } from "../types";

interface LocationOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userPhone: string;
  onAddAddress: (addr: Omit<Address, "id">) => void;
}

export default function LocationOnboardingModal({
  isOpen,
  onClose,
  userName,
  userPhone,
  onAddAddress,
}: LocationOnboardingModalProps) {
  const [step, setStep] = useState<"permission" | "confirm">("permission");
  const [isDetecting, setIsDetecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states
  const [label, setLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [name, setName] = useState(userName || "");
  const [phone, setPhone] = useState(userPhone || "");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("New Delhi");
  const [pincode, setPincode] = useState("");

  if (!isOpen) return null;

  const handleRequestLocation = () => {
    setIsDetecting(true);
    setErrorMsg("");

    if (!navigator.geolocation) {
      setErrorMsg("Your browser block doesn't support automatic geolocation.");
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Auto prep fill defaults
        if (!name) setName(userName || "");
        if (!phone) setPhone(userPhone || "");

        // OpenStreetMap Nominatim reverse lookup
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setAddressLine(data.display_name);
              if (data.address) {
                const fetchedCity = data.address.city || data.address.town || data.address.suburb || data.address.state_district || "New Delhi";
                const fetchedPin = data.address.postcode || "";
                setCity(fetchedCity);
                if (fetchedPin) setPincode(fetchedPin);
              }
            } else {
              setAddressLine(`GPS Zone (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
            }
            setStep("confirm");
          })
          .catch((err) => {
            console.error("[GPS Onboarding] Reverse lookup failed:", err);
            setAddressLine(`Coordinates (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
            setStep("confirm");
          })
          .finally(() => {
            setIsDetecting(false);
          });
      },
      (error) => {
        console.warn("[GPS Onboarding] Location request errored:", error);
        setErrorMsg("Permission denied or request timed out. Please enter details manually.");
        setIsDetecting(false);
        // Fallback to empty inputs directly so they can complete it anyway
        setName(userName || "");
        setPhone(userPhone || "");
        setAddressLine("");
        setStep("confirm");
      },
      { timeout: 7000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !addressLine.trim() || !pincode.trim() || !phone.trim()) {
      setErrorMsg("Please complete all required fields (*).");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setErrorMsg("Please enter a valid 10-digit phone number.");
      return;
    }

    onAddAddress({
      label,
      name: name.trim(),
      addressLine: addressLine.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      phone: "+91 " + phone.replace(/\D/g, "").slice(-10),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-left">
        
        {/* Step: Trigger Geolocation Permission */}
        {step === "permission" && (
          <div className="text-center py-6 animate-in fade-in duration-200">
            <div className="relative mx-auto h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Compass className="h-8 w-8 text-green-600 animate-pulse" />
              <div className="absolute inset-0 rounded-full border border-green-200 animate-ping opacity-25" />
            </div>

            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Onboarding Delivery Location</h3>
            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
              SmartCart is an instant 15-minute grocery delivery app. We need to detect your current location to dispatch your items ASAP.
            </p>

            {errorMsg && <p className="text-xs font-semibold text-red-500 mt-3 bg-red-50 py-2 px-3 rounded-xl">{errorMsg}</p>}

            <div className="mt-6 flex flex-col space-y-2">
              <button
                onClick={handleRequestLocation}
                disabled={isDetecting}
                className="w-full relative flex items-center justify-center space-x-2 py-3 bg-green-500 hover:bg-green-600 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-green-100 disabled:opacity-50 cursor-pointer"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Retrieving coordinates...</span>
                  </>
                ) : (
                  <>
                    <Compass className="h-4 w-4" />
                    <span>Authorize Location Access</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setName(userName || "");
                  setPhone(userPhone || "");
                  setAddressLine("");
                  setStep("confirm");
                }}
                className="w-full py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition"
              >
                Skip & Enter Manually
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm and Save address details */}
        {step === "confirm" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center space-x-2 pb-3 border-b border-gray-50 mb-4">
              <MapPin className="h-5 w-5 text-green-500" />
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Confirm Delivery Point</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Confirm or adjust details below</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-450 uppercase">Address Type Label</label>
                <div className="flex space-x-2 mt-1">
                  {(["Home", "Work", "Other"] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setLabel(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        label === type
                          ? "bg-green-500 border-green-500 text-white font-semibold"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Contact Recipient Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500"
                    placeholder="e.g. Himanshu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500"
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Fulfillment Address Line / Landmark *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium focus:border-green-500"
                  placeholder="Flat No, Building Name, Society etc."
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">City *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500"
                    placeholder="e.g. 122003"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              {errorMsg && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">{errorMsg}</p>}

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-1 py-3 bg-green-500 hover:bg-green-600 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-green-100 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Save Delivery Coordinate</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
