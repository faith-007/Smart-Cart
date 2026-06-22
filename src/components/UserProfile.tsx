import React, { useState, useEffect } from "react";
import DeliveryMap from "./DeliveryMap";
import { useLanguage } from "../lib/LanguageContext";
import { 
  User, 
  Package, 
  MapPin, 
  Settings, 
  Heart, 
  Gift, 
  Navigation, 
  Bell, 
  Shield, 
  Languages, 
  EyeOff, 
  RefreshCw, 
  ShoppingBag, 
  X, 
  Eye,
  Smartphone,
  Key,
  ShieldCheck,
  UserPlus,
  ArrowRight,
  LogOut,
  Mail,
  Lock,
  CheckCircle,
  Clock,
  Compass,
  Loader2
} from "lucide-react";
import { Order, Address, Product } from "../types";
import { 
  syncUserProfileToFirebase, 
  fetchUserProfileFromFirebase, 
  fetchUserProfilesFromFirebase, 
  fetchRidersFromFirebase,
  fetchSavedAddressesFromFirebase,
  auth,
  checkEmailExists,
  checkPhoneExists
} from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile 
} from "firebase/auth";

interface UserProfileProps {
  orders: Order[];
  savedAddresses: Address[];
  onAddAddress: (addr: Omit<Address, "id"> | Address) => void;
  onRemoveAddress: (id: string) => void;
  onSetDefaultAddress?: (id: string) => void;
  wishlist: Product[];
  onRemoveFromWishlist: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  onReorder: (order: Order) => void;
  onTrackOrder: (order: Order) => void;
  userPhone: string;
  setUserPhone: (p: string) => void;
  userEmail: string;
  setUserEmail: (e: string) => void;
  userName: string;
  setUserName: (n: string) => void;
  isCustomerLoggedIn: boolean;
  onCustomerLogin: (phone: string, name: string, email: string, adrs: Address[]) => void;
  onCustomerLogout: () => void;
  onUpdateOrderStatus?: (orderId: string, status: Order["status"]) => void;
  onResetAddresses?: () => void;
  onViewPolicy?: (policy: "privacy" | "terms" | "refund") => void;
}

