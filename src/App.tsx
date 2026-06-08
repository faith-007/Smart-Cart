import React, { useState, useEffect } from "react";
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, PROMO_CODES } from "./data";
import { Product, Category, CartItem, Address, Order, PromoCode, Rider } from "./types";

// Component Imports
import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import ProductCard from "./components/ProductCard";
import ProductDetailsModal from "./components/ProductDetailsModal";
import CartDrawer from "./components/CartDrawer";
import CheckoutModal from "./components/CheckoutModal";
import OrderTracking from "./components/OrderTracking";
import UserProfile from "./components/UserProfile";
import AdminPanel from "./components/AdminPanel";
import RiderDashboard from "./components/RiderDashboard";
import LocationOnboardingModal from "./components/LocationOnboardingModal";
import { syncOrderToFirebase, fetchOrdersFromFirebase, auth, fetchRidersFromFirebase, syncRiderToFirebase, fetchUserProfileFromFirebase } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Icons for general UI
import { Sparkles, Heart, ShoppingBag, ShieldAlert, ArrowLeft, Trash2, Home, AlertCircle, RefreshCw, Star, Info } from "lucide-react";

export default function App() {
  // --- Root States ---
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<string>("home"); // "home" | "wishlist" | "profile" | "admin"
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // --- Address States ---
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const [showLocationOnboarding, setShowLocationOnboarding] = useState<boolean>(false);

  // --- Open Modals/Drawers States ---
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [activeOrderForTracking, setActiveOrderForTracking] = useState<Order | null>(null);

  // --- Order States ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);

  // --- Rider Database State ---
  const [riders, setRiders] = useState<Rider[]>(() => {
    const saved = localStorage.getItem("smartcart_riders_db");
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        if (Array.isArray(loaded)) {
          return loaded.map(r => {
            let pass = r.password || "123456";
            if (pass.length < 6) {
              pass = pass.padEnd(6, pass[pass.length - 1] || "0");
            }
            return { ...r, password: pass };
          });
        }
      } catch (e) {
        console.error("Failed to parse riders", e);
      }
    }
    return [
      {
        id: "rider-1",
        name: "Ramesh Kumar",
        phone: "+91 98315 48210",
        email: "ramesh@smartcart.com",
        vehicleNumber: "DL-3S-CH-0104",
        isActiveOnDuty: true,
        lat: 42.0,
        lng: 64.0,
        battery: "94%",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
        completedDeliveries: 12,
        activeDeliveries: 0,
        avgDeliveryTime: 14,
        password: "111111"
      },
      {
        id: "rider-2",
        name: "Amit Sharma",
        phone: "+91 99124 10204",
        email: "amit@smartcart.com",
        vehicleNumber: "HR-26-Y-2856",
        isActiveOnDuty: true,
        lat: 68.0,
        lng: 32.0,
        battery: "78%",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150",
        completedDeliveries: 8,
        activeDeliveries: 0,
        avgDeliveryTime: 18,
        password: "222222"
      },
      {
        id: "rider-3",
        name: "Sandeep Singh",
        phone: "+91 97182 55901",
        email: "sandeep@smartcart.com",
        vehicleNumber: "DL-1V-AA-5291",
        isActiveOnDuty: false,
        lat: 50.0,
        lng: 50.0,
        battery: "100%",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
        completedDeliveries: 24,
        activeDeliveries: 0,
        avgDeliveryTime: 11,
        password: "333333"
      },
      {
        id: "rider-4",
        name: "Vikram Rathore",
        phone: "+91 98112 55291",
        email: "vikram@smartcart.com",
        vehicleNumber: "UP-16-TS-8941",
        isActiveOnDuty: true,
        lat: 28.0,
        lng: 48.0,
        battery: "82%",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
        completedDeliveries: 19,
        activeDeliveries: 0,
        avgDeliveryTime: 13,
        password: "444444"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("smartcart_riders_db", JSON.stringify(riders));
  }, [riders]);

  // --- Rider Session States ---
  const [riderSession, setRiderSession] = useState<Rider | null>(() => {
    const saved = localStorage.getItem("smartcart_rider_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse rider session", e);
      }
    }
    return null;
  });

  useEffect(() => {
    if (riderSession) {
      localStorage.setItem("smartcart_rider_session", JSON.stringify(riderSession));
    } else {
      localStorage.removeItem("smartcart_rider_session");
    }
  }, [riderSession]);

  // --- Personalized User States ---
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem("smartcart_customer_name") || "";
  });
  const [userPhone, setUserPhone] = useState<string>(() => {
    return localStorage.getItem("smartcart_customer_phone") || "";
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem("smartcart_customer_email") || "";
  });
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("smartcart_customer_logged_in") === "true";
  });

  // --- Role State and Automatic Authorization Guards ---
  const [userRole, setUserRole] = useState<"Admin" | "Rider" | "Customer" | "Guest">("Guest");

  useEffect(() => {
    let active = true;
    const updateRoleFromProfile = async () => {
      if (!isCustomerLoggedIn) {
        if (active) {
          setUserRole("Guest");
          setRiderSession(null);
          localStorage.removeItem("smartcart_rider_session");
        }
        return;
      }

      // If logged in under the admin email
      const trimmedEmail = userEmail.toLowerCase().trim();
      if (trimmedEmail === "himanshu712007@gmail.com") {
        if (active) {
          setUserRole("Admin");
          // Ensure rider session is completely cleared for Admin
          setRiderSession(null);
          localStorage.removeItem("smartcart_rider_session");
        }
        return;
      }

      try {
        // Fetch current authenticated user's profile from Firestore
        const userId = auth.currentUser?.uid;
        if (userId) {
          const profile = await fetchUserProfileFromFirebase(userId);
          if (profile && active) {
            setUserRole(profile.role || "Customer");
            if (profile.role === "Rider" && profile.riderId) {
              const matchedRider = riders.find(r => r.id === profile.riderId) || 
                                   riders.find(r => r.email?.toLowerCase().trim() === trimmedEmail);
              if (matchedRider) {
                if (!riderSession || riderSession.id !== matchedRider.id) {
                  const signedRider = { ...matchedRider, isActiveOnDuty: true };
                  setRiderSession(signedRider);
                  localStorage.setItem("smartcart_rider_session", JSON.stringify(signedRider));
                }
              }
            } else {
              // Not a rider, clear riderSession
              setRiderSession(null);
              localStorage.removeItem("smartcart_rider_session");
            }
            return;
          }
        }

        // Fallback: If profile doc is not found or loaded yet, check riders collection
        const matchedRider = riders.find((r) => {
          const isEmailMatch = r.email && r.email.toLowerCase().trim() === trimmedEmail;
          const cleanInputPhone = userPhone.replace(/\D/g, "");
          const cleanRiderPhone = r.phone?.replace(/\D/g, "") || "";
          const isPhoneMatch = cleanInputPhone.length >= 8 && cleanRiderPhone.endsWith(cleanInputPhone.slice(-10));
          return isEmailMatch || isPhoneMatch;
        });

        if (matchedRider) {
          if (active) {
            setUserRole("Rider");
            if (!riderSession || riderSession.id !== matchedRider.id) {
              const signedRider = { ...matchedRider, isActiveOnDuty: true };
              setRiderSession(signedRider);
              localStorage.setItem("smartcart_rider_session", JSON.stringify(signedRider));
            }
          }
        } else {
          if (active) {
            setUserRole("Customer");
            setRiderSession(null);
            localStorage.removeItem("smartcart_rider_session");
          }
        }
      } catch (err) {
        console.warn("Failed to check user role from Firestore profile, employing fallback:", err);
      }
    };

    updateRoleFromProfile();
    return () => {
      active = false;
    };
  }, [isCustomerLoggedIn, userEmail, userPhone, riders, auth.currentUser]);

  // Support URL Hash guards with secure role-based redirecting
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase().replace("#", "");
      if (hash === "rider") {
        if (userRole === "Rider") {
          setActiveTab("rider");
        } else {
          // Unauthorized access! Redirect to active role dashboard or home
          console.warn("[SmartCart RBAC] Prevented access to Rider Portal for non-Rider.");
          if (userRole === "Admin") {
            setActiveTab("admin");
            window.location.hash = "admin";
          } else {
            setActiveTab("home");
            window.location.hash = "";
          }
        }
      } else if (hash === "admin") {
        if (userRole === "Admin") {
          setActiveTab("admin");
        } else {
          // Unauthorized access! Redirect to active role dashboard or home
          console.warn("[SmartCart RBAC] Prevented access to Admin Portal for non-Admin.");
          if (userRole === "Rider") {
            setActiveTab("rider");
            window.location.hash = "rider";
          } else {
            setActiveTab("home");
            window.location.hash = "";
          }
        }
      } else if (hash && ["home", "wishlist", "profile"].includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    const timeoutId = setTimeout(handleHashChange, 500);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      clearTimeout(timeoutId);
    };
  }, [userRole]);

  // Load cart, wishlist, addresses, and orders on boot (with real-time Supabase sync)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("smartcart_cart");
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWishlist = localStorage.getItem("smartcart_wishlist");
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

      const loggedIn = localStorage.getItem("smartcart_customer_logged_in") === "true";
      if (loggedIn) {
        setIsCustomerLoggedIn(true);
        setUserName(localStorage.getItem("smartcart_customer_name") || "");
        setUserPhone(localStorage.getItem("smartcart_customer_phone") || "");
        setUserEmail(localStorage.getItem("smartcart_customer_email") || "");
        
        const savedAddrs = localStorage.getItem("smartcart_addresses");
        if (savedAddrs) {
          const parsed = JSON.parse(savedAddrs);
          setSavedAddresses(parsed);
          if (parsed.length > 0) {
            setCurrentAddress(parsed[0]);
          } else {
            setShowLocationOnboarding(true);
          }
        } else {
          setShowLocationOnboarding(true);
        }
      } else {
        setIsCustomerLoggedIn(false);
        setUserName("");
        setUserPhone("");
        setUserEmail("");
        setSavedAddresses([]);
        setCurrentAddress(null);
      }
    } catch (e) {
      console.error("Failed to load persisted localStorage states", e);
    }

    // Load riders from Firebase on boot
    const loadData = async () => {
      try {
        const dbRiders = await fetchRidersFromFirebase();
        if (dbRiders && dbRiders.length > 0) {
          console.log("[SmartCart] Riders loaded from Firestore:", dbRiders);
          setRiders(dbRiders);
          localStorage.setItem("smartcart_riders_db", JSON.stringify(dbRiders));
        } else {
          // No riders in DB, seed with standard Admin-created Rider defaults
          console.log("[SmartCart] Seeding Firestore riders table...");
          const defaultRidersList: Rider[] = [
            {
              id: "rider-1",
              name: "Ramesh Kumar",
              phone: "+91 98315 48210",
              email: "ramesh@smartcart.com",
              vehicleNumber: "DL-3S-CH-0104",
              isActiveOnDuty: true,
              lat: 42.0,
              lng: 64.0,
              battery: "94%",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
              completedDeliveries: 12,
              activeDeliveries: 0,
              avgDeliveryTime: 14,
              password: "111111"
            },
            {
              id: "rider-2",
              name: "Amit Sharma",
              phone: "+91 99124 10204",
              email: "amit@smartcart.com",
              vehicleNumber: "HR-26-Y-2856",
              isActiveOnDuty: true,
              lat: 68.0,
              lng: 32.0,
              battery: "78%",
              avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150",
              completedDeliveries: 8,
              activeDeliveries: 0,
              avgDeliveryTime: 18,
              password: "222222"
            },
            {
              id: "rider-3",
              name: "Sandeep Singh",
              phone: "+91 97182 55901",
              email: "sandeep@smartcart.com",
              vehicleNumber: "DL-1V-AA-5291",
              isActiveOnDuty: false,
              lat: 50.0,
              lng: 50.0,
              battery: "100%",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
              completedDeliveries: 24,
              activeDeliveries: 0,
              avgDeliveryTime: 11,
              password: "333333"
            },
            {
              id: "rider-4",
              name: "Vikram Rathore",
              phone: "+91 98112 55291",
              email: "vikram@smartcart.com",
              vehicleNumber: "UP-16-TS-8941",
              isActiveOnDuty: true,
              lat: 28.0,
              lng: 48.0,
              battery: "82%",
              avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
              completedDeliveries: 19,
              activeDeliveries: 0,
              avgDeliveryTime: 13,
              password: "444444"
            }
          ];
          const isAdminUser = auth.currentUser && auth.currentUser.email === "himanshu712007@gmail.com";
          if (isAdminUser) {
            for (const r of defaultRidersList) {
              await syncRiderToFirebase(r).catch((e) => console.warn("Seed write skipped:", e));
            }
          }
          setRiders(defaultRidersList);
          localStorage.setItem("smartcart_riders_db", JSON.stringify(defaultRidersList));
        }
      } catch (err) {
        console.error("Error loading/seeding riders from Firestore:", err);
      }
    };
    loadData();
  }, []);

  // --- Dynamic Storage Key for Order Isolation ---
  const getOrdersStorageKey = () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return `smartcart_orders_${currentUser.uid}`;
    }
    if (isCustomerLoggedIn) {
      if (userEmail) {
        return `smartcart_orders_sim_${userEmail.replace(/[@.]/g, "_")}`;
      }
      if (userPhone) {
        return `smartcart_orders_sim_${userPhone.replace(/\D/g, "")}`;
      }
    }
    return "smartcart_orders_anonymous";
  };

  // Sync auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[SmartCart] Auth state synchronized: User logged in", firebaseUser.email);
        
        let profileRole: "Admin" | "Rider" | "Customer" | "Guest" = "Customer";
        let loadedProfile: any = null;
        if (firebaseUser.email === "himanshu712007@gmail.com") {
          profileRole = "Admin";
        }
        
        try {
          // Briefly pause for token transmission
          await new Promise((r) => setTimeout(r, 200));
          const profile = await fetchUserProfileFromFirebase(firebaseUser.uid);
          if (profile) {
            loadedProfile = profile;
            profileRole = profile.role || "Customer";
          }
        } catch(e) {
          console.error("Error fetching role on login:", e);
        }

        // Always load profile fields if available, otherwise fallback to firebaseUser displayName/email
        const finalName = loadedProfile?.name || firebaseUser.displayName || "Customer";
        const finalEmail = loadedProfile?.email || firebaseUser.email || "";
        const finalPhone = loadedProfile?.phone || "";
        const finalAddresses = loadedProfile?.addresses || [];

        setIsCustomerLoggedIn(true);
        setUserRole(profileRole);
        setUserName(finalName);
        setUserEmail(finalEmail);
        setUserPhone(finalPhone);
        setSavedAddresses(finalAddresses);
        if (finalAddresses.length > 0) {
          setCurrentAddress(finalAddresses[0]);
        } else {
          setCurrentAddress(null);
        }

        localStorage.setItem("smartcart_customer_logged_in", "true");
        localStorage.setItem("smartcart_customer_name", finalName);
        localStorage.setItem("smartcart_customer_email", finalEmail);
        localStorage.setItem("smartcart_customer_phone", finalPhone);
        localStorage.setItem("smartcart_addresses", JSON.stringify(finalAddresses));

        // Fetch dynamic key for current user
        const dynamicKey = `smartcart_orders_${firebaseUser.uid}`;

        // Immediately fetch relevant orders, specifying profileRole
        fetchOrdersFromFirebase(profileRole).then((dbOrders) => {
          if (dbOrders && dbOrders.length > 0) {
            setOrders(dbOrders);
            localStorage.setItem(dynamicKey, JSON.stringify(dbOrders));
          } else {
            // Check if we have local orders saved for this user as a fallback
            const savedOrders = localStorage.getItem(dynamicKey);
            if (savedOrders) {
              setOrders(JSON.parse(savedOrders));
            } else {
              setOrders([]);
            }
          }
        }).catch((err) => {
          console.warn("Error fetching user orders directly:", err);
          const savedOrders = localStorage.getItem(dynamicKey);
          if (savedOrders) setOrders(JSON.parse(savedOrders));
        });
      } else {
        console.log("[SmartCart] Auth state synchronized: Guest session active.");
        setIsCustomerLoggedIn(false);
        setUserRole("Customer");
        setUserName("");
        setUserEmail("");
        setUserPhone("");
        setSavedAddresses([]);
        setCurrentAddress(null);
        setOrders([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Firebase orders and real-time statuses periodically (every 4 seconds)
  useEffect(() => {
    let active = true;
    const intervalId = setInterval(async () => {
      try {
        const currentUser = auth.currentUser;
        // Allow polling for simulated/silent riders and admins as well
        const isRiderRole = userRole === "Rider" || activeTab === "rider";
        const isAdminRole = userRole === "Admin" || activeTab === "admin";
        if (!currentUser && !isCustomerLoggedIn && !isRiderRole && !isAdminRole) return;

        // Admin and Rider only poll for all orders, Customers only query their own
        const queryAll = isAdminRole || isRiderRole;
        
        const dbOrders = await fetchOrdersFromFirebase(userRole || (isRiderRole ? "Rider" : "Customer"), queryAll);
        if (dbOrders && active) {
          setOrders((prevOrders) => {
            // Keep state updated matching the database
            return dbOrders;
          });

          // Sync the active tracking order
          setActiveOrderForTracking((prevTrack) => {
            if (!prevTrack) return null;
            const fresh = dbOrders.find((o) => o.id === prevTrack.id);
            if (fresh) {
              if (JSON.stringify(fresh) !== JSON.stringify(prevTrack)) {
                return fresh;
              }
            }
            return prevTrack;
          });

          // Save list to dynamic local storage key
          localStorage.setItem(getOrdersStorageKey(), JSON.stringify(dbOrders));
        }
      } catch (err) {
        console.warn("[SmartCart Real-Time Sync] Fallback poll failed:", err);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [activeTab, userRole, isCustomerLoggedIn]);

  // Save states to localStorage on transitions
  const saveCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    try {
      localStorage.setItem("smartcart_cart", JSON.stringify(updatedCart));
    } catch (e) {}
  };

  const saveWishlist = (updatedWishlist: Product[]) => {
    setWishlist(updatedWishlist);
    try {
      localStorage.setItem("smartcart_wishlist", JSON.stringify(updatedWishlist));
    } catch (e) {}
  };

  const saveOrders = (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
    try {
      localStorage.setItem(getOrdersStorageKey(), JSON.stringify(updatedOrders));
    } catch (e) {}
  };

  const saveAddresses = (updatedAddrs: Address[]) => {
    setSavedAddresses(updatedAddrs);
    try {
      localStorage.setItem("smartcart_addresses", JSON.stringify(updatedAddrs));
    } catch (e) {}
  };

  // --- Add / Remove / Qty Handlers ---

  const handleAddToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    let updated: CartItem[];

    if (existing) {
      // Check stock limits before adding
      if (existing.quantity >= product.stock) {
        alert(`Only ${product.stock} units of ${product.name} are available in our hub inventory!`);
        return;
      }
      updated = cart.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updated = [...cart, { product, quantity: 1 }];
    }
    saveCart(updated);
  };

  const handleRemoveFromCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (!existing) return;

    let updated: CartItem[];
    if (existing.quantity === 1) {
      updated = cart.filter((item) => item.product.id !== product.id);
    } else {
      updated = cart.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    }
    saveCart(updated);
  };

  const handleUpdateCartQty = (product: Product, qty: number) => {
    if (qty <= 0) {
      handleRemoveItemFromCart(product);
      return;
    }
    if (qty > product.stock) {
      alert(`Only ${product.stock} units of ${product.name} are available in our hub inventory!`);
      return;
    }
    const updated = cart.map((item) =>
      item.product.id === product.id ? { ...item, quantity: qty } : item
    );
    saveCart(updated);
  };

  const handleRemoveItemFromCart = (product: Product) => {
    const updated = cart.filter((item) => item.product.id !== product.id);
    saveCart(updated);
  };

  const handleSaveForLater = (product: Product) => {
    // Save to Wishlist and remove from Cart
    const isAlreadyInWish = wishlist.some((x) => x.id === product.id);
    if (!isAlreadyInWish) {
      saveWishlist([...wishlist, product]);
    }
    handleRemoveItemFromCart(product);
  };

  const handleToggleWishlist = (product: Product) => {
    const isWish = wishlist.some((item) => item.id === product.id);
    let updated: Product[];
    if (isWish) {
      updated = wishlist.filter((item) => item.id !== product.id);
    } else {
      updated = [...wishlist, product];
    }
    saveWishlist(updated);
  };

  const handleMoveWishlistToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("This product is currently out of stock!");
      return;
    }
    handleAddToCart(product);
    const updatedWish = wishlist.filter((x) => x.id !== product.id);
    saveWishlist(updatedWish);
  };

  // --- Address Management Handlers ---

  const handleAddAddressCoord = (addrInput: Omit<Address, "id">) => {
    const newAddr: Address = {
      ...addrInput,
      id: `addr-${Date.now()}`,
    };
    const updated = [...savedAddresses, newAddr];
    saveAddresses(updated);
    setCurrentAddress(newAddr);
  };

  const handleRemoveAddressCoord = (id: string) => {
    const updated = savedAddresses.filter((a) => a.id !== id);
    saveAddresses(updated);
    if (currentAddress?.id === id) {
      if (updated.length > 0) {
        setCurrentAddress(updated[0]);
      } else {
        setCurrentAddress(null);
      }
    }
  };

  const handleCustomerLogin = (phone: string, name: string, email: string, adrs: Address[]) => {
    setIsCustomerLoggedIn(true);
    setUserName(name);
    setUserPhone(phone);
    setUserEmail(email);
    localStorage.setItem("smartcart_customer_logged_in", "true");
    localStorage.setItem("smartcart_customer_name", name);
    localStorage.setItem("smartcart_customer_phone", phone);
    localStorage.setItem("smartcart_customer_email", email);

    if (adrs && adrs.length > 0) {
      setSavedAddresses(adrs);
      setCurrentAddress(adrs[0]);
      localStorage.setItem("smartcart_addresses", JSON.stringify(adrs));
      setShowLocationOnboarding(false);
    } else {
      setSavedAddresses([]);
      setCurrentAddress(null);
      localStorage.setItem("smartcart_addresses", JSON.stringify([]));
      setShowLocationOnboarding(true);
    }
  };

  const handleCustomerLogout = () => {
    // Clear local storage customer session keys
    localStorage.removeItem("smartcart_customer_logged_in");
    localStorage.removeItem("smartcart_customer_name");
    localStorage.removeItem("smartcart_customer_phone");
    localStorage.removeItem("smartcart_customer_email");
    localStorage.removeItem("smartcart_addresses");
    localStorage.removeItem("smartcart_orders");

    // Sanitary cleanup of other user/simulated order keys
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("smartcart_orders_") || key.startsWith("smartcart_addresses_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.warn("Storage cleanup failed:", e);
    }

    // Single action: Sign out from Firebase Auth. This will automatically fire the
    // onAuthStateChanged listener and reset states in logical order
    signOut(auth)
      .then(() => {
        console.log("[SmartCart Auth] SignOut successful.");
      })
      .catch((err) => {
        console.error("Firebase SignOut error:", err);
      });
  };

  // --- Checkout and Order Processing Handlers ---

  const handleCheckoutProced = () => {
    setIsCartOpen(false);
    if (!isCustomerLoggedIn) {
      alert("Please sign up or log in first to proceed with your delivery order.");
      setActiveTab("profile");
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrderPayment = (address: Address, payMethod: string) => {
    // Subtotal Calculations
    const subtotal = cart.reduce((acc, curr) => acc + curr.product.sellingPrice * curr.quantity, 0);
    const delivery = subtotal > 200 ? 0 : 25;
    const platform = 2;
    let discount = 0;
    if (appliedPromo && subtotal >= appliedPromo.minimumOrder) {
      discount = appliedPromo.discountValue;
    }

    const totalBill = Math.max(0, subtotal - discount + delivery + platform);

    let orderUserId = "anonymous";
    if (auth.currentUser) {
      orderUserId = auth.currentUser.uid;
    } else if (isCustomerLoggedIn) {
      if (userEmail) {
        orderUserId = `sim_user_${userEmail.replace(/[@.]/g, "_")}`;
      } else if (userPhone) {
        const formattedPhone = userPhone.replace(/\D/g, "");
        orderUserId = `sim_user_${formattedPhone}`;
      }
    }

    const newOrder: Order = {
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: orderUserId,
      userEmail: userEmail || "",
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      items: [...cart],
      subtotal,
      discount,
      deliveryCharge: delivery,
      total: totalBill,
      status: "placed",
      address,
      paymentMethod: payMethod,
      eta: 15,
      deliveryPartner: undefined,
    };

    // Deduct stock levels in state
    const updatedProducts = products.map((prod) => {
      const cartItem = cart.find((item) => item.product.id === prod.id);
      if (cartItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - cartItem.quantity),
        };
      }
      return prod;
    });

    setProducts(updatedProducts);
    const newOrdersList = [newOrder, ...orders];
    saveOrders(newOrdersList);
    saveCart([]); // Clear Cart upon checkouts
    setAppliedPromo(null); // Reset promos

    // Close checkout wizard and open tracking sheet instantly!
    setIsCheckoutOpen(false);
    setActiveOrderForTracking(newOrder);

    // Sync order to your Firebase backend and dispatch SMTP email notification
    (async () => {
      console.log(`[SmartCart Firebase] Initializing Firestore write for order: ${newOrder.id}...`);
      try {
        const result = await syncOrderToFirebase(newOrder);
        if (result?.success) {
          console.log(`[SmartCart Firebase] Successfully verified order record in Firestore database for: ${newOrder.id}`);
        } else {
          console.warn("[SmartCart Firebase] Write did not crash but success flag was false:", result?.error);
        }
      } catch (err) {
        console.error(`[SmartCart Firebase] Critical database write error for order ${newOrder.id}:`, err);
      }

      // 11. Trigger order confirmation emails using the SMTP service after successful order completion
      try {
        const targetEmail = newOrder.userEmail || userEmail;
        if (targetEmail) {
          console.log(`[SmartCart Orders] Triggering SMTP transactional invoice for ORD ID: ${newOrder.id} to: ${targetEmail}`);
          const emailResponse = await fetch("/api/send-order-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, order: newOrder }),
          });
          const emailData = await emailResponse.json();
          if (emailData.success) {
            console.log(`[SmartCart Orders] SMTP Invoice successfully dispatched!`);
          } else {
            console.warn(`[SmartCart Orders] SMTP Invoice submission failed:`, emailData.error);
          }
        } else {
          console.log(`[SmartCart Orders] No destination email registered. Skipping order invoice SMTP dispatch.`);
        }
      } catch (emailErr) {
        console.error(`[SmartCart Orders] Error issuing SMTP order confirmation dispatch request:`, emailErr);
      }
    })();
  };

  // --- Admin Portal Handlers ---

  const handleAddProductAdmin = (p: Omit<Product, "id">) => {
    const fresh: Product = {
      ...p,
      id: `p-${Date.now()}`,
    };
    setProducts([fresh, ...products]);
  };

  const handleDeleteProductAdmin = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
    // Also strip deleted product from cart and wishlist to prevent layout crashes
    saveCart(cart.filter((item) => item.product.id !== id));
    saveWishlist(wishlist.filter((x) => x.id !== id));
  };

  const handleUpdateStockAdmin = (id: string, newStock: number) => {
    setProducts(
      products.map((p) => (p.id === id ? { ...p, stock: newStock } : p))
    );
  };

  const handleUpdateOrderStatus = (orderId: string, status: Order["status"]) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
    saveOrders(updated);
    
    // Sync current active tracker reference as well
    if (activeOrderForTracking && activeOrderForTracking.id === orderId) {
      setActiveOrderForTracking({
        ...activeOrderForTracking,
        status,
      });
    }

    // Sync updated status to Firebase backend in real-time
    const updatedOrder = updated.find((o) => o.id === orderId);
    if (updatedOrder) {
      syncOrderToFirebase(updatedOrder);
    }
  };

  const handleAssignRiderPartner = (orderId: string, partnerName: string) => {
    const matchingRider = riders.find((r) => r.name === partnerName);
    const selectedPhone = matchingRider?.phone || `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const selectedAvatar = matchingRider?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150";
    const selectedVehicle = matchingRider?.vehicleNumber || "DL-3S-CH-0104";
    const rId = matchingRider?.id || "rider-unassigned";
    const timestamp = new Date().toISOString();

    const updated = orders.map((o) => {
      if (o.id === orderId) {
        const finalStatus = o.status === "placed" ? "confirmed" as const : o.status;
        return {
          ...o,
          status: finalStatus,
          rider_id: rId,
          rider_name: partnerName,
          assigned_at: timestamp,
          accepted_at: timestamp,
          delivery_status: finalStatus,
          deliveryPartner: {
            id: rId,
            name: partnerName,
            rating: 4.8,
            phone: selectedPhone,
            avatar: selectedAvatar,
            vehicleNumber: selectedVehicle,
            assigned_at: timestamp,
            accepted_at: timestamp,
            delivery_status: finalStatus,
          },
        };
      }
      return o;
    });

    saveOrders(updated);

    if (activeOrderForTracking && activeOrderForTracking.id === orderId) {
      const finalStatus = activeOrderForTracking.status === "placed" ? "confirmed" as const : activeOrderForTracking.status;
      setActiveOrderForTracking({
        ...activeOrderForTracking,
        status: finalStatus,
        rider_id: rId,
        rider_name: partnerName,
        assigned_at: timestamp,
        accepted_at: timestamp,
        delivery_status: finalStatus,
        deliveryPartner: {
          id: rId,
          name: partnerName,
          rating: 4.8,
          phone: selectedPhone,
          avatar: selectedAvatar,
          vehicleNumber: selectedVehicle,
          assigned_at: timestamp,
          accepted_at: timestamp,
          delivery_status: finalStatus,
        },
      });
    }

    // Sync allocated partner details to Firebase backend
    const updatedOrder = updated.find((o) => o.id === orderId);
    if (updatedOrder) {
      syncOrderToFirebase(updatedOrder);
    }
  };

  const handleAssignPartnerToOrder = (
    orderId: string,
    partner: { id?: string; name: string; phone: string; avatar: string; vehicleNumber?: string },
    newStatus?: Order["status"]
  ) => {
    const matchingRider = riders.find((r) => r.id === partner.id || r.name === partner.name);
    const selectedVehicle = matchingRider?.vehicleNumber || partner.vehicleNumber || "DL-3S-CH-0104";
    const rId = matchingRider?.id || partner.id || "rider-unassigned";
    const timestamp = new Date().toISOString();
    const targetStatus = newStatus || "confirmed";

    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status: targetStatus,
          rider_id: rId,
          rider_name: partner.name,
          assigned_at: timestamp,
          accepted_at: timestamp,
          delivery_status: targetStatus,
          deliveryPartner: {
            id: rId,
            name: partner.name,
            rating: 4.8,
            phone: partner.phone,
            avatar: partner.avatar,
            vehicleNumber: selectedVehicle,
            assigned_at: timestamp,
            accepted_at: timestamp,
            delivery_status: targetStatus,
          },
        };
      }
      return o;
    });

    saveOrders(updated);

    if (activeOrderForTracking && activeOrderForTracking.id === orderId) {
      setActiveOrderForTracking({
        ...activeOrderForTracking,
        status: targetStatus,
        rider_id: rId,
        rider_name: partner.name,
        assigned_at: timestamp,
        accepted_at: timestamp,
        delivery_status: targetStatus,
        deliveryPartner: {
          id: rId,
          name: partner.name,
          rating: 4.8,
          phone: partner.phone,
          avatar: partner.avatar,
          vehicleNumber: selectedVehicle,
          assigned_at: timestamp,
          accepted_at: timestamp,
          delivery_status: targetStatus,
        },
      });
    }

    const updatedOrder = updated.find((o) => o.id === orderId);
    if (updatedOrder) {
      syncOrderToFirebase(updatedOrder);
    }
  };

  const handlePassOrder = (orderId: string, riderId: string) => {
    const updated = orders.map((o) => {
      if (o.id === orderId) {
        const rejectedList = o.rejectedByRiders || [];
        if (!rejectedList.includes(riderId)) {
          return {
            ...o,
            rejectedByRiders: [...rejectedList, riderId],
          };
        }
      }
      return o;
    });
    saveOrders(updated);

    const updatedOrder = updated.find((o) => o.id === orderId);
    if (updatedOrder) {
      syncOrderToFirebase(updatedOrder);
    }
  };

  const handleReorderPastItems = (pPastOrder: Order) => {
    let reloadedItemsCount = 0;
    const tempCart = [...cart];

    pPastOrder.items.forEach((item) => {
      // Locate current product card references to guarantee up-to-date attributes
      const currentRef = products.find((p) => p.id === item.product.id);
      if (currentRef && currentRef.stock > 0) {
        const addedQty = Math.min(item.quantity, currentRef.stock);
        const existsIdx = tempCart.findIndex((x) => x.product.id === item.product.id);
        
        if (existsIdx > -1) {
          tempCart[existsIdx].quantity = Math.min(tempCart[existsIdx].quantity + addedQty, currentRef.stock);
        } else {
          tempCart.push({ product: currentRef, quantity: addedQty });
        }
        reloadedItemsCount++;
      }
    });

    if (reloadedItemsCount > 0) {
      saveCart(tempCart);
      setIsCartOpen(true);
      setActiveTab("home");
    } else {
      alert("All products inside this historical purchase are currently out of stock!");
    }
  };

  const handleTrackExistingOrder = (order: Order) => {
    setActiveOrderForTracking(order);
  };

  // --- Search and category filters logic ---
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === null || p.category === selectedCategory;
    
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch = term === "" ||
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term);

    return matchesCategory && matchesSearch;
  });

  // Best offers subset
  const bestOffersSubset = products.filter((p) => p.isBestOffer === true).slice(0, 4);

  // Featured items subset
  const featuredSubset = products.filter((p) => p.isFeatured === true).slice(0, 4);

  const cartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const cartTotal = cart.reduce((acc, curr) => acc + curr.product.sellingPrice * curr.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[15px] font-sans antialiased text-gray-800 flex flex-col justify-between">
      
      {/* Top Banner & Header Navigation */}
      <h2 className="hidden">SmartCart Express Grocery deliveries</h2>
      <div>
        <Header 
          cartCount={cartCount}
          cartTotal={cartTotal}
          onCartToggle={() => setIsCartOpen(!isCartOpen)}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSelectedCategory(null);
            setSearchQuery("");
          }}
          savedAddresses={savedAddresses}
          currentAddress={currentAddress}
          setCurrentAddress={setCurrentAddress}
          onSearch={setSearchQuery}
          allProducts={products}
          onProductClick={(p) => setSelectedProduct(p)}
          isCustomerLoggedIn={isCustomerLoggedIn}
          userName={userName}
          userEmail={userEmail}
          userPhone={userPhone}
          riders={riders}
          riderSession={riderSession}
          setRiderSession={setRiderSession}
          userRole={userRole}
        />

        {/* --- DYNAMIC VIEWPORT CONTENTS --- */}

        {/* 1. HOME VIEW */}
        {activeTab === "home" && (
          <main className="animate-fade-in pb-12">
            
            {/* Show Hero Promo Carousel ONLY if no category filter or search active */}
            {!selectedCategory && searchQuery.trim() === "" && (
              <Hero />
            )}

            {/* Shop Categories horizontal filter ribbon */}
            <Categories
              categories={INITIAL_CATEGORIES}
              selectedCategory={selectedCategory}
              onSelectCategory={(catId) => {
                setSelectedCategory(catId);
                // Scroll page slowly to product grids
                const productsSec = document.getElementById("catalog-grids-section");
                if (productsSec) {
                  productsSec.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />

            {/* Active Query Ribbon information widget */}
            {(selectedCategory || searchQuery.trim() !== "") && (
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-5 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Showing matches for:{" "}
                  <strong className="text-gray-800">
                    {searchQuery.trim() !== "" ? `"${searchQuery}"` : ""}
                    {selectedCategory ? ` [Category: ${selectedCategory}]` : ""}
                  </strong>
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery("");
                  }}
                  className="text-xs font-bold text-orange-500 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Products sections */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6" id="catalog-grids-section">
              
              {/* If search/category filter is operating, just display standard catalog results */}
              {selectedCategory || searchQuery.trim() !== "" ? (
                <div>
                  <h3 className="text-lg font-black text-gray-950 text-left mb-4 tracking-tight">SearchResults ({filteredProducts.length} items found)</h3>
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">No items match your criteria</p>
                      <p className="text-sm">Try searching for other fresh things like bananas, organic milk, or brown eggs.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                      {filteredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          cartQty={cart.find((item) => item.product.id === p.id)?.quantity || 0}
                          onAddToCart={handleAddToCart}
                          onRemoveFromCart={handleRemoveFromCart}
                          isWishlisted={wishlist.some((it) => it.id === p.id)}
                          onToggleWishlist={handleToggleWishlist}
                          onSelectProduct={(item) => setSelectedProduct(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* OTHERWISE structures bento blocks: Offers -> Featured -> Top Selling */
                <div className="gap-8 flex flex-col">
                  
                  {/* BEST OFFERS PANEL */}
                  {bestOffersSubset.length > 0 && (
                    <section className="text-left">
                      <div className="mb-4">
                        <span className="text-[10px] bg-orange-100 text-[#F97316] font-bold px-2 py-0.5 rounded uppercase font-black">Limited Promos</span>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight mt-1">Best Offers & Heavy Discounts</h3>
                        <p className="text-xs text-gray-400 font-semibold leading-none mt-1">Grab fresh items with peak price reductions today</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                        {bestOffersSubset.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            cartQty={cart.find((item) => item.product.id === p.id)?.quantity || 0}
                            onAddToCart={handleAddToCart}
                            onRemoveFromCart={handleRemoveFromCart}
                            isWishlisted={wishlist.some((it) => it.id === p.id)}
                            onToggleWishlist={handleToggleWishlist}
                            onSelectProduct={(item) => setSelectedProduct(item)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* FEATURED SELECTION */}
                  {featuredSubset.length > 0 && (
                    <section className="text-left">
                      <div className="mb-4">
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded uppercase font-black">Chef Curations</span>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight mt-1">Featured Essentials</h3>
                        <p className="text-xs text-gray-400 font-semibold leading-none mt-1">Gourmet ingredients and pristine household choices</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                        {featuredSubset.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            cartQty={cart.find((item) => item.product.id === p.id)?.quantity || 0}
                            onAddToCart={handleAddToCart}
                            onRemoveFromCart={handleRemoveFromCart}
                            isWishlisted={wishlist.some((it) => it.id === p.id)}
                            onToggleWishlist={handleToggleWishlist}
                            onSelectProduct={(item) => setSelectedProduct(item)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* TOP SELLING PRODUCTS */}
                  <section className="text-left">
                    <div className="mb-4">
                      <span className="text-[10px] bg-blue-105 text-blue-700 font-bold px-2 py-0.5 rounded uppercase font-black">All Catalog</span>
                      <h3 className="text-lg font-black text-gray-900 tracking-tight mt-1">Fresh Grocery Catalog</h3>
                      <p className="text-xs text-gray-400 font-semibold leading-none mt-1">Delivered to your doorstep in 15 minutes</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                      {products.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          cartQty={cart.find((item) => item.product.id === p.id)?.quantity || 0}
                          onAddToCart={handleAddToCart}
                          onRemoveFromCart={handleRemoveFromCart}
                          isWishlisted={wishlist.some((it) => it.id === p.id)}
                          onToggleWishlist={handleToggleWishlist}
                          onSelectProduct={(item) => setSelectedProduct(item)}
                        />
                      ))}
                    </div>
                  </section>

                </div>
              )}

            </div>
          </main>
        )}

        {/* 2. WISHLIST VIEW */}
        {activeTab === "wishlist" && (
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-left animate-fade-in">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h1 className="text-xl font-black text-gray-950 tracking-tight">Saved Wishlist items</h1>
                <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">Quick purchase your saved items anytime</p>
              </div>
              <button
                onClick={() => setActiveTab("home")}
                className="flex items-center space-x-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Go back Shopping</span>
              </button>
            </div>

            {wishlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-gray-150 rounded-3xl">
                <Heart className="h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-sm font-bold text-gray-800">Your savings folder is empty</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-[250px]">Explore the fresh groceries catalog and heart products to save them here for later!</p>
                <button
                  onClick={() => setActiveTab("home")}
                  className="mt-5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-xs px-5 py-2.5 shadow-md shadow-green-100 transition"
                >
                  Start Adding Items
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-5">
                {wishlist.map((p) => {
                  const cartItem = cart.find((x) => x.product.id === p.id);
                  return (
                    <div 
                      key={p.id}
                      className="group border border-gray-100 bg-white rounded-2xl p-3 flex flex-col justify-between hover:shadow-lg transition relative"
                    >
                      <button
                        onClick={() => handleToggleWishlist(p)}
                        className="absolute top-2 right-2 text-red-500 hover:text-gray-400 transition"
                        title="Remove"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>

                      <div className="cursor-pointer flex flex-col pt-2 items-center" onClick={() => setSelectedProduct(p)}>
                        <img src={p.image} alt={p.name} className="h-28 w-28 object-cover bg-gray-50 rounded-lg" />
                        
                        <div className="text-left mt-3 self-start w-full">
                          <p className="text-[10px] font-black text-orange-500 uppercase">{p.brand}</p>
                          <h4 className="text-xs font-bold text-gray-800 truncate">{p.name}</h4>
                          <p className="text-[10px] font-semibold text-gray-400">{p.weight}</p>
                          <div className="flex items-baseline space-x-1 mt-1">
                            <span className="text-sm font-black text-gray-900">₹{p.sellingPrice}</span>
                            {p.discount > 0 && <span className="text-[10px] text-gray-400 line-through">₹{p.marketPrice}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-gray-50">
                        {p.stock <= 0 ? (
                          <button disabled className="w-full rounded-xl bg-gray-100 text-gray-400 text-xs font-bold py-1.5 cursor-not-allowed">
                            Out of Stock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMoveWishlistToCart(p)}
                            className="w-full rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-xs py-1.5 transition uppercase"
                          >
                            Move to Basket
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* 3. PROFILE VIEW */}
        {activeTab === "profile" && (
          <UserProfile
            orders={orders}
            savedAddresses={savedAddresses}
            onAddAddress={handleAddAddressCoord}
            onRemoveAddress={handleRemoveAddressCoord}
            wishlist={wishlist}
            onRemoveFromWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onReorder={handleReorderPastItems}
            onTrackOrder={handleTrackExistingOrder}
            userName={userName}
            setUserName={setUserName}
            userPhone={userPhone}
            setUserPhone={setUserPhone}
            userEmail={userEmail}
            setUserEmail={setUserEmail}
            isCustomerLoggedIn={isCustomerLoggedIn}
            onCustomerLogin={handleCustomerLogin}
            onCustomerLogout={handleCustomerLogout}
          />
        )}

        {/* 4. ADMIN TAB */}
        {activeTab === "admin" && (!isCustomerLoggedIn || userEmail !== "himanshu712007@gmail.com" ? (
          <div className="mx-auto max-w-lg my-12 bg-white rounded-3xl p-8 border border-red-150 shadow-xl text-center">
            <span className="inline-block px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-black uppercase tracking-wider mb-4">
              Security Override
            </span>
            <h3 className="text-lg font-black text-gray-950 uppercase tracking-tight">Access Denied</h3>
            <p className="text-gray-500 font-medium text-xs mt-2 leading-relaxed">
              You must be logged in as the Administrator to decypher this terminal. Please log in on the Profile page first.
            </p>
            <button
              onClick={() => setActiveTab("home")}
              className="mt-6 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-lg shadow-green-100"
            >
              Fulfillment Hub
            </button>
          </div>
        ) : (
          <AdminPanel
            products={products}
            onAddProduct={handleAddProductAdmin}
            onDeleteProduct={handleDeleteProductAdmin}
            onUpdateStock={handleUpdateStockAdmin}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAssignPartner={handleAssignRiderPartner}
            riders={riders}
            setRiders={setRiders}
            isCustomerLoggedIn={isCustomerLoggedIn}
            userEmail={userEmail}
            onCustomerLogout={handleCustomerLogout}
          />
        ))}

        {/* 5. RIDER DASHBOARD TAB */}
        {activeTab === "rider" && (
          <RiderDashboard
            riders={riders}
            setRiders={setRiders}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAssignPartnerToOrder={handleAssignPartnerToOrder}
            onPassOrder={handlePassOrder}
            riderSession={riderSession}
            setRiderSession={setRiderSession}
          />
        )}

      </div>

      {/* --- FLOATING MODALS AND OVERLAYS --- */}

      {/* A. PRODUCT DETAILS modal */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        cartQty={selectedProduct ? (cart.find((item) => item.product.id === selectedProduct.id)?.quantity || 0) : 0}
        onAddToCart={handleAddToCart}
        onRemoveFromCart={handleRemoveFromCart}
        isWishlisted={selectedProduct ? wishlist.some((x) => x.id === selectedProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        allProducts={products}
        onProductClick={(p) => setSelectedProduct(p)}
      />

      {/* B. CART DRAWER list sheet */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveItemFromCart}
        onSaveForLater={handleSaveForLater}
        onProceedToCheckout={handleCheckoutProced}
        appliedPromo={appliedPromo}
        onApplyPromo={setAppliedPromo}
      />

      {/* C. 3-STEP CHECKOUT modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        savedAddresses={savedAddresses}
        onAddAddress={handleAddAddressCoord}
        selectedAddress={currentAddress}
        onSelectAddress={setCurrentAddress}
        totalAmount={cartTotal > 150 ? (cartTotal - (appliedPromo?.discountValue || 0) + (cartTotal > 200 ? 0 : 25) + 2) : cartTotal} // handle direct fallback calculation in visual payment summary
        onCompletePayment={handleCompleteOrderPayment}
      />

      {/* C.2 LOCATION ONBOARDING modal for new user signup / login */}
      <LocationOnboardingModal
        isOpen={showLocationOnboarding}
        onClose={() => setShowLocationOnboarding(false)}
        userName={userName}
        userPhone={userPhone}
        onAddAddress={handleAddAddressCoord}
      />

      {/* D. LIVE TRACKING TIMELINE sheet */}
      <OrderTracking
        isOpen={activeOrderForTracking !== null}
        onClose={() => setActiveOrderForTracking(null)}
        order={activeOrderForTracking}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onAssignPartnerToOrder={handleAssignPartnerToOrder}
      />

      {/* Footnote Branding statement */}
      <footer className="bg-gray-900 text-white mt-12 py-10 text-xs border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Logo details */}
            <div className="text-center md:text-left">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Smart<span className="text-orange-500">Cart</span>
              </span>
              <p className="text-gray-400 mt-1 max-w-sm">
                15 Minute Grocery Delivery Website supplying fresh fruits, crisps, and essential items instantly to coordinates.
              </p>
            </div>

            {/* Quick columns links */}
            <div className="flex flex-wrap gap-8">
              <div>
                <h4 className="font-bold text-gray-300 uppercase text-[10px] tracking-widest mb-2.5">Security Policies</h4>
                <p className="text-gray-400">✓ SSL Encrypted Payments</p>
                <p className="text-gray-400 mt-1">✓ PCI-DSS Certified</p>
              </div>
              <div>
                <h4 className="font-bold text-gray-300 uppercase text-[10px] tracking-widest mb-2.5">Quick Actions</h4>
                <button onClick={() => setActiveTab("home")} className="text-gray-400 hover:text-white block mt-1 hover:underline text-left cursor-pointer">Fulfillment Hub</button>
                {(isCustomerLoggedIn && userEmail === "himanshu712007@gmail.com") && (
                  <button onClick={() => setActiveTab("admin")} className="text-gray-400 hover:text-white block mt-1 hover:underline text-left text-tomato-500 font-bold cursor-pointer">Admin Portal</button>
                )}
              </div>
              <div className="max-w-xs">
                <h4 className="font-bold text-gray-300 uppercase text-[10px] tracking-widest mb-2.5">Support & Policy</h4>
                <p className="text-gray-400 font-sans">
                  Contact: <a href="mailto:smartcart.busi@gmail.com" className="text-orange-500 hover:underline font-semibold">smartcart.busi@gmail.com</a>
                </p>
                <p className="text-gray-400 mt-2 text-[11px] leading-relaxed">
                  <strong className="text-orange-400">No Return Policy:</strong> Due to the nature of 15-minute express delivery and perishable/fresh groceries, we enforce a strict no-return policy once orders are dispatched.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-6 border-t border-gray-800 text-center text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px]">
            <p>© 2026 SmartCart Logistics Inc. All rights reserved. Registered for test simulation.</p>
            <p className="flex items-center text-green-500 uppercase tracking-wide font-bold">
              ● Server Running (Port 3000 Ingress active)
            </p>
          </div>

        </div>
      </footer>

    </div>
  );
}
