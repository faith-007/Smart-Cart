import React, { useState, useEffect } from "react";
import { Compass, Loader2, MapPin, Check } from "lucide-react";
import { Address } from "../types";

interface LocationOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userPhone: string;
  onAddAddress: (addr: Address | Omit<Address, "id">, setAsDefault?: boolean) => Promise<any> | void;
  savedAddresses?: Address[];
}

export default function LocationOnboardingModal({
  isOpen,
  onClose,
  userName,
  userPhone,
  onAddAddress,
  savedAddresses,
}: LocationOnboardingModalProps) {
  const randomPlaceholderName = React.useMemo(() => {
    const list = [
      "Liam", "Sophia", "Aarav", "Zara", "Vikram", "Emily", "Dev", "Ananya", 
      "Rohan", "Siddharth", "Elena", "Marcus", "Kavya", "Arjun", "Kabir", "Neha"
    ];
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  const [step, setStep] = useState<"permission" | "confirm">("permission");
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states
  const [label, setLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [name, setName] = useState(userName || "");
  const [phone, setPhone] = useState(userPhone || "");
  const [houseFlatNumber, setHouseFlatNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("New Delhi");
  const [stateVal, setStateVal] = useState("Delhi");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Synchronize/Pre-fill saved address if the user already has one saved
  useEffect(() => {
    if (isOpen) {
      if (savedAddresses && savedAddresses.length > 0) {
        const def = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
        setLabel(def.label || "Home");
        setName(def.name || def.fullName || userName || "");
        
        let rawPhone = def.phone || def.phoneNumber || userPhone || "";
        // Clean phone formatting for simplicity
        if (rawPhone.startsWith("+91")) {
          rawPhone = rawPhone.replace("+91", "").trim();
        }
        setPhone(rawPhone);
        
        setHouseFlatNumber(def.houseFlatNumber || def.addressLine.split(",")[0]?.trim() || "");
        setStreet(def.street || def.addressLine.split(",").slice(1).join(",")?.trim() || def.addressLine || "");
        setCity(def.city || "New Delhi");
        setStateVal(def.state || "Delhi");
        setPincode(def.pincode || "");
        setIsDefault(!!def.isDefault);
        setEditingId(def.id || null);
        setStep("confirm"); // Skip geo-onboarding step and load Confirm view automatically
      } else {
        setName(userName || "");
        setPhone(userPhone || "");
        setLabel("Home");
        setHouseFlatNumber("");
        setStreet("");
        setCity("New Delhi");
        setStateVal("Delhi");
        setPincode("");
        setIsDefault(true);
        setEditingId(null);
        setStep("permission");
      }
    }
  }, [isOpen, savedAddresses, userName, userPhone]);

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

        if (!name) setName(userName || "");
        if (!phone) setPhone(userPhone || "");

        // OpenStreetMap Nominatim reverse lookup
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setStreet(data.display_name);
              if (data.address) {
                const fetchedCity = data.address.city || data.address.town || data.address.suburb || data.address.state_district || "New Delhi";
                const fetchedPin = data.address.postcode || "";
                const fetchedState = data.address.state || "Delhi";
                setCity(fetchedCity);
                setStateVal(fetchedState);
                if (fetchedPin) setPincode(fetchedPin);
              }
            } else {
              setStreet(`GPS Zone (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
            }
            setStep("confirm");
          })
          .catch((err) => {
            console.error("[GPS Onboarding] Reverse lookup failed:", err);
            setStreet(`Coordinates (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);
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
        setName(userName || "");
        setPhone(userPhone || "");
        setStreet("");
        setStep("confirm");
      },
      { timeout: 7000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !houseFlatNumber.trim() || !street.trim() || !pincode.trim() || !phone.trim() || !stateVal.trim()) {
      setErrorMsg("Please complete all required fields (*).");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setErrorMsg("Please enter a valid 10-digit phone number.");
      return;
    }

    const cleanedPhone = "+91 " + phone.replace(/\D/g, "").slice(-10);
    const combinedAddressLine = `${houseFlatNumber.trim()}, ${street.trim()}`;

    const updatedAddress: any = {
      label,
      name: name.trim(),
      addressLine: combinedAddressLine,
      city: city.trim(),
      pincode: pincode.trim(),
      phone: cleanedPhone,
      fullName: name.trim(),
      phoneNumber: cleanedPhone,
      houseFlatNumber: houseFlatNumber.trim(),
      street: street.trim(),
      landmark: label,
      state: stateVal.trim(),
      isDefault: isDefault,
    };

    if (editingId) {
      updatedAddress.id = editingId;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await onAddAddress(updatedAddress, isDefault);
      onClose();
    } catch (err: any) {
      console.error("[LocationOnboarding] Failed to save address:", err);
      // Extract clean message if it's a JSON string from handleFirestoreError
      let msg = "Could not save your address. Please verify your internet connection and try again.";
      if (err instanceof Error) {
        msg = err.message;
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            msg = `Firestore Error: ${parsed.error}`;
          }
        } catch (_) {}
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
                  setHouseFlatNumber("");
                  setStreet("");
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
                <label className="text-[10px] font-bold text-gray-450 uppercase">Address Type Label (Landmark)</label>
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    placeholder={`e.g. ${randomPlaceholderName}`}
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
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">House/Flat Number *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    placeholder="e.g. Flat 402, 4th Floor"
                    value={houseFlatNumber}
                    onChange={(e) => setHouseFlatNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Street Row / Sector *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    placeholder="e.g. Cyber City, Sector 24"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">City *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">State *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    value={stateVal}
                    onChange={(e) => setStateVal(e.target.value)}
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-green-500 focus:outline-hidden"
                    placeholder="e.g. 122003"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-2 pt-1 border-t border-gray-50">
                <input
                  type="checkbox"
                  id="onboarding-default-checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer"
                />
                <label htmlFor="onboarding-default-checkbox" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                  Set as Default Address
                </label>
              </div>

              {errorMsg && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">{errorMsg}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-1 py-3 bg-green-500 hover:bg-green-600 active:scale-98 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-green-100 cursor-pointer text-center disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Saving Location...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Address</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