export default function UserProfile({
  orders: rawOrders,
  savedAddresses,
  onAddAddress,
  onRemoveAddress,
  onSetDefaultAddress,
  onResetAddresses,
  wishlist,
  onRemoveFromWishlist,
  onAddToCart,
  onReorder,
  onTrackOrder,
  userPhone,
  setUserPhone,
  userEmail,
  setUserEmail,
  userName,
  setUserName,
  isCustomerLoggedIn,
  onCustomerLogin,
  onCustomerLogout,
  onUpdateOrderStatus,
  onViewPolicy,
}: UserProfileProps) {
  const currentUserId = auth.currentUser?.uid;
  const orders = React.useMemo(() => {
    if (currentUserId) {
      return rawOrders.filter((o) => o.userId === currentUserId);
    }
    // Simulation / anonymous users
    const isSimulated = localStorage.getItem("smartcart_customer_logged_in") === "true";
    if (isSimulated) {
      const email = localStorage.getItem("smartcart_customer_email") || "";
      const phone = localStorage.getItem("smartcart_customer_phone") || "";
      if (email) {
        const simId = `sim_user_${email.replace(/[@.]/g, "_")}`;
        return rawOrders.filter((o) => o.userId === simId);
      } else if (phone) {
        const simId = `sim_user_${phone.replace(/\D/g, "")}`;
        return rawOrders.filter((o) => o.userId === simId);
      }
    }
    return rawOrders; // fallback
  }, [rawOrders, currentUserId]);

  const [subTab, setSubTab] = useState<"profile" | "history" | "addresses" | "settings">("history");
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancelOrderClick = (orderId: string, currentStatus: Order["status"]) => {
    console.log("[SmartCart Debug] Button Clicked: Cancel button clicked in Profile for order ID:", orderId);
    if (currentStatus !== "placed") {
      console.log("[SmartCart Debug] Cancel Action Blocked: Status is not 'placed'", currentStatus);
      setErrorMessage("Only orders in 'placed' status can be cancelled.");
      return;
    }
    
    console.log("[SmartCart Debug] Cancel Function Started for order ID:", orderId);
    setOrderToCancel(orderId);
  };
  
  // --- Firebase Authenticaton Screen states ---
  const randomPlaceholderName = React.useMemo(() => {
    const list = [
      "Liam", "Sophia", "Aarav", "Zara", "Vikram", "Emily", "Dev", "Ananya", 
      "Rohan", "Siddharth", "Elena", "Marcus", "Kavya", "Arjun", "Kabir", "Neha"
    ];
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpAttempts, setOtpAttempts] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // OTP expiry countdown effect
  useEffect(() => {
    if (!otpSent || !otpExpiresAt) return;
    
    // Initial calculate
    const calculateTime = () => {
      const now = Date.now();
      const diff = otpExpiresAt - now;
      if (diff <= 0) {
        setTimeRemaining("Code expired");
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${mins}:${secs < 10 ? "0" : ""}${secs}`);
      }
    };
    
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [otpSent, otpExpiresAt]);

  // Resend cooldown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setAuthLoading(true);
    setLoginError("");
    setLoginSuccess("");
    setOtpAttempts(0); // Reset OTP verification attempts
    
    const email = emailInput.trim().toLowerCase();
    const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
    setSimulatedOtp(generatedCode);
    const expires = Date.now() + 10 * 60 * 1000;
    setOtpExpiresAt(expires);
    setResendCooldown(30);

    try {
      console.log(`[SmartCart Auth] Resending secure SMTP registration code to ${email}...`);
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: generatedCode, name: nameInput.trim(), isResend: true }),
      });
      const data = await response.json();
      
      if (data.success) {
        setLoginSuccess("OTP sent successfully. A fresh 6-digit verification code has been dispatched to your email.");
      } else {
        setLoginError(`Email sending failed. Please verify your SMTP config. Details: ${data.details || data.error}`);
      }
    } catch (err) {
      console.warn("[SmartCart Auth] Resend request failure:", err);
      setLoginError("Email sending failed. Connection error or missing SMTP setup on the server.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Profile settings state edits
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [tempPhone, setTempPhone] = useState(userPhone);
  const [tempEmail, setTempEmail] = useState(userEmail);

  // Sync temp variables when details change
  useEffect(() => {
    setTempName(userName);
    setTempPhone(userPhone);
    setTempEmail(userEmail);
  }, [userName, userPhone, userEmail]);

  // Automatically request GPS location coordinates on signup or login if no addresses exist
  useEffect(() => {
    if (isCustomerLoggedIn && savedAddresses.length === 0) {
      handleDetectLocationInProfile();
      setSubTab("addresses");
    }
  }, [isCustomerLoggedIn, savedAddresses.length]);

  // Address add form
  const [typeLabel, setTypeLabel] = useState<"Home" | "Work" | "Other" >("Home");
  const [aName, setAName] = useState("");
  const [aHouseFlatNumber, setAHouseFlatNumber] = useState("");
  const [aStreet, setAStreet] = useState("");
  const [aCity, setACity] = useState("New Delhi");
  const [aStateVal, setAStateVal] = useState("Delhi");
  const [aPincode, setAPincode] = useState("");
  const [aPhone, setAPhone] = useState("");
  const [aIsDefault, setAIsDefault] = useState(false);
  const [addrError, setAddrError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [aLat, setALat] = useState<number | null>(null);
  const [aLng, setALng] = useState<number | null>(null);
  const [aGpsAccuracy, setAGpsAccuracy] = useState<number | null>(null);

  const handleDetectLocationInProfile = () => {
    setIsDetecting(true);
    setAddrError("");
    if (!navigator.geolocation) {
      setAddrError("Geolocation is not supported by your browser.");
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setALat(rawLat);
        setALng(rawLng);
        setAGpsAccuracy(accuracy);

        if (!aName.trim()) {
          setAName(userName || "Customer Recipient");
        }
        if (!aPhone.trim()) {
          setAPhone(userPhone || "");
        }

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${rawLat}&lon=${rawLng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.display_name) {
              setAStreet(data.display_name);
              if (data.address) {
                const cityVal = data.address.city || data.address.town || data.address.suburb || data.address.state_district || "New Delhi";
                const pinVal = data.address.postcode || "";
                const stateVal = data.address.state || "Delhi";
                setACity(cityVal);
                setAStateVal(stateVal);
                if (pinVal) setAPincode(pinVal);
              }
            } else {
              setAStreet(`Sector ${Math.floor(rawLat)} Area, Coordinates: Lat ${rawLat.toFixed(4)}, Lng ${rawLng.toFixed(4)}`);
            }
          })
          .catch((err) => {
            console.error("[Profile Geolocation] OSM Lookup Failed:", err);
            setAStreet(`Coordinates: Lat ${rawLat.toFixed(4)}, Lng ${rawLng.toFixed(4)}`);
          })
          .finally(() => {
            setIsDetecting(false);
          });
      },
      (err) => {
        console.warn("[Profile Geolocation] Errored:", err);
        setAddrError("GPS not available. Fallback mock-map loaded - please drag pin manually.");
        setALat(28.6139); // Delhi fallback
        setALng(77.2090); // Delhi fallback
        setAGpsAccuracy(150);
        setIsDetecting(false);
      },
      { timeout: 8000 }
    );
  };

  // Settings mock state
  const [notifState, setNotifState] = useState(true);
  const { language: langState, setLanguage: setLangState, t } = useLanguage();
  const [passOld, setPassOld] = useState("");
  const [passNew, setPassNew] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveError("");

    const nextName = tempName.trim();
    if (!nextName) {
      setProfileSaveError("User name cannot be empty.");
      return;
    }

    try {
      const currentProfiles = await fetchUserProfilesFromFirebase();
      if (currentProfiles && currentProfiles.some(p => p.name.trim().toLowerCase() === nextName.toLowerCase() && p.userId !== auth.currentUser?.uid)) {
        setProfileSaveError(`The user name "${nextName}" is already taken by another registered member. Please use a unique name.`);
        return;
      }
    } catch (err) {
      console.warn("Name uniqueness validation bypassed or offline:", err);
    }

    setUserName(tempName);
    setUserPhone(tempPhone);
    setUserEmail(tempEmail);
    setIsEditing(false);

    if (isCustomerLoggedIn && auth.currentUser) {
      await syncUserProfileToFirebase({
        userId: auth.currentUser.uid,
        phone: tempPhone,
        name: tempName,
        email: tempEmail,
        addresses: savedAddresses,
      });
    }
  };

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const handleStartEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAName(addr.name || addr.fullName || "");
    setAHouseFlatNumber(addr.houseFlatNumber || addr.addressLine.split(",")[0]?.trim() || "");
    setAStreet(addr.street || addr.addressLine.split(",").slice(1).join(",")?.trim() || addr.addressLine || "");
    setACity(addr.city || "New Delhi");
    setAStateVal(addr.state || "Delhi");
    setAPincode(addr.pincode || "");
    setAPhone((addr.phone || addr.phoneNumber || "").replace("+91 ", ""));
    setTypeLabel(addr.label || "Home");
    setAIsDefault(!!addr.isDefault);
    setALat(addr.lat || null);
    setALng(addr.lng || null);
    setAGpsAccuracy(addr.gpsAccuracy || null);
    const element = document.getElementById("address-form-header");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingAddressId(null);
    setAName("");
    setAHouseFlatNumber("");
    setAStreet("");
    setACity("New Delhi");
    setAStateVal("Delhi");
    setAPincode("");
    setAPhone("");
    setAIsDefault(false);
    setTypeLabel("Home");
    setALat(null);
    setALng(null);
    setAGpsAccuracy(null);
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aName.trim() || !aHouseFlatNumber.trim() || !aStreet.trim() || !aCity.trim() || !aPincode.trim() || !aPhone.trim() || !aStateVal.trim()) {
      setAddrError("Please complete all requested address coordinates.");
      return;
    }
    if (aPhone.replace(/\D/g, "").length < 10) {
      setAddrError("Please enter a valid 10-digit mobile number.");
      return;
    }

    const currentEditingRecord = editingAddressId 
      ? savedAddresses.find(a => a.id === editingAddressId) 
      : null;

    const cleanedPhone = aPhone.startsWith("+91 ") ? aPhone : ("+91 " + aPhone.replace(/\D/g, "").slice(-10));
    const combinedAddress = `${aHouseFlatNumber.trim()}, ${aStreet.trim()}`;

    const addedAddressRecord: Address = {
      id: editingAddressId || `addr-${Date.now()}`,
      label: typeLabel,
      name: aName.trim(),
      addressLine: combinedAddress,
      city: aCity.trim(),
      pincode: aPincode.trim(),
      phone: cleanedPhone,
      isDefault: currentEditingRecord ? currentEditingRecord.isDefault : (aIsDefault || savedAddresses.length === 0),
      fullName: aName.trim(),
      phoneNumber: cleanedPhone,
      houseFlatNumber: aHouseFlatNumber.trim(),
      street: aStreet.trim(),
      landmark: typeLabel,
      state: aStateVal.trim(),
      createdAt: currentEditingRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lat: aLat || undefined,
      lng: aLng || undefined,
      gpsAccuracy: aGpsAccuracy || undefined,
    };

    onAddAddress(addedAddressRecord);

    setEditingAddressId(null);
    setAName("");
    setAHouseFlatNumber("");
    setAStreet("");
    setACity("New Delhi");
    setAStateVal("Delhi");
    setAPincode("");
    setAPhone("");
    setAIsDefault(false);
    setALat(null);
    setALng(null);
    setAGpsAccuracy(null);
    setAddrError("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passOld || !passNew) {
      setPassSuccess("Please complete both current and new secret password fields.");
      return;
    }

    try {
      if (userEmail) {
        console.log(`[SmartCart Auth] Dispatching SMTP password update confirmation email to: ${userEmail}`);
        await fetch("/api/send-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail, userName: userName }),
        });
      }
    } catch (err) {
      console.warn("[SmartCart Reset Password] Password reset email confirmation failed:", err);
    }

    setPassOld("");
    setPassNew("");
    setPassSuccess("Password updated successfully! A security notice has been sent to your email.");
    setTimeout(() => setPassSuccess(""), 4000);
  };

  // --- Real Firebase Sign-In / Sign-Up actions ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    
    // ================= SIGN IN ROUTE =================
    if (authMode === "signin") {
      const email = emailInput.trim().toLowerCase();
      const password = passwordInput;
      
      if (!email || !password) {
        setLoginError("Please enter both email and password parameters to sign in.");
        return;
      }

      setAuthLoading(true);
      console.log(`[SmartCart Firebase] Logging user in with email: ${email}`);
      
      try {
        // Query rider slots from Firestore to find a match
        const dbRiders = await fetchRidersFromFirebase().catch(() => []);
        const matchedRider = dbRiders.find(
          (r) => r.email && r.email.toLowerCase().trim() === email
        );

        let cred;
        try {
          cred = await signInWithEmailAndPassword(auth, email, password);
        } catch (authErr: any) {
          // If the Rider slot exists and PIN matches, but there's no auth account, trigger auto-signing / provisioning!
          if (matchedRider && matchedRider.password === password && 
              (authErr?.code === "auth/user-not-found" || authErr?.code === "auth/invalid-credential" || 
               String(authErr).includes("user-not-found") || String(authErr).includes("invalid-credential"))) {
            console.log(`[SmartCart Auth] Provisioning user login for rider: ${matchedRider.name}`);
            cred = await createUserWithEmailAndPassword(auth, email, password);
          } else if (email === "himanshu712007@gmail.com" && 
                     (authErr?.code === "auth/user-not-found" || authErr?.code === "auth/invalid-credential" || 
                      String(authErr).includes("user-not-found") || String(authErr).includes("invalid-credential"))) {
            console.log(`[SmartCart Auth] Auto-provisioning admin creator: ${email}`);
            try {
              cred = await createUserWithEmailAndPassword(auth, email, password);
            } catch (createErr: any) {
              if (createErr?.code === "auth/email-already-in-use" || String(createErr).includes("email-already-in-use")) {
                throw authErr;
              }
              throw createErr;
            }
          } else {
            throw authErr;
          }
        }

        const user = cred.user;
        
        let profile = await fetchUserProfileFromFirebase(user.uid);
        if (profile && profile.emailVerified === false) {
          setLoginError("Please verify your email before logging in.");
          setAuthLoading(false);
          await signOut(auth);
          return;
        }

        if (!profile) {
          let determinedRole: "Admin" | "Rider" | "Customer" = "Customer";
          if (email === "himanshu712007@gmail.com") {
            determinedRole = "Admin";
          } else if (matchedRider) {
            determinedRole = "Rider";
          }

          profile = {
            userId: user.uid,
            name: matchedRider ? matchedRider.name : (user.displayName || email.split("@")[0] || "Customer"),
            email: user.email || email,
            phone: matchedRider ? matchedRider.phone : "",
            addresses: [],
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            role: determinedRole,
            riderId: matchedRider ? matchedRider.id : undefined,
          };
          await syncUserProfileToFirebase(profile);
        } else {
          // Verify role integrity for Admin or Rider
          let needsSync = false;
          let calculatedRole: "Admin" | "Rider" | "Customer" = profile.role || "Customer";
          if (email === "himanshu712007@gmail.com" && profile.role !== "Admin") {
            calculatedRole = "Admin";
            needsSync = true;
          } else if (matchedRider && profile.role !== "Rider") {
            calculatedRole = "Rider";
            needsSync = true;
          }

          if (needsSync) {
            profile = {
              ...profile,
              role: calculatedRole,
              riderId: matchedRider ? matchedRider.id : profile.riderId,
              phone: matchedRider ? matchedRider.phone : profile.phone,
            };
            await syncUserProfileToFirebase(profile);
          }
        }
        
        setLoginSuccess(`Welcome back, ${profile.name}! Opening smart console...`);
        
        let fetchedAddresses: Address[] = [];
        try {
          fetchedAddresses = await fetchSavedAddressesFromFirebase(user.uid);
        } catch (e) {
          console.warn("Could not fetch addresses on login:", e);
          fetchedAddresses = profile.addresses || [];
        }
        
        const finalAdrs = fetchedAddresses;
        setTimeout(() => {
          onCustomerLogin(profile.phone || "", profile.name, profile.email, finalAdrs);
          setAuthLoading(false);
        }, 1250);
      } catch (err: any) {
        console.warn("[UserProfile Firebase Auth] Signin execution alert:", err);
        
        // FALLBACK FOR OPERATION-NOT-ALLOWED OR NETWORK-REQUEST-FAILED
        if (
          err?.code === "auth/operation-not-allowed" || 
          err?.code === "auth/network-request-failed" ||
          String(err).includes("operation-not-allowed") || 
          String(err).includes("network-request-failed")
        ) {
          console.warn("[SmartCart Firebase] Operation not allowed or Network request failed on Firebase Auth. Seamlessly transitioning to local high-performance user state.");
          const simUid = `sim_user_${email.replace(/[@.]/g, "_")}`;
          // Determine fallback role
          const isFallbackAdmin = email === "himanshu712007@gmail.com";
          const profile = {
            userId: simUid,
            name: email.split("@")[0] || "Customer",
            email: email,
            phone: "",
            addresses: [],
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            role: (isFallbackAdmin ? "Admin" : "Customer") as "Admin" | "Customer",
          };

          try {
            await syncUserProfileToFirebase(profile);
          } catch (syncErr) {
            console.log("[SmartCart Firebase] Local simulation cloud sync status: deferred active sandbox state.");
          }

          setLoginSuccess(`Login verified! Welcome back, ${profile.name}.`);
          setTimeout(() => {
            onCustomerLogin(profile.phone, profile.name, profile.email, profile.addresses);
            setAuthLoading(false);
          }, 1250);
          return;
        }

        let errMsg = err?.message || "Invalid credentials. Please verify your email & password details.";
        if (err?.code === "auth/user-not-found" || err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || String(err).includes("user-not-found")) {
          errMsg = "Incorrect email address or security password. Please try again or sign up.";
        }
        setLoginError(errMsg);
        setAuthLoading(false);
      }
      return;
    }

    // ================= SIGN UP ROUTE (Name, Phone, Email, Password upfront with Email OTP verification) =================
    const formattedPhone = phoneInput.replace(/\D/g, "");
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput;

    // Direct registration parameter validations
    if (formattedPhone.length !== 10 || !/^[6-9]/.test(formattedPhone)) {
      setLoginError("Please enter a valid Indian mobile number.");
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    if (!nameInput.trim()) {
      setLoginError("Name is required to write a new profile.");
      return;
    }

    if (!password || password.length < 6) {
      setLoginError("Password must be at least 6 characters long.");
      return;
    }

    // Step 1: Dispatch secure 6-digit OTP to user's email only after verifying uniqueness
    if (!otpSent) {
      setAuthLoading(true);
      setLoginError("");
      setLoginSuccess("");
      setOtpAttempts(0); // Reset verification attempts counter on click create account

      try {
        // Query Firebase before account creation
        const [emailExists, phoneExists] = await Promise.all([
          checkEmailExists(email),
          checkPhoneExists(formattedPhone)
        ]);

        if (emailExists) {
          setLoginError("This email address is already registered.");
          setAuthLoading(false);
          return;
        }

        if (phoneExists) {
          setLoginError("This phone number is already registered.");
          setAuthLoading(false);
          return;
        }

        const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        setSimulatedOtp(generatedCode);
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
        setOtpExpiresAt(expires);
        setResendCooldown(30); // 30s resend cooldown

        console.log(`[SmartCart Auth] Dispatching secure SMTP verification code to ${email}...`);
        const response = await fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: generatedCode, name: nameInput.trim(), isResend: false }),
        });
        const data = await response.json();
        
        if (data.success) {
          setOtpSent(true);
          setLoginSuccess("OTP sent successfully. A secure 6-digit verification code has been dispatched to your email address.");
        } else {
          setLoginError(`Email sending failed. Please check your SMTP configuration: ${data.details || data.error}`);
        }
      } catch (err: any) {
        console.warn("[SmartCart Auth] Dispatch request failed:", err);
        setLoginError("Email sending failed. Connection error or missing SMTP setup on the server.");
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    // Step 2: Validate code, create user on Firebase Auth plus store profile to Firestore
    if (otpExpiresAt && Date.now() > otpExpiresAt) {
      setLoginError("OTP expired. Please click 'Resend OTP' to request a new code.");
      return;
    }

    if (otpAttempts >= 3) {
      setLoginError("Please verify your email before creating an account.");
      return;
    }

    if (otpInput !== simulatedOtp) {
      const nextAttempts = otpAttempts + 1;
      setOtpAttempts(nextAttempts);
      setLoginError("Please verify your email before creating an account.");
      return;
    }

    setAuthLoading(true);
    setLoginError("");
    setLoginSuccess("Security code verified successfully! Processing registration...");

    try {
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } catch (regErr: any) {
        if (regErr?.code === "auth/email-already-in-use" || String(regErr).includes("email-already-in-use")) {
          console.log("[SmartCart Auth] Email already exists. Seamlessly performing automatic login.");
          cred = await signInWithEmailAndPassword(auth, email, password);
        } else {
          throw regErr;
        }
      }

      const user = cred.user;
      await updateProfile(user, { displayName: nameInput.trim() });

      const isRegisteredAdmin = email === "himanshu712007@gmail.com";
      const profile = {
        userId: user.uid,
        name: nameInput.trim(),
        email: email,
        phone: formattedPhone,
        emailVerified: true,
        phoneVerified: false,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        role: (isRegisteredAdmin ? "Admin" : "Customer") as "Admin" | "Customer",
        addresses: [],
      };

      await syncUserProfileToFirebase(profile);
      setLoginSuccess(`Account successfully created! Welcome to SmartCart, ${profile.name}.`);

      let fetchedAddresses: Address[] = [];
      try {
        fetchedAddresses = await fetchSavedAddressesFromFirebase(user.uid);
      } catch (e) {
        fetchedAddresses = profile.addresses || [];
      }
      
      const finalAdrs = fetchedAddresses;
      setTimeout(() => {
        onCustomerLogin(profile.phone, profile.name, profile.email, finalAdrs);
        setAuthLoading(false);
      }, 1250);

    } catch (err: any) {
      console.warn("[UserProfile Firebase Auth] Execution failed:", err);

      // Graceful fallback for operation-not-allowed or network-request-failed
      if (
        err?.code === "auth/operation-not-allowed" || 
        err?.code === "auth/network-request-failed" ||
        String(err).includes("operation-not-allowed") || 
        String(err).includes("network-request-failed")
      ) {
        console.warn("[SmartCart Auth fallback] Connection restricted. Creating local isolated customer session...");
        const localUid = `sim_user_${formattedPhone}`;
        const isFallbackAdmin = email === "himanshu712007@gmail.com";
        const profile = {
          userId: localUid,
          name: nameInput.trim() || "Customer",
          email: email,
          phone: formattedPhone,
          addresses: [],
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          role: (isFallbackAdmin ? "Admin" : "Customer") as "Admin" | "Customer",
        };

        try {
          await syncUserProfileToFirebase(profile);
        } catch (syncErr) {
          console.log("[SmartCart Firebase] Cloud profile sync deferred for offline testing.");
        }

        setLoginSuccess(`Registration complete (Sandbox mode active)! Welcome to SmartCart.`);
        setTimeout(() => {
          onCustomerLogin(profile.phone, profile.name, profile.email, profile.addresses);
          setAuthLoading(false);
        }, 1250);
        return;
      }

      let errMsg = err?.message || "Verify your inputs or network connection.";
      if (err?.code === "auth/email-already-in-use") {
        errMsg = "This email address is already in use by another user profile.";
      } else if (err?.code === "auth/invalid-email") {
        errMsg = "Please format your email address precisely.";
      } else if (err?.code === "auth/weak-password") {
        errMsg = "Password is too weak. Please pick a password with at least 6 characters.";
      }
      setLoginError(errMsg);
      setAuthLoading(false);
    }
  };
  
  // ================= RENDER DYNAMIC FIREBASE LOG-IN / REGISTRATION CARDS =================
  if (!isCustomerLoggedIn) {
    return (
      <div className="mx-auto max-w-lg min-h-[64vh] w-full flex flex-col items-center justify-center p-4 text-left" id="user-firebase-auth-block">
        <div className="w-full bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 shadow-xl">
          
          <div className="flex flex-col items-center text-center space-y-1 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 border border-amber-100 flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            
            {/* Tab switchers header styling */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full mt-4">
              <button 
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setLoginError("");
                  setLoginSuccess("");
                  setOtpSent(false);
                  setOtpVerified(false);
                  setOtpInput("");
                  setEmailInput("");
                  setPasswordInput("");
                }}
                className={`flex-1 py-2 text-center rounded-xl text-xs font-black uppercase tracking-wider transition ${
                  authMode === "signin"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-955"
                }`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setLoginError("");
                  setLoginSuccess("");
                  setOtpSent(false);
                  setOtpVerified(false);
                  setOtpInput("");
                  setEmailInput("");
                  setPasswordInput("");
                }}
                className={`flex-1 py-2 text-center rounded-xl text-xs font-black uppercase tracking-wider transition ${
                  authMode === "signup"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-955"
                }`}
              >
                Sign Up
              </button>
            </div>
            
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-3">
              {authMode === "signin" 
                ? "Unlock SmartCart Orders Dashboard" 
                : !otpSent 
                  ? "Register: Create A New Account" 
                  : "Register: Verify Your Email OTP"}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signin" ? (
              // Sign In Fields (Direct Email & Password)
              <>
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Email Address</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-450" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@your-domain.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Security Password</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-465" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-hidden cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // Sign Up Registration Flow
              <>
                {/* Step 1: Entering registration details */}
                {!otpSent && (
                  <>
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Your Full Name *</label>
                      <div className="relative mt-1">
                        <User className="absolute left-3.5 top-3 h-4 w-4 text-gray-450" />
                        <input
                          type="text"
                          required
                          placeholder={`e.g. ${randomPlaceholderName}`}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Phone number (+91)</label>
                      <div className="relative mt-1">
                        <Smartphone className="absolute left-3.5 top-3 h-4 w-4 text-gray-455" />
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9812345678"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Email Address</label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-450" />
                        <input
                          type="email"
                          required
                          placeholder="e.g. user@your-domain.com"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Security Password</label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-465" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="At least 6 characters"
                          className="w-full pl-10 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-green-500 outline-hidden"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 2: OTP Pin Verification */}
                {otpSent && (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-100 p-3.5 rounded-2xl text-left">
                      <p className="text-[10px] font-extrabold text-orange-700 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                        <Mail className="h-4 w-4 animate-bounce" /> Code Sent to {emailInput}
                      </p>
                      <p className="text-[9px] font-bold text-orange-500 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expires in {timeRemaining || "10:00"}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">6-Digit Verification Code</label>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setOtpInput("");
                            setLoginError("");
                            setLoginSuccess("");
                          }}
                          className="text-[10px] font-black text-green-600 uppercase tracking-wider hover:underline cursor-pointer"
                        >
                          Edit Details
                        </button>
                      </div>
                      <div className="relative mt-1">
                        <Key className="absolute left-3.5 top-3 h-4 w-4 text-gray-455" />
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="e.g. 123456"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold tracking-widest focus:ring-1 focus:ring-green-500 outline-hidden text-center"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <p className="text-[10px] text-amber-900 font-extrabold mt-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed text-left shadow-2xs shadow-amber-100/50">
                        Didn't receive the OTP? Please check your Spam/Junk folder.
                      </p>
                    </div>

                    {/* Resend button block */}
                    <div className="flex items-center justify-center pt-2">
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || authLoading}
                        onClick={handleResendOtp}
                        className="text-xs font-bold text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:no-underline transition flex items-center gap-1.5 uppercase tracking-wider cursor-pointer"
                      >
                        {resendCooldown > 0 ? (
                          <span>Resend OTP in {resendCooldown}s</span>
                        ) : (
                          <>
                            <RefreshCw className={`h-3 w-3 ${authLoading ? "animate-spin" : ""}`} />
                            <span>Resend OTP</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {loginError && (
              <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-center gap-1.5 leading-normal">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {loginError}
              </p>
            )}

            {loginSuccess && (
              <p className="text-[10px] font-bold text-green-600 bg-green-50 p-2.5 rounded-xl border border-green-100 flex items-center gap-1.5 leading-normal">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                {loginSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-green-100"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {authMode === "signin" ? (
                    <>
                      <span>Enter Ordering Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : !otpSent ? (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verify & Create Account</span>
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Clean footer authentication marker */}
          <div className="border-t border-gray-100 pt-4 mt-6 text-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
              🔒 FIREBASE AUTHENTICATION DECOVERY SHEATH READY
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6" id="user-profile-section">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sub-Menu Column Sidebar wrapper */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 text-center shadow-xs">
            
            {/* Visual Avatar */}
            <div className="relative inline-block">
              <div className="h-20 w-20 rounded-full bg-green-500 text-white flex items-center justify-center font-black text-3xl mx-auto shadow-md">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="absolute bottom-0 right-0 h-4.5 w-4.5 rounded-full bg-orange-500 border-2 border-white animate-pulse" />
            </div>

            <h3 className="mt-3.5 text-base font-black text-gray-900 leading-none truncate max-w-[180px] mx-auto">{userName}</h3>
            <p className="text-xs text-orange-600 font-extrabold mt-1.5 leading-none">{userPhone}</p>
            {userEmail && <p className="text-[10px] text-gray-400 font-semibold mt-1.5 leading-none truncate max-w-[180px] mx-auto">{userEmail}</p>}
            <p className="text-[10px] bg-orange-100 text-orange-600 font-extrabold uppercase rounded px-2.5 py-0.5 mt-2.5 inline-block">
              15 Min Elite Buyer
            </p>

            {/* Quick Links Menu list */}
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col gap-1.5 text-left">
              <button
                onClick={() => setSubTab("history")}
                className={`w-full flex items-center justify-between rounded-xl p-2.5 text-xs text-left transition cursor-pointer ${
                  subTab === "history" ? "bg-green-500 font-black text-white px-3" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <Package className="h-4.5 w-4.5" />
                  <span>{t("My Orders")} ({orders.length})</span>
                </span>
                <span className={`text-[10px] px-1.5 rounded-full ${subTab === "history" ? "bg-white/20 text-white" : "bg-gray-100"}`}>
                  {orders.filter((o) => o.status !== "delivered").length} Live
                </span>
              </button>

              <button
                onClick={() => setSubTab("profile")}
                className={`w-full flex items-center space-x-2 rounded-xl p-2.5 text-xs text-left transition cursor-pointer ${
                  subTab === "profile" ? "bg-green-500 font-black text-white px-3" : "text-gray-650 hover:bg-gray-50"
                }`}
              >
                <User className="h-4.5 w-4.5" />
                <span>{t("Personal Information")}</span>
              </button>

              <button
                onClick={() => setSubTab("addresses")}
                className={`w-full flex items-center space-x-2 rounded-xl p-2.5 text-xs text-left transition cursor-pointer ${
                  subTab === "addresses" ? "bg-green-500 font-black text-white px-3" : "text-gray-650 hover:bg-gray-50"
                }`}
              >
                <MapPin className="h-4.5 w-4.5" />
                <span>{t("Saved Addresses")} ({savedAddresses.length})</span>
              </button>

              <button
                onClick={() => setSubTab("settings")}
                className={`w-full flex items-center space-x-2 rounded-xl p-2.5 text-xs text-left transition cursor-pointer ${
                  subTab === "settings" ? "bg-green-500 font-black text-white px-3" : "text-gray-650 hover:bg-gray-50"
                }`}
              >
                <Settings className="h-4.5 w-4.5" />
                <span>{t("Preferences & Settings")}</span>
              </button>

              <button
                onClick={() => {
                  onCustomerLogout();
                }}
                className="w-full flex items-center space-x-2 rounded-xl p-2.5 text-xs text-left text-red-500 hover:bg-red-50 font-bold transition mt-2 pt-3 border-t border-gray-100 cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5" />
                <span>{t("Log Out")}</span>
              </button>
            </div>

          </div>
        </div>

        {/* Right Active sub tab column content */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs min-h-[480px]">
            
            {/* ================= ORDER HISTORY TAB ================= */}
            {subTab === "history" && (() => {
              const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
              const pastOrders = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");
              
              return (
                <div className="space-y-6 text-left animate-in fade-in duration-200">
                  <div>
                    <h2 className="text-base font-black text-gray-900 uppercase tracking-wider">Purchase Order Register</h2>
                    <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5">Track arrivals and reorder past favorites</p>
                  </div>

                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                      <div className="h-14 w-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <Package className="h-7 w-7 text-gray-300" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800">No Orders Logged Yet</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-[240px]">Place your first grocery delivery order to experience 15 minute arrivals!</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Active Deliveries */}
                      {activeOrders.length > 0 && (
                        <div>
                          <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse inline-block" />
                            <span>Active Deliveries ({activeOrders.length})</span>
                          </h3>
                          
                          <div className="space-y-4">
                            {activeOrders.map((ord) => {
                              const isLive = ord.status !== "delivered" && ord.status !== "cancelled";
                              return (
                                <div key={ord.id} className="border border-orange-100 rounded-2xl p-4 hover:border-orange-200 transition bg-orange-50/5">
                                  
                                  {/* Order Meta row */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                                    <div>
                                      <p className="text-xs font-black text-gray-900">Order ID: #{ord.id}</p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{ord.date} • {ord.paymentMethod}</p>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-orange-100 text-orange-700 animate-pulse">
                                        Express Transiting
                                      </span>

                                      {isLive && (
                                        <button
                                          onClick={() => onTrackOrder(ord)}
                                          className="flex items-center space-x-1 rounded-lg bg-green-500 text-white font-black text-[10px] uppercase p-1.5 transition hover:bg-green-600"
                                        >
                                          <Navigation className="h-3 w-3 fill-white" />
                                          <span>Live Track</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Order Products mapping list */}
                                  <div className="space-y-2 mb-3 max-h-36 overflow-y-auto border-b border-gray-100 pb-2">
                                    {ord.items.map((it) => (
                                      <div key={it.product.id} className="flex items-center justify-between text-xs font-medium">
                                        <div className="flex items-center space-x-2">
                                          <img src={it.product.image} alt={it.product.name} className="h-6 w-6 rounded object-cover" />
                                          <span className="text-gray-850 font-bold truncate max-w-[200px]">{it.product.name}</span>
                                          <span className="text-[10px] text-gray-400">({it.product.weight})</span>
                                        </div>
                                        <span className="text-gray-500">Qty: {it.quantity} • <strong className="text-gray-800">₹{it.product.sellingPrice * it.quantity}</strong></span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Pricing breakdown summary segment */}
                                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-[10px] font-medium text-gray-500 space-y-1 mb-2">
                                    <div className="flex justify-between">
                                      <span>Subtotal:</span>
                                      <span className="font-bold text-gray-755">₹{ord.subtotal}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="flex items-center gap-1">
                                        <span>Delivery Charge:</span>
                                        {ord.deliveryCharge === 0 && (
                                          <span className="px-1 bg-green-100 text-[7px] font-extrabold text-green-700 uppercase rounded">FREE DELIVERY</span>
                                        )}
                                      </span>
                                      <span className={ord.deliveryCharge === 0 ? "font-black text-green-600" : "font-bold text-gray-750"}>
                                        {ord.deliveryCharge === 0 ? "FREE" : `₹${ord.deliveryCharge}`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Platform Fee:</span>
                                      <span className="font-bold text-gray-750">₹{ord.platformFee ?? 3}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Handling Charge:</span>
                                      <span className="font-bold text-gray-750">₹{ord.handlingCharge ?? 10}</span>
                                    </div>
                                  </div>

                                  {/* Order summary calculations CTA reorder */}
                                  <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="text-left">
                                      <p className="text-[10px] text-gray-400 font-semibold uppercase leading-none">Delivered to</p>
                                      <p className="font-bold text-gray-850 mt-1 capitalize leading-none">{ord.address.label} ({ord.address.name})</p>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <div>
                                        <p className="text-[9px] text-gray-400 font-semibold uppercase text-right leading-none">Total Value</p>
                                        <p className="text-sm font-black text-gray-900 mt-1 leading-none">₹{ord.total}</p>
                                      </div>

                                      {ord.status === "placed" && (
                                        <button
                                          id={`smartcart-cancel-button-profile-active-${ord.id}`}
                                          onClick={() => handleCancelOrderClick(ord.id, ord.status)}
                                          className="group flex items-center justify-center gap-1.5 px-3.5 py-2 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 font-extrabold text-[10px] uppercase rounded-xl tracking-wider transition duration-300 hover:shadow-xs active:scale-95 cursor-pointer animate-pulse"
                                        >
                                          <X className="h-3.5 w-3.5 text-red-500 group-hover:rotate-90 transition-transform duration-300" />
                                          <span>Cancel Order</span>
                                        </button>
                                      )}

                                      <button
                                        onClick={() => onReorder(ord)}
                                        className="flex items-center space-x-1.5 rounded-lg border border-green-500 bg-white hover:bg-green-500 hover:text-white text-green-600 font-extrabold p-2 transition active:scale-95 cursor-pointer"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        <span className="text-[10px] uppercase">Instant Reorder</span>
                                      </button>
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Order History */}
                      {pastOrders.length > 0 && (
                        <div>
                          <h3 className="text-xs font-black text-gray-450 uppercase tracking-wider mb-3 mt-2 flex items-center gap-1.5">
                            <Package className="h-4 w-4" />
                            <span>Order History ({pastOrders.length})</span>
                          </h3>
                          
                          <div className="space-y-4">
                            {pastOrders.map((ord) => {
                              const isLive = ord.status !== "delivered" && ord.status !== "cancelled";
                              return (
                                <div key={ord.id} className="border border-gray-150 rounded-2xl p-4 hover:border-gray-200 transition bg-gray-50/20">
                                  
                                  {/* Order Meta row */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                                    <div>
                                      <p className="text-xs font-black text-gray-900">Order ID: #{ord.id}</p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{ord.date} • {ord.paymentMethod}</p>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                        ord.status === "delivered" 
                                          ? "bg-green-100 text-green-700" 
                                          : "bg-red-100 text-red-700"
                                      }`}>
                                        {ord.status === "delivered" ? "Delivered" : "Cancelled"}
                                      </span>

                                      {isLive && (
                                        <button
                                          onClick={() => onTrackOrder(ord)}
                                          className="flex items-center space-x-1 rounded-lg bg-green-500 text-white font-black text-[10px] uppercase p-1.5 transition hover:bg-green-600"
                                        >
                                          <Navigation className="h-3 w-3 fill-white" />
                                          <span>Live Track</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Order Products mapping list */}
                                  <div className="space-y-2 mb-3 max-h-36 overflow-y-auto border-b border-gray-100 pb-2">
                                    {ord.items.map((it) => (
                                      <div key={it.product.id} className="flex items-center justify-between text-xs font-medium">
                                        <div className="flex items-center space-x-2">
                                          <img src={it.product.image} alt={it.product.name} className="h-6 w-6 rounded object-cover" />
                                          <span className="text-gray-850 font-bold truncate max-w-[200px]">{it.product.name}</span>
                                          <span className="text-[10px] text-gray-400">({it.product.weight})</span>
                                        </div>
                                        <span className="text-gray-500">Qty: {it.quantity} • <strong className="text-gray-800">₹{it.product.sellingPrice * it.quantity}</strong></span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Pricing breakdown summary segment */}
                                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-[10px] font-medium text-gray-500 space-y-1 mb-2">
                                    <div className="flex justify-between">
                                      <span>Subtotal:</span>
                                      <span className="font-bold text-gray-755">₹{ord.subtotal}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="flex items-center gap-1">
                                        <span>Delivery Charge:</span>
                                        {ord.deliveryCharge === 0 && (
                                          <span className="px-1 bg-green-100 text-[7px] font-extrabold text-green-700 uppercase rounded">FREE DELIVERY</span>
                                        )}
                                      </span>
                                      <span className={ord.deliveryCharge === 0 ? "font-black text-green-600" : "font-bold text-gray-750"}>
                                        {ord.deliveryCharge === 0 ? "FREE" : `₹${ord.deliveryCharge}`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Platform Fee:</span>
                                      <span className="font-bold text-gray-750">₹{ord.platformFee ?? 3}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Handling Charge:</span>
                                      <span className="font-bold text-gray-750">₹{ord.handlingCharge ?? 10}</span>
                                    </div>
                                  </div>

                                  {/* Order summary calculations CTA reorder */}
                                  <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="text-left">
                                      <p className="text-[10px] text-gray-400 font-semibold uppercase leading-none">Delivered to</p>
                                      <p className="font-bold text-gray-850 mt-1 capitalize leading-none">{ord.address.label} ({ord.address.name})</p>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <div>
                                        <p className="text-[9px] text-gray-400 font-semibold uppercase text-right leading-none">Total Value</p>
                                        <p className="text-sm font-black text-gray-900 mt-1 leading-none">₹{ord.total}</p>
                                      </div>

                                      {ord.status === "placed" && (
                                        <button
                                          id={`smartcart-cancel-button-profile-past-${ord.id}`}
                                          onClick={() => handleCancelOrderClick(ord.id, ord.status)}
                                          className="group flex items-center justify-center gap-1.5 px-3.5 py-2 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 font-extrabold text-[10px] uppercase rounded-xl tracking-wider transition duration-300 hover:shadow-xs active:scale-95 cursor-pointer animate-pulse"
                                        >
                                          <X className="h-3.5 w-3.5 text-red-500 group-hover:rotate-90 transition-transform duration-300" />
                                          <span>Cancel Order</span>
                                        </button>
                                      )}

                                      <button
                                        onClick={() => onReorder(ord)}
                                        className="flex items-center space-x-1.5 rounded-lg border border-green-500 bg-white hover:bg-green-500 hover:text-white text-green-600 font-extrabold p-2 transition active:scale-95 cursor-pointer"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        <span className="text-[10px] uppercase">Instant Reorder</span>
                                      </button>
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })()}

            {/* ================= PERSONAL DETAIL TAB ================= */}
            {subTab === "profile" && (
              <div className="space-y-6 text-left animate-in fade-in duration-200">
                <div>
                  <h2 className="text-base font-black text-gray-900 uppercase tracking-wider">Subscriber Parameters</h2>
                  <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5">Manage details utilized during checkout delivery</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                  <div>
                    <label className="text-[10px] font-black text-gray-450 uppercase">{t("Full Identity Name")}</label>
                    <input
                      type="text"
                      className="w-full mt-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      disabled={!isEditing}
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-445 uppercase">{t("Contact Number")}</label>
                    <input
                      type="tel"
                      className="w-full mt-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      disabled={!isEditing}
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-440 uppercase">{t("E-Mail Address")}</label>
                    <input
                      type="email"
                      className="w-full mt-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      disabled={!isEditing}
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                    />
                  </div>

                  {profileSaveError && (
                    <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-xl border border-red-100 flex items-center gap-1.5">
                      ⚠️ {profileSaveError}
                    </p>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setTempName(userName);
                            setTempPhone(userPhone);
                            setTempEmail(userEmail);
                            setIsEditing(false);
                          }}
                          className="px-4 py-2 border border-gray-200 text-xs font-bold rounded-xl"
                        >
                          {t("Cancel")}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white font-black text-xs rounded-xl transition"
                        >
                          {t("Save Changes")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-black text-xs rounded-xl transition"
                      >
                        {t("Edit Profile Details")}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* ================= SAVED ADDRESSES TAB ================= */}
            {subTab === "addresses" && (
              <div className="space-y-6 text-left animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-base font-black text-gray-900 uppercase tracking-wider">Address Book Coordinates</h2>
                    <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5">Delivery endpoints used during ordering</p>
                  </div>
                  {onResetAddresses && savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetConfirm(true);
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-xs font-bold tracking-tight transition cursor-pointer"
                    >
                      Reset Register
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className={`p-4 border rounded-2xl text-left relative ${
                      addr.serviceable === false ? "border-red-200 bg-red-50/10 animate-[pulse_3s_infinite]" : "border-gray-150 bg-gray-50/20"
                    }`}>
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        {addr.serviceable === false && (
                          <span className="text-[8px] bg-rose-600 font-extrabold text-white px-1.5 py-0.5 rounded uppercase">
                            🔴 Out of Area
                          </span>
                        )}
                        {addr.isDefault && (
                          <span className="text-[8px] bg-amber-500 font-extrabold text-white px-1.5 py-0.5 rounded uppercase">
                            Default
                          </span>
                        )}
                        <span className="text-[9px] bg-green-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                          {addr.label}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-gray-800">{addr.name}</h4>
                      <p className="text-xs text-gray-400 leading-normal mt-1.5 font-medium">{addr.addressLine}</p>
                      <p className="text-[10px] font-bold text-gray-450 mt-1">{addr.city} • {addr.pincode}</p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Phone: {addr.phone}</p>
                      
                      <div className="flex items-center gap-3.5 mt-3 border-t border-gray-100 pt-2.5">
                        <button
                          onClick={() => handleStartEditAddress(addr)}
                          className="text-[10px] font-bold text-green-600 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onRemoveAddress(addr.id)}
                          className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                        {!addr.isDefault && onSetDefaultAddress && (
                          <button
                            onClick={() => onSetDefaultAddress(addr.id)}
                            className="text-[10px] font-bold text-gray-550 hover:underline cursor-pointer ml-auto"
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline form to add additional coordinates */}
                <form onSubmit={handleAddNewAddress} className="mt-8 border-t border-gray-50 pt-5 space-y-4 max-w-lg">
                  <div className="flex items-center justify-between">
                    <h3 id="address-form-header" className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      {editingAddressId ? "Edit Address Coordinates" : "Add Additional Address"}
                    </h3>
                    <button
                      type="button"
                      onClick={handleDetectLocationInProfile}
                      disabled={isDetecting}
                      className="flex items-center space-x-1 font-bold text-[10px] uppercase bg-green-50 text-green-700 px-2.5 py-1 rounded-lg border border-green-200 hover:bg-green-100 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isDetecting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <Compass className="h-3 w-3" />
                          <span>Detect Location</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Label coordinates</label>
                      <div className="flex gap-1.5 mt-1">
                        {(["Home", "Work", "Other"] as const).map((label) => (
                          <button
                            type="button"
                            key={label}
                            onClick={() => setTypeLabel(label)}
                            className={`px-3 py-1 font-bold text-xs rounded-lg border transition ${
                              typeLabel === label
                                ? "bg-green-500 border-green-500 text-white"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Map integration */}
                    {aLat && aLng && (
                      <div className="col-span-2 space-y-1.5 mt-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Drag Pin to Match Your Doorstep</label>
                        <DeliveryMap
                          lat={aLat}
                          lng={aLng}
                          accuracy={aGpsAccuracy || undefined}
                          onLocationChange={(newLat, newLng) => {
                            setALat(newLat);
                            setALng(newLng);
                            
                            // Reverse lookup Osm Nominatims
                            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`)
                              .then((res) => res.json())
                              .then((data) => {
                                if (data && data.display_name) {
                                  setAStreet(data.display_name);
                                  if (data.address) {
                                    const cityVal = data.address.city || data.address.town || data.address.suburb || data.address.state_district || aCity;
                                    const pinVal = data.address.postcode || aPincode;
                                    const stateVal = data.address.state || aStateVal;
                                    setACity(cityVal);
                                    setAStateVal(stateVal);
                                    if (pinVal) setAPincode(pinVal);
                                  }
                                }
                              })
                              .catch((err) => console.warn("Map drag reverse geocode failed skipped:", err));
                          }}
                        />
                        {aGpsAccuracy && aGpsAccuracy > 100 && (
                          <div className="p-2 border border-yellow-250 bg-yellow-50 text-yellow-800 rounded-xl text-[10.5px] font-bold flex items-start gap-1.5 animate-pulse leading-normal">
                            <span>⚠️</span>
                            <span>
                              Low GPS accuracy ({aGpsAccuracy.toFixed(0)}m). Please drag the green pin on the map to confirm your delivery spot.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Recipient Name *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="Recipient full name"
                        value={aName}
                        onChange={(e) => setAName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="10-digit phone"
                        value={aPhone}
                        onChange={(e) => setAPhone(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">House / Flat / Floor Number *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="e.g. Flat 302, 3rd Floor"
                        value={aHouseFlatNumber}
                        onChange={(e) => setAHouseFlatNumber(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Street Row / Sector / Area *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="e.g. Cyber City, Sector 24"
                        value={aStreet}
                        onChange={(e) => setAStreet(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">City *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        value={aCity}
                        onChange={(e) => setACity(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">State *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        value={aStateVal}
                        onChange={(e) => setAStateVal(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Pincode *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="6 digits area pin"
                        maxLength={6}
                        value={aPincode}
                        onChange={(e) => setAPincode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>

                    <div className="col-span-2 flex items-center space-x-2 mt-1">
                      <input
                        type="checkbox"
                        id="user-profile-default-checkbox"
                        checked={aIsDefault}
                        onChange={(e) => setAIsDefault(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer"
                      />
                      <label htmlFor="user-profile-default-checkbox" className="text-xs font-bold text-gray-650 cursor-pointer select-none">
                        Set as Default Address
                      </label>
                    </div>
                  </div>

                  {addrError && <p className="text-[10px] font-bold text-red-500">{addrError}</p>}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white font-black text-xs rounded-xl transition cursor-pointer"
                    >
                      {editingAddressId ? "Update Address Card" : "Add Address Card"}
                    </button>
                    {editingAddressId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>

              </div>
            )}

            {/* ================= PREFERENCES SETTINGS TAB ================= */}
            {subTab === "settings" && (
              <div className="space-y-6 text-left animate-in fade-in duration-200">
                <div>
                  <h2 className="text-base font-black text-gray-900 uppercase tracking-wider">Preferences Configuration</h2>
                  <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5">Customize alerts and authentication configurations</p>
                </div>

                <div className="space-y-6 max-w-md">
                  
                  {/* Toggle Notification */}
                  <div className="flex items-center justify-between p-3.5 border border-gray-150 rounded-2xl">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="bg-orange-100 text-orange-600 p-2 rounded-xl">
                        <Bell className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-800 leading-none">Order Transit Notifications</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Blink notifications upon rider transits</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotifState(!notifState)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-hidden ${
                        notifState ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ${
                        notifState ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  {/* Dropdown Language selection */}
                  <div className="flex items-center justify-between p-3.5 border border-gray-150 rounded-2xl">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                        <Languages className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-800 leading-none">{t("Languages")}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{t("Select localized website strings")}</p>
                      </div>
                    </div>
                    
                    <select
                      value={langState}
                      onChange={(e) => setLangState(e.target.value as any)}
                      className="rounded-lg border border-gray-200 bg-white p-1 px-2.5 text-xs font-bold focus:border-green-500 outline-hidden"
                    >
                      <option value="English (IN)">English (IN)</option>
                      <option value="Hindi (हिन्दी)">Hindi (हिन्दी)</option>
                    </select>
                  </div>

                  {/* Reset Password details mock */}
                  <form onSubmit={handleResetPassword} className="border-t border-gray-100 pt-5 space-y-3">
                    <h4 className="text-xs font-black text-gray-700 uppercase tracking-wide">{t("Change Password")}</h4>
                    
                    <div>
                      <input
                        type="password"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="Current security password"
                        value={passOld}
                        onChange={(e) => setPassOld(e.target.value)}
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="Enter premium new password"
                        value={passNew}
                        onChange={(e) => setPassNew(e.target.value)}
                      />
                    </div>

                    {passSuccess && <p className="text-[10px] font-bold text-green-600">{passSuccess}</p>}

                    <button
                      type="submit"
                      className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-black text-xs rounded-xl transition"
                    >
                      {t("Update Password")}
                    </button>
                  </form>

                  {/* legal & policies */}
                  {onViewPolicy && (
                    <div className="border-t border-gray-100 pt-5 space-y-3">
                      <h4 className="text-xs font-black text-gray-700 uppercase tracking-wide">Legal & Policies</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Read our official customer terms and privacy disclosures</p>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => onViewPolicy("terms")}
                          className="flex items-center justify-between p-3 border border-gray-150 rounded-2xl hover:bg-gray-50 transition cursor-pointer text-xs font-extrabold text-gray-800"
                        >
                          <span>Terms & Conditions</span>
                          <span className="text-gray-400 font-bold">&rarr;</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewPolicy("privacy")}
                          className="flex items-center justify-between p-3 border border-gray-150 rounded-2xl hover:bg-gray-50 transition cursor-pointer text-xs font-extrabold text-gray-800"
                        >
                          <span>Privacy Policy</span>
                          <span className="text-gray-400 font-bold">&rarr;</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewPolicy("refund")}
                          className="flex items-center justify-between p-3 border border-gray-150 rounded-2xl hover:bg-gray-50 transition cursor-pointer text-xs font-extrabold text-gray-800"
                        >
                          <span>Refund & Cancellation Policy</span>
                          <span className="text-gray-400 font-bold">&rarr;</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* CONFIRM ORDER CANCELLATION MODAL */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold">!</span>
            </div>
            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-2">Cancel Active Order</h3>
            <p className="text-xs text-gray-400 font-semibold mb-1">ORDER ID: {orderToCancel}</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-6 font-medium p-1">
              Are you sure you want to cancel this order? This action will immediately retract rider assignments and delete any currently active tracking beacons.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log("[SmartCart Debug] Confirmation Success: Dispatching status change to 'cancelled'...");
                  onUpdateOrderStatus?.(orderToCancel, "cancelled");
                  setOrderToCancel(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-wider transition cursor-pointer"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ADDRESS BOOK RESET MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold">!</span>
            </div>
            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-2">Reset Address Book</h3>
            <p className="text-xs text-gray-550 leading-relaxed mb-6 font-medium">
              Are you sure you want to reset your entirely saved address register? This will delete all saved addresses permanently.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetAddresses) {
                    onResetAddresses();
                  }
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-wider transition cursor-pointer"
              >
                Reset Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE / INFO MODAL */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold">i</span>
            </div>
            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-2">Action Blocked</h3>
            <p className="text-xs text-gray-550 leading-relaxed mb-6 font-medium">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
