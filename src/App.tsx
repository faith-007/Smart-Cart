import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from "./data";
import { Product, Category, CartItem, Address, Order, Rider, ComboDeal } from "./types";
import { calculatePricing } from "./lib/pricing";

// Component Imports
import Header from "./components/Header";
import Hero from "./components/Hero";
import MobilePromoBanner from "./components/MobilePromoBanner";
import Categories from "./components/Categories";
import ProductCard from "./components/ProductCard";
import PetProductRequest from "./components/PetProductRequest";
import ProductRequestBanner from "./components/ProductRequestBanner";
import ProductDetailsModal from "./components/ProductDetailsModal";
import CartDrawer from "./components/CartDrawer";
import CheckoutModal from "./components/CheckoutModal";
import OrderTracking from "./components/OrderTracking";
import UserProfile from "./components/UserProfile";
import AdminPanel from "./components/AdminPanel";
import RiderDashboard from "./components/RiderDashboard";
import LocationOnboardingModal from "./components/LocationOnboardingModal";
import ComboCard from "./components/ComboCard";
import { 
  calculateDistance,
  fetchDeliveryZoneSettings,
  saveDeliveryZoneSettings,
  syncOrderToFirebase, 
  fetchOrdersFromFirebase, 
  auth, 
  db,
  fetchRidersFromFirebase, 
  syncRiderToFirebase, 
  subscribeToRiders,
  fetchUserProfileFromFirebase,
  fetchSavedAddressesFromFirebase,
  saveAddressToFirebase,
  deleteAddressFromFirebase,
  setDefaultAddressInFirebase,
  syncUserProfileToFirebase,
  clearAllAddressesFromFirebase,
  syncProductToFirebase,
  deleteProductFromFirebase,
  bootstrapProductsIfEmpty,
  onProductsSnapshot,
  addProduct,
  updateProduct,
  deleteProduct,
  fetchProducts,
  subscribeToProducts,
  subscribeToCombos,
  saveComboToFirebase,
  deleteComboFromFirebase,
  trackProductView,
  trackProductSearchClick,
  trackProductAddToCart,
  trackOrderPlacements
} from "./lib/firebase";
import {
  sortProductsByPopularity,
  getSmartSearchMatches,
  getRelatedRecommendations,
  getPersonalizedRecommendations,
  smartShuffleAndInterleave
} from "./lib/recommendations";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onSnapshot, collection, query, where } from "firebase/firestore";

// Icons for general UI
import { Sparkles, Heart, ShoppingBag, ShieldAlert, ArrowLeft, Trash2, Home, AlertCircle, RefreshCw, Star, Info, X, User, Gift } from "lucide-react";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Root States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState<boolean>(false);
  const [shuffledProductIds, setShuffledProductIds] = useState<string[]>([]);
  const hasInitializedShuffleRef = useRef<boolean>(false);
  const [combos, setCombos] = useState<ComboDeal[]>([]);

  // Dynamically sort categories by item count (descending order)
  const sortedCategories = React.useMemo(() => {
    return [...INITIAL_CATEGORIES].sort((a, b) => {
      const countA = a.id === "combos"
        ? combos.length
        : products.filter((p) => p.category === a.id).length;
      const countB = b.id === "combos"
        ? combos.length
        : products.filter((p) => p.category === b.id).length;
      return countB - countA;
    });
  }, [products, combos]);

  // Calculate stable random shuffle with category interleaving ONCE on initial load
  useEffect(() => {
    if (productsLoaded && products.length > 0 && !hasInitializedShuffleRef.current) {
      hasInitializedShuffleRef.current = true;
      const shuffled = smartShuffleAndInterleave(products);
      setShuffledProductIds(shuffled.map((p) => p.id));
    }
  }, [productsLoaded, products]);

  // Map the page-load static shuffled sequence to real-time updated products
  const homepageProducts = React.useMemo(() => {
    if (shuffledProductIds.length === 0) {
      return products;
    }
    const productMap = new Map<string, Product>();
    for (const p of products) {
      if (p && p.id) {
        productMap.set(p.id, p);
      }
    }

    const ordered: Product[] = [];
    for (const id of shuffledProductIds) {
      const p = productMap.get(id);
      if (p) {
        ordered.push(p);
      }
    }

    // Append any brand new items that are dynamically added in real-time
    const shuffledSet = new Set(shuffledProductIds);
    for (const p of products) {
      if (p && p.id && !shuffledSet.has(p.id)) {
        ordered.push(p);
      }
    }

    return ordered;
  }, [products, shuffledProductIds]);

  // --- Real-time Inventory Coordination ---
  useEffect(() => {
    let unsubscribeProducts: (() => void) | null = null;
    let unsubscribeCombos: (() => void) | null = null;
    
    async function initInventorySync() {
      try {
        console.log("[STARTUP] Loading products...");
        console.log("[Inventory] Firestore Connected");
        console.log("[Inventory] Real-Time Sync Active");
        
        // Fetch products directly as single source of truth from Firestore
        const dbProducts = await fetchProducts();
        console.log(`[Inventory] Product Count: ${dbProducts.length}`);
        
        setProducts(sortProductsByPopularity(dbProducts));
        setProductsLoaded(true);
        
        // Setup real-time Firestore sync using subscriber mapping
        unsubscribeProducts = subscribeToProducts((updatedProductsList) => {
          setProducts(sortProductsByPopularity(updatedProductsList));
          setProductsLoaded(true);
        });

        // Setup real-time combos sync
        unsubscribeCombos = subscribeToCombos((updatedCombosList) => {
          setCombos(updatedCombosList);
        });
      } catch (err) {
        console.error("Failed to initialize Firebase inventory sync:", err);
      }
    }
    
    initInventorySync();
    
    return () => {
      if (unsubscribeProducts) {
        unsubscribeProducts();
      }
      if (unsubscribeCombos) {
        unsubscribeCombos();
      }
    };
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<string>("home"); // "home" | "wishlist" | "profile" | "admin"
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // --- Address States ---
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const [showLocationOnboarding, setShowLocationOnboarding] = useState<boolean>(false);

  // --- Delivery Zone Settings & Serviceability ---
  const [deliveryZoneSettings, setDeliveryZoneSettings] = useState<any>({ storeLat: 28.0793575, storeLng: 80.4672899, deliveryRadius: 3.0 });
  const [showServiceNotAvailableModal, setShowServiceNotAvailableModal] = useState<boolean>(false);

  useEffect(() => {
    fetchDeliveryZoneSettings().then((settings) => {
      if (settings) {
        setDeliveryZoneSettings(settings);
      }
    }).catch(err => {
      console.warn("Could not load delivery zone settings from Firestore:", err);
    });
  }, []);

  const handleUpdateDeliveryZoneSettings = async (newSettings: any) => {
    await saveDeliveryZoneSettings(newSettings);
    setDeliveryZoneSettings(newSettings);
    // Refresh address serviceability list dynamically so that all addresses reflect changes instantly
    const user = auth.currentUser;
    if (user) {
      const fresh = await fetchSavedAddressesFromFirebase(user.uid);
      setSavedAddresses(fresh);
      localStorage.setItem("smartcart_addresses", JSON.stringify(fresh));
      if (currentAddress) {
        const matching = fresh.find(a => a.id === currentAddress.id);
        if (matching) {
          setCurrentAddress(matching);
        }
      }
    }
  };

  // --- Store Status in IST (8:00 AM - 9:00 PM IST) ---
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(() => {
    const now = new Date();
    // UTC time in ms
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    // IST = UTC + 5:30 (5.5 * 3600000)
    const istTime = new Date(utcTime + (5.5 * 3600000));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes >= 8 * 60 && totalMinutes < 21 * 60;
  });
  const [showStoreClosedModal, setShowStoreClosedModal] = useState<boolean>(false);

  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utcTime + (5.5 * 3600000));
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      const isOpen = totalMinutes >= 8 * 60 && totalMinutes < 21 * 60;
      setIsStoreOpen(isOpen);
    };
    checkStoreStatus();
    const interval = setInterval(checkStoreStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Open Modals/Drawers States ---
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [activeOrderForTracking, setActiveOrderForTracking] = useState<Order | null>(null);
  const [activePolicy, setActivePolicy] = useState<"privacy" | "terms" | "refund" | null>(null);
  const [newOrderNotifications, setNewOrderNotifications] = useState<Order[]>([]);

  // --- Order States ---
  const [orders, setOrders] = useState<Order[]>([]);

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

  // --- Personalization Tracking States ---
  const [browsedCategories, setBrowsedCategories] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("smartcart_browsed_categories");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [searchedKeywords, setSearchedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("smartcart_searched_keywords");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("smartcart_browsed_categories", JSON.stringify(browsedCategories));
  }, [browsedCategories]);

  useEffect(() => {
    localStorage.setItem("smartcart_searched_keywords", JSON.stringify(searchedKeywords));
  }, [searchedKeywords]);

  const recordSearchQuery = (query: string) => {
    if (!query || query.trim() === "") return;
    const normalized = query.trim().toLowerCase();
    setSearchedKeywords(prev => {
      if (prev.includes(normalized)) return prev;
      return [normalized, ...prev].slice(0, 10);
    });
  };

  // Track product details modal opening & browse behaviors
  useEffect(() => {
    if (selectedProduct) {
      // Track view atomically in Firestore
      trackProductView(selectedProduct.id);

      // Track locally for recommendation weights
      const cat = selectedProduct.category;
      if (cat) {
        setBrowsedCategories(prev => ({
          ...prev,
          [cat]: (prev[cat] || 0) + 1
        }));
      }

      // If there is an active search, record search click analytics
      if (searchQuery.trim() !== "") {
        trackProductSearchClick(selectedProduct.id);
        recordSearchQuery(searchQuery);
      }
    }
  }, [selectedProduct?.id]);

  // Debounced Search Query capture
  useEffect(() => {
    if (searchQuery.trim().length >= 3) {
      const timer = setTimeout(() => {
        recordSearchQuery(searchQuery);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  // 1. Role-based Navigation Guarding
  useEffect(() => {
    if (activeTab === "rider" && userRole !== "Rider") {
      console.warn("[SmartCart RBAC] Prevented access to Rider Portal for non-Rider.");
      if (userRole === "Admin") {
        setActiveTab("admin");
      } else {
        setActiveTab("home");
      }
    } else if (activeTab === "admin" && userRole !== "Admin") {
      console.warn("[SmartCart RBAC] Prevented access to Admin Portal for non-Admin.");
      if (userRole === "Rider") {
        setActiveTab("rider");
      } else {
        setActiveTab("home");
      }
    }
  }, [activeTab, userRole]);

  // 2. State-to-URL Synchronization Effect (State changes push new routes)
  useEffect(() => {
    const path = location.pathname;
    let targetPath = "/";

    if (activeTab && activeTab !== "home") {
      targetPath = `/${activeTab}`;
    }

    if (isCartOpen) {
      targetPath = "/cart";
    } else if (isCheckoutOpen) {
      targetPath = "/checkout";
    } else if (selectedProduct) {
      targetPath = `/product/${selectedProduct.id}`;
    } else if (activeOrderForTracking) {
      targetPath = `/tracking/${activeOrderForTracking.id}`;
    }

    if (targetPath !== path && !path.startsWith("/api/")) {
      navigate(targetPath);
    }

    // Synchronize query parameters for Categories & Search Queries
    const currentCategory = searchParams.get("category");
    const currentSearch = searchParams.get("search") || "";
    const categoryDifference = (selectedCategory || "") !== (currentCategory || "");
    const searchDifference = searchQuery !== currentSearch;

    if (categoryDifference || searchDifference) {
      const nextParams = new URLSearchParams(searchParams);
      if (selectedCategory) {
        nextParams.set("category", selectedCategory);
      } else {
        nextParams.delete("category");
      }
      if (searchQuery) {
        nextParams.set("search", searchQuery);
      } else {
        nextParams.delete("search");
      }
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, isCartOpen, isCheckoutOpen, selectedProduct?.id, activeOrderForTracking?.id, selectedCategory, searchQuery]);

  // 3. URL-to-State Synchronization Effect (Back button pops state correctly)
  useEffect(() => {
    const path = location.pathname;

    // View tab sync
    if (path === "/wishlist") {
      setActiveTab("wishlist");
    } else if (path === "/profile") {
      setActiveTab("profile");
    } else if (path === "/admin") {
      setActiveTab("admin");
    } else if (path === "/rider") {
      setActiveTab("rider");
    } else if (path === "/" || path === "/home") {
      setActiveTab("home");
    }

    // Modal & Drawer drawers synchronization
    setIsCartOpen(path === "/cart");
    setIsCheckoutOpen(path === "/checkout");

    // Product Details sync
    const productMatch = path.match(/^\/product\/([^/]+)/);
    if (productMatch) {
      const pId = productMatch[1];
      const match = products.find((prod) => prod.id === pId);
      if (match) {
        setSelectedProduct(match);
      }
    } else {
      setSelectedProduct(null);
    }

    // Tracking Panel sync
    const trackingMatch = path.match(/^\/tracking\/([^/]+)/);
    if (trackingMatch) {
      const oId = trackingMatch[1];
      const match = orders.find((ord) => ord.id === oId);
      if (match) {
        setActiveOrderForTracking(match);
      }
    } else {
      setActiveOrderForTracking(null);
    }

    // Category and query synchronization
    const categoryQuery = searchParams.get("category");
    const searchTermQuery = searchParams.get("search") || "";
    setSelectedCategory(categoryQuery);
    setSearchQuery(searchTermQuery);

  }, [location.pathname, searchParams, products, orders.length]);

  // Load cart, wishlist, addresses, and orders on boot (with real-time Supabase sync)
  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem("smartcart_customer_logged_in") === "true";
      let finalCartKey = "smartcart_cart_anonymous";
      let finalWishlistKey = "smartcart_wishlist_anonymous";

      if (loggedIn) {
        setIsCustomerLoggedIn(true);
        const name = localStorage.getItem("smartcart_customer_name") || "";
        const phone = localStorage.getItem("smartcart_customer_phone") || "";
        const email = localStorage.getItem("smartcart_customer_email") || "";
        setUserName(name);
        setUserPhone(phone);
        setUserEmail(email);

        const currentUid = localStorage.getItem("smartcart_current_uid");
        if (currentUid) {
          finalCartKey = `smartcart_cart_${currentUid}`;
          finalWishlistKey = `smartcart_wishlist_${currentUid}`;
        } else if (email) {
          finalCartKey = `smartcart_cart_sim_${email.replace(/[@.]/g, "_")}`;
          finalWishlistKey = `smartcart_wishlist_sim_${email.replace(/[@.]/g, "_")}`;
        } else if (phone) {
          finalCartKey = `smartcart_cart_sim_${phone.replace(/\D/g, "")}`;
          finalWishlistKey = `smartcart_wishlist_sim_${phone.replace(/\D/g, "")}`;
        }
        
        const savedAddrs = localStorage.getItem("smartcart_addresses");
        if (savedAddrs) {
          const parsed = JSON.parse(savedAddrs);
          setSavedAddresses(parsed);
          if (parsed.length > 0) {
            setCurrentAddress(parsed.find((a: any) => a.isDefault) || parsed[0]);
          }
        }
      } else {
        setIsCustomerLoggedIn(false);
        setUserName("");
        setUserPhone("");
        setUserEmail("");
        setSavedAddresses([]);
        setCurrentAddress(null);
      }

      const savedCart = localStorage.getItem(finalCartKey) || localStorage.getItem("smartcart_cart");
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWishlist = localStorage.getItem(finalWishlistKey) || localStorage.getItem("smartcart_wishlist");
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

    } catch (e) {
      console.error("Failed to load persisted localStorage states", e);
    }

    // Initializing real-time Firestore tracking for riders with automatic fallback seed
    const unsubscribeRiders = subscribeToRiders(async (ridersList) => {
      if (ridersList && ridersList.length > 0) {
        setRiders(ridersList);
        localStorage.setItem("smartcart_riders_db", JSON.stringify(ridersList));
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
        
        for (const r of defaultRidersList) {
          await syncRiderToFirebase(r).catch((e) => console.warn("Seed write skipped:", e));
        }
        setRiders(defaultRidersList);
        localStorage.setItem("smartcart_riders_db", JSON.stringify(defaultRidersList));
      }
    });

    return () => {
      unsubscribeRiders();
    };
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

  const getCartStorageKey = () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return `smartcart_cart_${currentUser.uid}`;
    }
    if (isCustomerLoggedIn) {
      if (userEmail) {
        return `smartcart_cart_sim_${userEmail.replace(/[@.]/g, "_")}`;
      }
      if (userPhone) {
        return `smartcart_cart_sim_${userPhone.replace(/\D/g, "")}`;
      }
    }
    return "smartcart_cart_anonymous";
  };

  const getWishlistStorageKey = () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return `smartcart_wishlist_${currentUser.uid}`;
    }
    if (isCustomerLoggedIn) {
      if (userEmail) {
        return `smartcart_wishlist_sim_${userEmail.replace(/[@.]/g, "_")}`;
      }
      if (userPhone) {
        return `smartcart_wishlist_sim_${userPhone.replace(/\D/g, "")}`;
      }
    }
    return "smartcart_wishlist_anonymous";
  };

  // Sync auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[SmartCart] Auth state synchronized: User logged in", firebaseUser.email);
        
        // Safeguard state boundary: if user switches, zero/purge old details to block leakage
        if (localStorage.getItem("smartcart_current_uid") !== firebaseUser.uid) {
          setUserName("");
          setUserPhone("");
          setUserEmail("");
          setSavedAddresses([]);
          setCurrentAddress(null);
          setOrders([]);
          localStorage.removeItem("smartcart_customer_name");
          localStorage.removeItem("smartcart_customer_phone");
          localStorage.removeItem("smartcart_customer_email");
          localStorage.removeItem("smartcart_addresses");
        }
        localStorage.setItem("smartcart_current_uid", firebaseUser.uid);
        
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
        
        let finalAddresses = [];
        try {
          finalAddresses = await fetchSavedAddressesFromFirebase(firebaseUser.uid);
          if (finalAddresses.length === 0 && loadedProfile?.addresses && loadedProfile.addresses.length > 0) {
            console.log("[SmartCart addresses] Migrating legacy addresses to Firestore subcollection...");
            for (const addr of loadedProfile.addresses) {
              await saveAddressToFirebase(firebaseUser.uid, addr, !!addr.isDefault);
            }
            finalAddresses = await fetchSavedAddressesFromFirebase(firebaseUser.uid);
          }
        } catch (e) {
          console.error("Error fetching/migrating addresses on login:", e, firebaseUser.uid);
          finalAddresses = loadedProfile?.addresses || [];
        }

        setIsCustomerLoggedIn(true);
        setUserRole(profileRole);
        setUserName(finalName);
        setUserEmail(finalEmail);
        setUserPhone(finalPhone);
        setSavedAddresses(finalAddresses);
        if (finalAddresses.length > 0) {
          const defaultAddr = finalAddresses.find(a => a.isDefault === true) || finalAddresses[0];
          setCurrentAddress(defaultAddr);
          setShowLocationOnboarding(false);
        } else {
          setCurrentAddress(null);
          // Do not automatically pop up location onboarding on the starting page of the website
          setShowLocationOnboarding(false);
        }

        localStorage.setItem("smartcart_customer_logged_in", "true");
        localStorage.setItem("smartcart_customer_name", finalName);
        localStorage.setItem("smartcart_customer_email", finalEmail);
        localStorage.setItem("smartcart_customer_phone", finalPhone);
        localStorage.setItem("smartcart_addresses", JSON.stringify(finalAddresses));

        // Load isolated cart and wishlist (Security Isolation Audit)
        const cartKey = `smartcart_cart_${firebaseUser.uid}`;
        const savedCart = localStorage.getItem(cartKey);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        } else {
          setCart([]);
        }

        const wishlistKey = `smartcart_wishlist_${firebaseUser.uid}`;
        const savedWishlist = localStorage.getItem(wishlistKey);
        if (savedWishlist) {
          setWishlist(JSON.parse(savedWishlist));
        } else {
          setWishlist([]);
        }

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
        localStorage.removeItem("smartcart_current_uid");

        // Load anonymous/guest cart and wishlist safely (Security Isolation Audit)
        const savedCartDef = localStorage.getItem("smartcart_cart_anonymous");
        setCart(savedCartDef ? JSON.parse(savedCartDef) : []);

        const savedWishlistDef = localStorage.getItem("smartcart_wishlist_anonymous");
        setWishlist(savedWishlistDef ? JSON.parse(savedWishlistDef) : []);
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

        console.log("[SmartCart Debug] Realtime Sync Triggered: Background synchronization tick initiated.");

        // Admin only poll for all orders, Customers and Riders use secure scoped queries
        const queryAll = isAdminRole;
        
        const effectiveRole = isAdminRole ? "Admin" : (isRiderRole ? "Rider" : "Customer");
        const dbOrders = await fetchOrdersFromFirebase(effectiveRole, queryAll);
        if (dbOrders && active) {
          let merged: Order[] = [];
          setOrders((prevOrders) => {
            const mergedMap = new Map<string, Order>();
            
            dbOrders.forEach((dbO) => {
              mergedMap.set(dbO.id, dbO);
            });
            
            prevOrders.forEach((localO) => {
              const dbO = mergedMap.get(localO.id);
              if (dbO) {
                if (localO.status === "cancelled" && dbO.status !== "cancelled") {
                  mergedMap.set(localO.id, {
                    ...dbO,
                    status: "cancelled",
                    delivery_status: "cancelled",
                    cancelledAt: localO.cancelledAt,
                    cancelled_at: localO.cancelled_at,
                    rider_id: null,
                    rider_name: null,
                    riderId: null,
                    riderName: null,
                    deliveryPartner: undefined
                  });
                }
              } else {
                mergedMap.set(localO.id, localO);
              }
            });
            
            merged = Array.from(mergedMap.values());
            merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return merged;
          });

          // Sync the active tracking order
          setActiveOrderForTracking((prevTrack) => {
            if (!prevTrack) return null;
            const fresh = merged.find((o) => o.id === prevTrack.id);
            if (fresh) {
              if (JSON.stringify(fresh) !== JSON.stringify(prevTrack)) {
                return fresh;
              }
            }
            return prevTrack;
          });

          // Save list to dynamic local storage key
          localStorage.setItem(getOrdersStorageKey(), JSON.stringify(merged));
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

  // Play custom synthesized melodic double chime for unassigned order alert
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.3);

      setTimeout(() => {
        try {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
          gain2.gain.setValueAtTime(0.25, audioCtx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
          
          osc2.start();
          osc2.stop(audioCtx.currentTime + 0.4);
        } catch (e) {}
      }, 150);
    } catch (error) {
      console.warn("Browser AudioContext not initiated or blocked:", error);
    }
  };

  // Real-time Firestore unassigned orders listener for Riders
  useEffect(() => {
    const isRiderRole = userRole === "Rider" || activeTab === "rider";
    const user = auth.currentUser;
    if (!isRiderRole || !user) {
      setNewOrderNotifications([]);
      return;
    }

    console.log("[SmartCart Listener] Initializing real-time Firestore tracking for rider notifications...");
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("status", "==", "placed"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeUnassignedOrders: Order[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Order;
        const hasRider = data.riderId || data.rider_id;
        if (!hasRider) {
          activeUnassignedOrders.push({ ...data, id: docSnap.id });
        }
      });

      // Update local orders list so that they populate in Rider Dashboard in real time
      setOrders((prev) => {
        const orderMap = new Map<string, Order>();
        prev.forEach((o) => orderMap.set(o.id, o));
        
        // Exclude unassigned orders that got accepted/claimed by someone else (i.e. status changed, or rider claim occurred)
        // But keep unassigned orders which are still placed
        activeUnassignedOrders.forEach((o) => orderMap.set(o.id, o));
        return Array.from(orderMap.values());
      });

      // Alert Rider with notification and audio if new orders arrive
      setNewOrderNotifications((prevNotifs) => {
        const currentUnassignedIds = new Set(activeUnassignedOrders.map(o => o.id));
        // Remove any old notification if that order is no longer in placing state (accepted by someone else)
        const filteredPrev = prevNotifs.filter(n => currentUnassignedIds.has(n.id));

        const newlyArrived: Order[] = [];
        activeUnassignedOrders.forEach((o) => {
          const wasNotified = prevNotifs.some(n => n.id === o.id);
          if (!wasNotified) {
            newlyArrived.push(o);
            playNotificationSound();
          }
        });

        return [...filteredPrev, ...newlyArrived];
      });
    }, (err) => {
      console.warn("Firestore subscription error:", err);
    });

    return () => {
      unsubscribe();
    };
  }, [userRole, activeTab, auth.currentUser]);

  // Save states to localStorage on transitions
  const saveCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    try {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(updatedCart));
    } catch (e) {}
  };

  const saveWishlist = (updatedWishlist: Product[]) => {
    setWishlist(updatedWishlist);
    try {
      localStorage.setItem(getWishlistStorageKey(), JSON.stringify(updatedWishlist));
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
    if (!isCustomerLoggedIn) {
      alert("Please login to continue.");
      setActiveTab("profile");
      return;
    }

    // Track click to add-to-cart in analytics database
    trackProductAddToCart(product.id);

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

  const handleAddAddressCoord = async (addrInput: Omit<Address, "id"> | Address, specifiedIsDefault?: boolean) => {
    const isEditing = "id" in addrInput && !!addrInput.id;
    const uid = auth.currentUser?.uid || null;
    
    // Requirement 8: Add console logs (UID and payload)
    console.log("[SmartCart Address DB] Current user UID:", uid);
    console.log("[SmartCart Address DB] Address payload:", addrInput);

    if (auth.currentUser) {
      try {
        const isDefault = specifiedIsDefault !== undefined ? specifiedIsDefault : (savedAddresses.length === 0 || !!(addrInput as Address).isDefault);
        
        // Requirement 4 & 5: Ensure correct uid and path
        const saved = await saveAddressToFirebase(auth.currentUser.uid, addrInput, isDefault);
        
        // Requirement 8: Firestore write success log
        console.log("[SmartCart Address DB] Firestore write success. Saved address details:", saved);

        // Requirement 6: Refetch addresses from Firestore
        const fresh = await fetchSavedAddressesFromFirebase(auth.currentUser.uid);
        console.log("[SmartCart Address DB] Refetched addresses List:", fresh);

        // Requirement 6: Update savedAddresses state & localStorage
        setSavedAddresses(fresh);
        localStorage.setItem("smartcart_addresses", JSON.stringify(fresh));

        // Requirement 10: Automatically load the default address or newly saved address
        if (isDefault || !currentAddress || currentAddress.id === saved.id) {
          setCurrentAddress(saved);
        } else {
          const found = fresh.find(a => a.id === saved.id);
          if (found) setCurrentAddress(found);
        }

        // Requirements 6 & 9: Sync to user profile collection
        try {
          await syncUserProfileToFirebase({
            userId: auth.currentUser.uid,
            phone: userPhone,
            name: userName,
            email: userEmail,
            addresses: fresh,
            role: userRole as any,
          });
        } catch (err) {
          console.warn("[SmartCart Address DB] Could not sync addresses array to user profile", err);
        }

        if (saved && saved.serviceable === false) {
          setShowServiceNotAvailableModal(true);
        }

        // Return the saved address to let callers know it's successfully complete
        return saved;
      } catch (error) {
        // Requirement 8: Firestore write failure log
        console.error("[SmartCart Address DB] Firestore write failure:", error);
        throw error;
      }
    } else {
      const newAddr: Address = {
        ...addrInput,
        id: isEditing ? (addrInput as Address).id : `addr-${Date.now()}`,
        isDefault: specifiedIsDefault !== undefined ? specifiedIsDefault : (savedAddresses.length === 0 || !!(addrInput as Address).isDefault),
      } as Address;

      let serviceable = true;
      if (typeof newAddr.lat === "number" && typeof newAddr.lng === "number") {
        const dist = calculateDistance(newAddr.lat, newAddr.lng, deliveryZoneSettings.storeLat, deliveryZoneSettings.storeLng);
        serviceable = dist <= deliveryZoneSettings.deliveryRadius;
      }
      newAddr.serviceable = serviceable;

      const updated = isEditing
        ? savedAddresses.map((a) => (a.id === newAddr.id ? newAddr : a))
        : [...savedAddresses, newAddr];
      
      const cleaned = (specifiedIsDefault || newAddr.isDefault)
        ? updated.map(a => ({ ...a, isDefault: a.id === newAddr.id }))
        : updated;

      saveAddresses(cleaned);
      setCurrentAddress(newAddr);

      if (newAddr.serviceable === false) {
        setShowServiceNotAvailableModal(true);
      }

      return newAddr;
    }
  };

  const handleSelectAddress = (addr: Address | null) => {
    if (addr && addr.serviceable === false) {
      setShowServiceNotAvailableModal(true);
      return;
    }
    setCurrentAddress(addr);
  };

  const handleRemoveAddressCoord = async (id: string) => {
    if (isCustomerLoggedIn && auth.currentUser) {
      await deleteAddressFromFirebase(auth.currentUser.uid, id);
      const fresh = await fetchSavedAddressesFromFirebase(auth.currentUser.uid);
      setSavedAddresses(fresh);
      localStorage.setItem("smartcart_addresses", JSON.stringify(fresh));
      if (currentAddress?.id === id) {
        const nextDefault = fresh.find(a => a.isDefault === true) || fresh[0] || null;
        setCurrentAddress(nextDefault);
      }
      try {
        await syncUserProfileToFirebase({
          userId: auth.currentUser.uid,
          phone: userPhone,
          name: userName,
          email: userEmail,
          addresses: fresh,
          role: userRole as any,
        });
      } catch (err) {
        console.warn("Could not sync addresses array to user profile after deletion", err);
      }
    } else {
      const updated = savedAddresses.filter((a) => a.id !== id);
      saveAddresses(updated);
      if (currentAddress?.id === id) {
        if (updated.length > 0) {
          setCurrentAddress(updated[0]);
        } else {
          setCurrentAddress(null);
        }
      }
    }
  };

  const handleSetDefaultAddressCoord = async (id: string) => {
    if (isCustomerLoggedIn && auth.currentUser) {
      await setDefaultAddressInFirebase(auth.currentUser.uid, id);
      const fresh = await fetchSavedAddressesFromFirebase(auth.currentUser.uid);
      setSavedAddresses(fresh);
      localStorage.setItem("smartcart_addresses", JSON.stringify(fresh));
      const nextDefault = fresh.find(a => a.id === id) || null;
      if (nextDefault) {
        setCurrentAddress(nextDefault);
      }
      try {
        await syncUserProfileToFirebase({
          userId: auth.currentUser.uid,
          phone: userPhone,
          name: userName,
          email: userEmail,
          addresses: fresh,
          role: userRole as any,
        });
      } catch (err) {
        console.warn("Could not sync addresses array to user profile after set default", err);
      }
    } else {
      const updated = savedAddresses.map((a) => ({ ...a, isDefault: a.id === id }));
      saveAddresses(updated);
      const nextDefault = updated.find(a => a.id === id) || null;
      if (nextDefault) {
        setCurrentAddress(nextDefault);
      }
    }
  };

  const handleResetAddresses = async () => {
    if (isCustomerLoggedIn && auth.currentUser) {
      try {
        await clearAllAddressesFromFirebase(auth.currentUser.uid);
        const fresh = await fetchSavedAddressesFromFirebase(auth.currentUser.uid);
        setSavedAddresses(fresh);
        setCurrentAddress(null);
        localStorage.setItem("smartcart_addresses", JSON.stringify([]));
        
        try {
          await syncUserProfileToFirebase({
            userId: auth.currentUser.uid,
            phone: userPhone,
            name: userName,
            email: userEmail,
            addresses: [],
            role: userRole as any,
          });
        } catch (err) {
          console.warn("[SmartCart] Error syncing user profile after reset:", err);
        }
        console.log("[SmartCart] Address register reset successfully.");
      } catch (err) {
        console.error("Failed to reset address register:", err);
        alert("Failed to reset address register. Please try again.");
      }
    } else {
      saveAddresses([]);
      setCurrentAddress(null);
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
      // Automatically load the default address and avoid prompting again
      const defaultAddr = adrs.find((a: any) => a.isDefault) || adrs[0];
      setCurrentAddress(defaultAddr);
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
    // 1. Log: Logout button clicked
    console.log("Logout button clicked");

    // 2. Log: Logout function started
    console.log("Logout function started");

    try {
      // Clear local storage customer, rider, and admin session keys
      localStorage.removeItem("smartcart_customer_logged_in");
      localStorage.removeItem("smartcart_customer_name");
      localStorage.removeItem("smartcart_customer_phone");
      localStorage.removeItem("smartcart_customer_email");
      localStorage.removeItem("smartcart_addresses");
      localStorage.removeItem("smartcart_orders");
      localStorage.removeItem("smartcart_rider_session");
      localStorage.removeItem("smartcart_admin_logged_in");
      localStorage.removeItem("smartcart_current_uid");

      // Sanitary cleanup of other user/simulated order keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("smartcart_orders_") || 
          key.startsWith("smartcart_addresses_") || 
          key.startsWith("smartcart_cart_") || 
          key.startsWith("smartcart_wishlist_")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (e: any) {
      console.error("Error clearing local storage:", e);
    }

    // 3. Log: Local storage cleared
    console.log("Local storage cleared");

    try {
      sessionStorage.clear();
    } catch (e: any) {
      console.error("Error clearing session storage:", e);
    }

    // 4. Log: Session storage cleared
    console.log("Session storage cleared");

    // Put rider off-duty on logout as a safety measure if they are logged in
    if (riderSession) {
      try {
        setRiders((prev) => {
          const updated = prev.map((r) => r.id === riderSession.id ? { ...r, isActiveOnDuty: false } : r);
          localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
          return updated;
        });
      } catch (e: any) {
        console.error("Error putting rider off-duty:", e);
      }
    }

    // 5. Update React state immediately so UI updates without refreshing
    setIsCustomerLoggedIn(false);
    setUserRole("Customer");
    setUserName("");
    setUserEmail("");
    setUserPhone("");
    setSavedAddresses([]);
    setCurrentAddress(null);
    setOrders([]);
    setRiderSession(null);

    // Load guest/anonymous cart & wishlist
    const savedCartDef = localStorage.getItem("smartcart_cart_anonymous");
    setCart(savedCartDef ? JSON.parse(savedCartDef) : []);
    const savedWishlistDef = localStorage.getItem("smartcart_wishlist_anonymous");
    setWishlist(savedWishlistDef ? JSON.parse(savedWishlistDef) : []);

    // 6. Log: Authentication state updated
    console.log("Authentication state updated");

    // 7. Redirect to home page
    setActiveTab("home");

    // 8. Log: Redirect completed
    console.log("Redirect completed");

    // 9. Call Firebase Auth sign out method
    signOut(auth)
      .then(() => {
        // 10. Log: Firebase sign-out completed
        console.log("Firebase sign-out completed");
      })
      .catch((err) => {
        // 11. Error handling: Log complete error instead of failing silently
        console.error("Error occurred during logout:", err);
      });
  };

  // --- Checkout and Order Processing Handlers ---

  const handleCheckoutProced = () => {
    // Block checkout proceed if store is closed
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (5.5 * 3600000));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const isCurrentlyOpen = totalMinutes >= 8 * 60 && totalMinutes < 21 * 60;

    if (!isCurrentlyOpen) {
      setIsCartOpen(false);
      setShowStoreClosedModal(true);
      return;
    }

    setIsCartOpen(false);
    if (!isCustomerLoggedIn) {
      alert("Please login to continue.");
      setActiveTab("profile");
      return;
    }
    // Automatically select default address if not currently set
    let targetAddress = currentAddress;
    if (savedAddresses && savedAddresses.length > 0) {
      if (!targetAddress || !savedAddresses.some(a => a.id === targetAddress.id)) {
        const defaultAddr = savedAddresses.find(a => a.isDefault === true) || savedAddresses[0];
        targetAddress = defaultAddr;
        setCurrentAddress(defaultAddr);
      }
    }

    if (targetAddress) {
      const lat = targetAddress.lat;
      const lng = targetAddress.lng;
      const storeLat = deliveryZoneSettings?.storeLat ?? 28.0793575;
      const storeLng = deliveryZoneSettings?.storeLng ?? 80.4672899;
      const radiusLimit = deliveryZoneSettings?.deliveryRadius ?? 3.0;

      let isServiceable = true;
      if (typeof lat === "number" && typeof lng === "number") {
        const dist = calculateDistance(lat, lng, storeLat, storeLng);
        if (dist > radiusLimit) {
          isServiceable = false;
        }
      } else if (targetAddress.serviceable === false) {
        isServiceable = false;
      }

      if (!isServiceable) {
        setShowServiceNotAvailableModal(true);
        return;
      }
    }

    setIsCheckoutOpen(true);
  };

  const handleCompleteOrderPayment = (address: Address, payMethod: string) => {
    // Fail-safe timezone guard against store hours
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (5.5 * 3600000));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const isCurrentlyOpen = totalMinutes >= 8 * 60 && totalMinutes < 21 * 60;

    if (!isCurrentlyOpen) {
      setIsCheckoutOpen(false);
      setShowStoreClosedModal(true);
      return;
    }

    // Dynamic pricing calculations based on new system rules
    const {
      subtotal,
      deliveryCharge: delivery,
      platformFee,
      handlingCharge,
      total: totalBill,
    } = calculatePricing(cart.reduce((acc, curr) => acc + curr.product.sellingPrice * curr.quantity, 0));

    const discount = 0;

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
      platformFee,
      handlingCharge,
      total: totalBill,
      status: "placed",
      address,
      paymentMethod: payMethod,
      eta: 15,
      deliveryPartner: undefined,
      placed_at: new Date().toISOString(),
    };

    // Deduct stock levels in state & Firestore (including items within purchased combo deals)
    const updatedProducts = products.map((prod) => {
      // 1. Direct purchase quantity
      const directCartItem = cart.find((item) => item.product.id === prod.id);
      const directQty = directCartItem ? directCartItem.quantity : 0;

      // 2. Combo-based purchase quantity
      let indirectQty = 0;
      cart.forEach((item) => {
        if (item.product.id.startsWith("combo-")) {
          const cb = combos.find((c) => c.id === item.product.id);
          if (cb && cb.productIds.includes(prod.id)) {
            indirectQty += item.quantity;
          }
        }
      });

      const totalDeduction = directQty + indirectQty;

      if (totalDeduction > 0) {
        const nextStock = Math.max(0, prod.stock - totalDeduction);
        const updated = {
          ...prod,
          stock: nextStock,
        };
        // Update in Firestore asynchronously so it is preserved
        updateProduct(updated).catch((err) => {
          console.error("[SmartCart Checkout] Stock deduction error:", err);
        });
        return updated;
      }
      return prod;
    });

    setProducts(updatedProducts);
    const newOrdersList = [newOrder, ...orders];
    saveOrders(newOrdersList);
    saveCart([]); // Clear Cart upon checkouts

    // Automatically load the saved default address after order placement
    if (savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find(a => a.isDefault === true) || savedAddresses[0];
      setCurrentAddress(defaultAddr);
    }

    // Close checkout wizard and open tracking sheet instantly!
    setIsCheckoutOpen(false);
    setActiveOrderForTracking(newOrder);

    // Sync order to your Firebase backend and dispatch SMTP email notification
    (async () => {
      console.log(`[SmartCart Firebase] Initializing Firestore write for order: ${newOrder.id}...`);
      try {
        const itemsToTrack = newOrder.items.map((item: any) => ({
          productId: item.product.id,
          quantity: item.quantity
        }));
        await trackOrderPlacements(itemsToTrack);
      } catch (err) {
        console.warn("[Analytics] Order placement analytics tracking failed:", err);
      }
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

  const handleAddProductAdmin = async (p: Omit<Product, "id">) => {
    const fresh: Product = {
      ...p,
      id: `p-${Date.now()}`,
    };
    try {
      await addProduct(fresh);
    } catch (err) {
      console.error("[Inventory] Error adding product to Firebase:", err);
    }
  };

  const handleDeleteProductAdmin = async (id: string) => {
    try {
      await deleteProduct(id);
      // Also strip deleted product from cart and wishlist to prevent layout crashes
      saveCart(cart.filter((item) => item.product.id !== id));
      saveWishlist(wishlist.filter((x) => x.id !== id));
    } catch (err) {
      console.error("[Inventory] Error deleting product from Firebase:", err);
    }
  };

  const handleUpdateStockAdmin = async (id: string, newStock: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const updated = { ...product, stock: newStock };
    try {
      await updateProduct(updated);
    } catch (err) {
      console.error("[Inventory] Error updating product stock in Firebase:", err);
    }
  };

  const handleUpdateProductAdmin = async (product: Product) => {
    try {
      await updateProduct(product);
    } catch (err) {
      console.error("[Inventory] Error updating product in Firebase:", err);
    }
  };

  const handleAddComboAdmin = async (combo: ComboDeal) => {
    try {
      await saveComboToFirebase(combo);
    } catch (err) {
      console.error("[Inventory] Error adding combo to Firebase:", err);
    }
  };

  const handleDeleteComboAdmin = async (id: string) => {
    try {
      await deleteComboFromFirebase(id);
    } catch (err) {
      console.error("[Inventory] Error deleting combo from Firebase:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order["status"]) => {
    console.log(`[SmartCart Debug] handleUpdateOrderStatus triggered for Order ID: ${orderId} status: "${status}"`);
    const timestamp = new Date().toISOString();
    const existingOrder = orders.find((o) => o.id === orderId);

    if (status === "cancelled" && existingOrder) {
      console.log("[SmartCart Debug] Cancel Function Started in App.tsx for order ID:", orderId);
      const isRiderRole = userRole === "Rider" || activeTab === "rider";
      const isAdminRole = userRole === "Admin" || activeTab === "admin";
      
      // Customers can cancel when status is exactly "placed"
      if (!isRiderRole && !isAdminRole) {
        if (existingOrder.status !== "placed") {
          console.log("[SmartCart Debug] Cancel Action Blocked: Status is not 'placed'", existingOrder.status);
          alert(`This order can no longer be cancelled because its status is "${existingOrder.status}". Only orders in "placed" status can be cancelled.`);
          return;
        }
      }
    }

    const updated = orders.map((o) => {
      if (o.id !== orderId) return o;

      const orderUpdate: any = {
        ...o,
        status,
        delivery_status: status,
      };

      switch (status) {
        case "placed":
          orderUpdate.placed_at = timestamp;
          break;

        case "accepted":
        case "confirmed":
          orderUpdate.accepted_at = timestamp;
          orderUpdate.acceptedAt = timestamp;
          break;

        case "packed":
          orderUpdate.packed_at = timestamp;
          break;

        case "out_for_delivery":
          orderUpdate.out_for_delivery_at = timestamp;
          break;

        case "delivered":
          orderUpdate.delivered_at = timestamp;
          break;

        case "cancelled":
          orderUpdate.cancelled_at = timestamp;
          orderUpdate.cancelledAt = timestamp;

          // Remove rider assignment
          orderUpdate.rider_id = null;
          orderUpdate.rider_name = null;
          orderUpdate.riderId = null;
          orderUpdate.riderName = null;
          orderUpdate.deliveryPartner = null;
          orderUpdate.assigned_at = null;
          orderUpdate.accepted_at = null;
          orderUpdate.acceptedAt = null;
          break;
      }

      if (orderUpdate.deliveryPartner) {
        orderUpdate.deliveryPartner = {
          ...orderUpdate.deliveryPartner,
          delivery_status: status,
          ...(status === "accepted" || status === "confirmed"
            ? { accepted_at: timestamp }
            : {}),
        };
      }

      return orderUpdate;
    });

    // Update React State and LocalStorage instantly
    saveOrders(updated);
    console.log(`[SmartCart Debug] Order State Updated: Local state for Order ID: ${orderId} updated instantly in React configuration list to status: "${status}"`);

    // Sync current active tracker reference as well
    if (activeOrderForTracking && activeOrderForTracking.id === orderId) {
      const activeUpdate = updated.find((o) => o.id === orderId);
      if (activeUpdate) {
        setActiveOrderForTracking(activeUpdate);
      }
    }

    // Sync updated status to Firebase backend in real-time
    const updatedOrder = updated.find((o) => o.id === orderId);
    if (updatedOrder) {
      console.log(`[SmartCart Debug] Firestore Update Started: Sync'ing order #${orderId} status "${status}" with Firestore...`);
      try {
        await syncOrderToFirebase(updatedOrder);
        console.log(`[SmartCart Debug] Firestore Update Success: Order #${orderId} successfully synced to Firestore.`);
        if (status === "cancelled") {
          alert("Success: Your order has been cancelled successfully!");
        }
      } catch (err) {
        console.error(`[SmartCart Debug] Firestore Update Failed: Failed to update Firestore status for order ${orderId}:`, err);
        alert(`Failed to update order status in backend. Please verify your network and permissions.`);
      }
    }
  };

  const handleAssignRiderPartner = async (orderId: string, partnerName: string) => {
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
      try {
        await syncOrderToFirebase(updatedOrder);
      } catch (err) {
        console.error("Failed to sync assigned rider partner to firebase:", err);
      }
    }
  };

  const handleAssignPartnerToOrder = async (
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
          riderId: rId,
          riderName: partner.name,
          acceptedAt: timestamp,
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
        riderId: rId,
        riderName: partner.name,
        acceptedAt: timestamp,
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
      await syncOrderToFirebase(updatedOrder);
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
  const filteredProducts = React.useMemo(() => {
    let resultList = products;
    if (searchQuery.trim() !== "") {
      resultList = getSmartSearchMatches(products, searchQuery);
    }
    
    if (selectedCategory !== null) {
      resultList = resultList.filter((p) => p.category === selectedCategory);
    }
    
    return sortProductsByPopularity(resultList);
  }, [products, searchQuery, selectedCategory]);

  const searchRelatedRecommendations = React.useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return getRelatedRecommendations(products, filteredProducts, searchQuery);
  }, [products, filteredProducts, searchQuery]);

  const buyAgainProducts = React.useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    if (currentUid && orders && orders.length > 0) {
      const userOrders = orders.filter((o) => o.userId === currentUid);
      if (userOrders.length > 0) {
        const frequency: Record<string, { count: number; product: Product }> = {};
        userOrders.forEach((o) => {
          if (o.items && Array.isArray(o.items)) {
            o.items.forEach((item) => {
              const p = item.product;
              if (!p || !p.id) return;
              if (frequency[p.id]) {
                frequency[p.id].count += item.quantity || 1;
              } else {
                frequency[p.id] = { count: item.quantity || 1, product: p };
              }
            });
          }
        });
        
        const sorted = Object.values(frequency)
          .sort((a, b) => b.count - a.count)
          .map((item) => item.product);

        if (sorted.length > 0) {
          return sorted.slice(0, 8);
        }
      }
    }
    return [];
  }, [orders, products]);

  // Personalized recommendations
  const personalizedRecommendations = React.useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    return getPersonalizedRecommendations(
      products,
      orders,
      currentUid,
      browsedCategories,
      searchedKeywords
    ).slice(0, 8);
  }, [products, orders, auth.currentUser?.uid, browsedCategories, searchedKeywords]);

  // Fallback / Guest popularity list: Most Selling Products
  const mostSellingProducts = React.useMemo(() => {
    return sortProductsByPopularity(products).slice(0, 8);
  }, [products]);

  // Best offers subset
  const bestOffersSubset = React.useMemo(() => {
    const filtered = products.filter((p) => p.isBestOffer === true);
    return sortProductsByPopularity(filtered).slice(0, 4);
  }, [products]);

  // Featured items subset
  const featuredSubset = React.useMemo(() => {
    const filtered = products.filter((p) => p.isFeatured === true);
    return sortProductsByPopularity(filtered).slice(0, 4);
  }, [products]);

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
          setCurrentAddress={handleSelectAddress}
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
          <main className="animate-fade-in pb-24 md:pb-12">
            
            {/* Store Status Notice Banner */}
            {!isStoreOpen && (
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4 font-sans select-none animate-fade-in">
                <div id="store-status-banner-closed" className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-left shadow-xs gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <span className="text-2xl mt-0.5 sm:mt-0 leading-none shrink-0" role="img" aria-label="Store Closed">🔴</span>
                    <div>
                      <h4 className="text-sm md:text-base font-black text-rose-955">Store Closed</h4>
                      <p className="text-xs text-rose-700 font-bold mt-0.5">
                        Orders are accepted only between 8:00 AM and 9:00 PM.
                      </p>
                      <p className="text-[11px] text-rose-600 font-semibold mt-1">
                        Please visit again during operating hours.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider shrink-0 self-start sm:self-center">
                    Offline
                  </span>
                </div>
              </div>
            )}
            
            {/* Delivery Area Serviceability Banner */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4 font-sans select-none animate-fade-in" id="delivery-serviceable-banner-section">
              {(!currentAddress || (currentAddress.serviceable !== false && (typeof currentAddress.lat !== "number" || typeof currentAddress.lng !== "number" || calculateDistance(currentAddress.lat, currentAddress.lng, deliveryZoneSettings.storeLat, deliveryZoneSettings.storeLng) <= deliveryZoneSettings.deliveryRadius))) ? (
                <div id="delivery-zone-banner-open" className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-left shadow-xs gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <span className="text-2xl mt-0.5 sm:mt-0 leading-none shrink-0" role="img" aria-label="Delivery Available">🟢</span>
                    <div>
                      <h4 className="text-sm md:text-base font-black text-emerald-955">Delivery Available in Your Area</h4>
                      <p className="text-xs text-emerald-700 font-bold mt-0.5">
                        {currentAddress && typeof currentAddress.lat === "number" && typeof currentAddress.lng === "number"
                          ? `Your selected address is within our fast dispatch zone (${calculateDistance(currentAddress.lat, currentAddress.lng, deliveryZoneSettings.storeLat, deliveryZoneSettings.storeLng).toFixed(2)} KM from store).` 
                          : `We are accepting instant grocery dispatches within a ${deliveryZoneSettings.deliveryRadius} KM radius.`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider shrink-0 self-start sm:self-center">
                    Serviceable
                  </span>
                </div>
              ) : (
                <div id="delivery-zone-banner-closed" className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-left shadow-xs gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <span className="text-2xl mt-0.5 sm:mt-0 leading-none shrink-0" role="img" aria-label="Delivery Restricted">🔴</span>
                    <div>
                      <h4 className="text-sm md:text-base font-black text-rose-955">Delivery Not Available in Your Area ({deliveryZoneSettings.deliveryRadius} KM Radius)</h4>
                      <p className="text-xs text-rose-700 font-bold mt-0.5">
                        {currentAddress && typeof currentAddress.lat === "number" && typeof currentAddress.lng === "number"
                          ? `Selected address is ${calculateDistance(currentAddress.lat, currentAddress.lng, deliveryZoneSettings.storeLat, deliveryZoneSettings.storeLng).toFixed(2)} KM away, which exceeds our ${deliveryZoneSettings.deliveryRadius} KM maximum limit.` 
                          : `Sorry, we are currently unable to dispatch to your coordinates.`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-850 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider shrink-0 self-start sm:self-center">
                    Blocked
                  </span>
                </div>
              )}
            </div>
            
            {/* Show Hero Promo Carousel ONLY if no category filter or search active */}
            {!selectedCategory && searchQuery.trim() === "" && (
              <div className="hidden md:block">
                <Hero />
              </div>
            )}

            {/* Shop Categories horizontal filter ribbon */}
            <Categories
              categories={sortedCategories}
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

            {/* Dynamic layout prioritization section will render lower down under catalog grids */}

            {/* Show Mobile Promo Banner ONLY if no category filter or search active */}
            {!selectedCategory && searchQuery.trim() === "" && (
              <MobilePromoBanner />
            )}

            {/* Product Request Banner */}
            {!selectedCategory && searchQuery.trim() === "" && (
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
                <ProductRequestBanner />
              </div>
            )}

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
            <div className="mx-auto max-w-7xl px-1.5 xs:px-3 sm:px-6 lg:px-8 mt-4 md:mt-6 animate-fade-in" id="catalog-grids-section">
              
              {!productsLoaded ? (
                <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-sm font-semibold text-gray-500">Fast tracking fresh inventory from cloud vaults...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center max-w-sm mx-auto" id="empty-inventory-state">
                  <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                    <ShoppingBag className="h-8 w-8 text-gray-300" />
                  </div>
                  <h4 className="text-sm font-black text-gray-800 tracking-tight mb-1">No products available</h4>
                  <p className="text-xs text-gray-400 font-semibold uppercase">The inventory is currently empty. Our administrators will list fresh grocery items shortly!</p>
                </div>
              ) : selectedCategory ? (
                /* 1. SINGLE-CATEGORY PAGE VIEW (Completely isolated) */
                <div>
                  {selectedCategory === "pet" && <PetProductRequest />}

                  <div className="text-left mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-lg sm:text-2xl font-black text-gray-955 flex items-center gap-2">
                      {selectedCategory === "fruits" && "🍎"}
                      {selectedCategory === "combos" && "🎁"}
                      {selectedCategory === "vegetables" && "🥬"}
                      {selectedCategory === "dairy" && "🥛"}
                      {selectedCategory === "snacks" && "🍿"}
                      {selectedCategory === "beverages" && "🥤"}
                      {selectedCategory === "bakery" && "🥐"}
                      {selectedCategory === "personal-care" && "🧴"}
                      {selectedCategory === "household" && "🧹"}
                      {selectedCategory === "frozen" && "❄️"}
                      {selectedCategory === "baby" && "👶"}
                      {selectedCategory === "pet" && "🐾"}
                      <span>
                        {INITIAL_CATEGORIES.find((c) => c.id === selectedCategory)?.name || "Category Products"}
                      </span>
                    </h3>
                    <p className="text-[10px] md:text-xs text-gray-400 font-extrabold uppercase mt-1 tracking-wider">
                      {searchQuery.trim() !== "" ? `Filtered by search: "${searchQuery}" • ` : ""}
                      {selectedCategory === "combos" 
                        ? `${combos.length} bundle offers available`
                        : `${filteredProducts.length} items available in this section`
                      }
                    </p>
                  </div>

                  {selectedCategory === "combos" ? (
                    combos.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl p-8 max-w-md mx-auto my-8">
                        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-150">
                          <Gift className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-extrabold text-gray-800 uppercase tracking-tight">No combo deals listed yet.</p>
                        <p className="text-xs text-gray-400 mt-1.5 font-semibold">Our network administrators will publish hot bundle offers shortly!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {combos.map((c) => (
                          <ComboCard
                            key={c.id}
                            combo={c}
                            cartQty={cart.find((item) => item.product.id === c.id)?.quantity || 0}
                            onAddToCart={handleAddToCart}
                            onRemoveFromCart={handleRemoveFromCart}
                            allProducts={products}
                          />
                        ))}
                      </div>
                    )
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl p-8 max-w-md mx-auto my-8">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-150">
                        <ShoppingBag className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-extrabold text-gray-850 uppercase tracking-tight font-black">No products available in this category.</p>
                      <p className="text-xs text-gray-400 mt-1.5 font-semibold">Our network administrators will add fresh items to our inventory shortly!</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 xs:gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
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

                      {selectedCategory === "pet" && <PetProductRequest />}
                    </>
                  )}
                </div>
              ) : searchQuery.trim() !== "" ? (
                /* 2. SEARCH RESULTS VIEW (Only active when searching from global homepage without a category filter) */
                <div>
                  <h3 className="text-sm md:text-lg font-black text-gray-955 text-left mb-3 md:mb-4 tracking-tight uppercase">
                    SearchResults ({filteredProducts.length} items found)
                  </h3>
                  
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">No items match your criteria</p>
                      <p className="text-sm">Try searching for other fresh things like bananas, organic milk, or brown eggs.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 xs:gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
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

                  {/* --- Search Related Recommendations --- */}
                  {searchRelatedRecommendations.length > 0 && (
                    <div className="mt-8 border-t border-gray-100 pt-6 text-left animate-fade-in" id="search-related-recommendations">
                      <div className="mb-4">
                        <span className="text-[8px] xs:text-[10px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.5 rounded uppercase font-black">Recommendations</span>
                        <h3 className="text-sm md:text-lg font-black text-gray-900 tracking-tight mt-0.5">🛍️ You May Also Like</h3>
                        <p className="text-[10px] md:text-xs text-gray-400 font-semibold mt-0.5">Complementary and related items based on your search</p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 xs:gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                        {searchRelatedRecommendations.map((p) => (
                          <ProductCard
                            key={`related-rec-${p.id}`}
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
                    </div>
                  )}
                </div>
              ) : (
                /* SINGLE UNIFIED HOMEPAGE PRODUCT FEED showing ALL products with smart page-load shuffle & interleaving category distribution */
                <div className="gap-5 md:gap-8 flex flex-col">
                  {homepageProducts.length > 0 && (
                    <section className="text-left px-1.5 sm:px-0 animate-fade-in" id="homepage-shuffled-catalog">
                      <div className="mb-4 md:mb-6">
                        <span className="text-[8px] xs:text-[10px] bg-orange-100 text-[#F97316] font-bold px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                          Fresh Grocery Catalog
                        </span>
                        <h3 className="text-sm md:text-xl font-black text-gray-900 tracking-tight mt-0.5 md:mt-1">
                          Popular Products
                        </h3>
                        <p className="text-[10px] md:text-xs text-gray-400 font-semibold leading-none mt-0.5 md:mt-1">
                          Delivered to your doorstep in 15 minutes
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 xs:gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                        {homepageProducts.map((p) => (
                          <ProductCard
                            key={`shuffled-home-${p.id}`}
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
                </div>
              )}

            </div>
          </main>
        )}

        {/* 2. WISHLIST VIEW */}
        {activeTab === "wishlist" && (
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 text-left animate-fade-in">
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
            onSetDefaultAddress={handleSetDefaultAddressCoord}
            onResetAddresses={handleResetAddresses}
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
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onViewPolicy={setActivePolicy}
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
            onUpdateProduct={handleUpdateProductAdmin}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAssignPartner={handleAssignRiderPartner}
            riders={riders}
            setRiders={setRiders}
            isCustomerLoggedIn={isCustomerLoggedIn}
            userEmail={userEmail}
            onCustomerLogout={handleCustomerLogout}
            combos={combos}
            onAddCombo={handleAddComboAdmin}
            onDeleteCombo={handleDeleteComboAdmin}
            deliveryZoneSettings={deliveryZoneSettings}
            onUpdateDeliveryZoneSettings={handleUpdateDeliveryZoneSettings}
          />
        ))}

        {/* 5. RIDER DASHBOARD TAB */}
        {activeTab === "rider" && (
          <>
            {/* Real-time Rider Order Notifications container */}
            {newOrderNotifications.length > 0 && (
              <div className="fixed top-4 right-4 z-[90] space-y-3 max-w-sm w-full animate-in slide-in-from-right-5 font-sans">
                {newOrderNotifications.map((notif) => (
                  <div 
                    key={notif.id}
                    className="bg-gray-950 text-white border border-green-500 rounded-2xl p-4 shadow-2xl flex flex-col gap-2 relative overflow-hidden"
                  >
                    {/* Accent glow bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-green-500 animate-pulse" />

                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-green-500/10 text-green-405 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-green-500/20">
                          🔔 Instant Order Alert
                        </span>
                        <h4 className="text-xs font-black text-white mt-1.5 leading-none">
                          New Order #{notif.id.substring(0, 8)}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                          Delivery to <span className="text-gray-200 capitalize font-bold">{notif.address.name}</span> ({notif.address.city})
                        </p>
                      </div>
                      <button 
                        onClick={() => setNewOrderNotifications(prev => prev.filter(n => n.id !== notif.id))}
                        className="text-gray-400 hover:text-white transition font-bold text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px] border-t border-gray-800 pt-2 text-gray-450">
                      <span>Total: ₹{notif.total}</span>
                      <button
                        onClick={() => {
                          setNewOrderNotifications(prev => prev.filter(n => n.id !== notif.id));
                        }}
                        className="bg-green-500 text-gray-950 font-black px-2.5 py-1 rounded text-[9px] hover:bg-green-400 transition cursor-pointer"
                      >
                        View on Dashboard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <RiderDashboard
              riders={riders}
              setRiders={setRiders}
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onAssignPartnerToOrder={handleAssignPartnerToOrder}
              onPassOrder={handlePassOrder}
              riderSession={riderSession}
              setRiderSession={setRiderSession}
              onCustomerLogout={handleCustomerLogout}
            />
          </>
        )}

      </div>

      {/* --- FLOATING MODALS AND OVERLAYS --- */}

      {/* A. PRODUCT DETAILS modal */}
      <ProductDetailsModal
        product={selectedProduct ? (products.find((prod) => prod.id === selectedProduct.id) || selectedProduct) : null}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        cartQty={selectedProduct ? (cart.find((item) => item.product.id === selectedProduct.id)?.quantity || 0) : 0}
        onAddToCart={handleAddToCart}
        onRemoveFromCart={handleRemoveFromCart}
        isWishlisted={selectedProduct ? wishlist.some((x) => x.id === selectedProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        allProducts={products}
        onProductClick={(p) => setSelectedProduct(p)}
        orders={orders}
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
        appliedPromo={null}
        onApplyPromo={() => {}}
        isStoreOpen={isStoreOpen}
        onStoreClosedClick={() => setShowStoreClosedModal(true)}
      />

      {/* C. 3-STEP CHECKOUT modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        savedAddresses={savedAddresses}
        onAddAddress={handleAddAddressCoord}
        selectedAddress={currentAddress}
        onSelectAddress={handleSelectAddress}
        totalAmount={calculatePricing(cartTotal).total}
        onCompletePayment={handleCompleteOrderPayment}
        isStoreOpen={isStoreOpen}
        onStoreClosedClick={() => setShowStoreClosedModal(true)}
        deliveryZoneSettings={deliveryZoneSettings}
        onServiceNotAvailable={() => setShowServiceNotAvailableModal(true)}
      />

      {/* C.2 LOCATION ONBOARDING modal for new user signup / login */}
      <LocationOnboardingModal
        isOpen={showLocationOnboarding}
        onClose={() => setShowLocationOnboarding(false)}
        userName={userName}
        userPhone={userPhone}
        onAddAddress={handleAddAddressCoord}
        savedAddresses={savedAddresses}
      />

      {/* D. LIVE TRACKING TIMELINE sheet */}
      <OrderTracking
        isOpen={activeOrderForTracking !== null}
        onClose={() => setActiveOrderForTracking(null)}
        order={activeOrderForTracking}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onAssignPartnerToOrder={handleAssignPartnerToOrder}
      />

      {/* STORE CLOSED DIALOG POPUP */}
      {showStoreClosedModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl relative overflow-hidden flex flex-col items-center text-center font-sans">
            <span className="text-4xl mb-4">🏪</span>
            <h3 className="text-base font-black text-gray-900 tracking-tight mb-2">
              Store Currently Closed
            </h3>
            <p className="text-xs text-gray-600 font-bold mb-4">
              SmartCart is currently closed.
            </p>
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/50 flex flex-col items-center w-full mb-5">
              <span className="text-xs text-amber-800 font-extrabold leading-relaxed mb-1">
                Orders can only be placed between:
              </span>
              <span className="text-sm text-amber-955 font-black flex items-center gap-1">
                🕗 8:00 AM – 9:00 PM
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold mb-6">
              Please visit again during store operating hours.
            </p>
            <button
              onClick={() => setShowStoreClosedModal(false)}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-lg shadow-green-100"
            >
              ✓ OK
            </button>
          </div>
        </div>
      )}

      {/* SERVICE NOT AVAILABLE DIALOG POPUP */}
      {showServiceNotAvailableModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" id="service-not-available-popup-container">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl relative overflow-hidden flex flex-col items-center text-center font-sans">
            <span className="text-4xl mb-4">📍</span>
            <h3 className="text-base font-black text-gray-900 tracking-tight mb-2">
              Service Not Available
            </h3>
            <p className="text-xs text-gray-650 font-bold mb-4 leading-relaxed">
              Sorry, SmartCart delivery service is currently available only within {deliveryZoneSettings.deliveryRadius || 3} KM of our store.
            </p>
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200/50 flex flex-col items-center w-full mb-5">
              <span className="text-[11px] text-rose-800 font-extrabold leading-relaxed mb-1">
                Your selected address is outside our delivery area.
              </span>
              <span className="text-[11px] text-rose-955 font-bold">
                Please choose another address within our service zone.
              </span>
            </div>
            <button
              id="service-not-available-popup-ok-btn"
              onClick={() => setShowServiceNotAvailableModal(false)}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer text-center shadow-lg shadow-red-100"
            >
              ✓ OK
            </button>
          </div>
        </div>
      )}

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
                <h4 className="font-bold text-gray-300 uppercase text-[10px] tracking-widest mb-2.5">Support & Policies</h4>
                <p className="text-gray-400 font-sans">
                  Contact: <a href="mailto:smartcart.busi@gmail.com" className="text-orange-500 hover:underline font-semibold">smartcart.busi@gmail.com</a>
                </p>
                <div className="mt-2.5 space-y-1.5 flex flex-col">
                  <button onClick={() => setActivePolicy("privacy")} className="text-left text-gray-400 hover:text-orange-400 transition hover:underline text-[11px] cursor-pointer">Privacy Policy</button>
                  <button onClick={() => setActivePolicy("terms")} className="text-left text-gray-400 hover:text-orange-400 transition hover:underline text-[11px] cursor-pointer">Terms & Conditions</button>
                  <button onClick={() => setActivePolicy("refund")} className="text-left text-gray-400 hover:text-orange-400 transition hover:underline text-[11px] cursor-pointer">Refund & Cancellation Policy</button>
                </div>
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

      {/* LEGAL POLICY MODAL VIEWER */}
      {activePolicy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setActivePolicy(null)}
              className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="pb-4 border-b border-gray-100 mb-4 text-left">
              <span className="inline-flex items-center space-x-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black text-green-700 uppercase tracking-wider mb-2">
                SmartCart Information Center
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-950">
                {activePolicy === "privacy" && "Privacy Disclosures"}
                {activePolicy === "terms" && "Terms & Conditions"}
                {activePolicy === "refund" && "Cancellation & Refund Terms"}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-gray-650 leading-relaxed font-medium">
              {activePolicy === "privacy" && (
                <div className="space-y-3.5">
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-2">1. Information We Collect</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                      <li><strong className="text-gray-800">Name</strong> for personalized order identification and receipting.</li>
                      <li><strong className="text-gray-800">Email Address</strong> for digital invoices and automated updates.</li>
                      <li><strong className="text-gray-800">Phone Number</strong> for order confirmation and contact during delivery.</li>
                      <li><strong className="text-gray-800">Delivery Address</strong> to locate your exact fulfillment doorstep.</li>
                      <li><strong className="text-gray-800">Order History</strong> to track your past transactions and facilitate easy reordering.</li>
                      <li><strong className="text-gray-800">Account Information</strong> to manage credentials and authentication safely.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-2">2. How We Use Information</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                      <li>To process and compile your grocery order items efficiently.</li>
                      <li>To coordinate and manage real-time deliveries with our local rider team.</li>
                      <li>To resolve inquiries and provide responsive customer support.</li>
                      <li>To send immediate notifications about your package transit milestones.</li>
                      <li>To verify identity and ensure rigid account security against fraud.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">3. Data Storage</h3>
                    <p className="text-gray-600">
                      All collected subscriber records, profile settings, and location coordinates are securely stored utilizing cloud infrastructure and industry-standard Firebase security rules to prevent unauthorized breaches.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">4. Data Sharing Policy</h3>
                    <p className="text-gray-600">
                      SmartCart maintains strict confidentiality standards: we <strong className="text-gray-800">do not sell or rent</strong> customer database info to third-party marketing brokers. Relevant coordinate data and phone logs are exclusively shared with assigned courier partners strictly to complete deliveries.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">5. Information Security</h3>
                    <p className="text-gray-600">
                      We protect your database record parameters with physical, electronic, and administrative defenses. While no internet-based platform can claim 100% absolute defense, we regularly audit policies to maximize system safety.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">6. User Information Rights</h3>
                    <p className="text-gray-600">
                      You hold full control over your private records. You may request information modification, address correction, or absolute profile deletion at any point by reaching out to our support channel at <a href="mailto:smartcart.busi@gmail.com" className="text-green-600 hover:underline font-extrabold">smartcart.busi@gmail.com</a>.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">7. Privacy Policy Updates</h3>
                    <p className="text-gray-600">
                      SmartCart reserves the right to revise or update this privacy notice periodically. Your ongoing subscription and platform engagement denotes complete consensus and acceptance of any dynamic policy updates.
                    </p>
                  </div>
                </div>
              )}

              {activePolicy === "terms" && (
                <div className="space-y-3.5">
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">1. User Accounts & Safety</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                      <li>Users must furnish legitimate, updated, and highly accurate details during registration.</li>
                      <li>You are solely responsible for securing your login parameters and preventing credential leakage.</li>
                      <li>SmartCart reserves full authority to immediately restrict or suspend profiles suspected of fraud, platform abuse, or malicious activity.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">2. Ordering & Pricing</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                      <li>Orders are processed dynamically and are subject to immediate regional warehouse availability.</li>
                      <li>Menu pricing tags, discounts, and item availability can change in real time without prior notice.</li>
                      <li>SmartCart reserves the right to void or cancel orders due to stock issues, technical pricing errors, or suspicious transactions.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">3. Ride Cancellation Rules</h3>
                    <p className="text-gray-600">
                      To safeguard fleet efficiency and keep delivery times ultra-fast, orders can <strong className="text-gray-800">only be canceled prior to an active Rider partner accepting the order request</strong>. Once a rider partner commits to your dispatch, cancellations, modifications, or returns are strictly locked and non-refundable.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">4. Delivery Expectations</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                      <li>All listed transit timers count as estimated goals rather than absolute guarantees.</li>
                      <li>Fulfillment delays are rare but may occur due to extreme weather, traffic jams, high demand peaks, festivals, or local roadblocks.</li>
                      <li>Customers must specify complete location pins and addresses to prevent rider route failure.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">5. Product Presentation</h3>
                    <p className="text-gray-600">
                      Product thumbnails or images represent reference previews only. Actual item packages, custom brandings, or physical styles may vary locally. Accurate item reservation is only established post successful checkout.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 bg-amber-50/50 border-amber-100">
                    <h3 className="font-extrabold text-amber-900 text-sm mb-1.5">6. Cold Drink Disclaimer</h3>
                    <p className="text-amber-800">
                      Chilled beverages, cold desserts, and fresh dairy elements might experience standard temperature changes during active courier transits depending on current high weather indexes and delivery times.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">7. Limitation of Liability</h3>
                    <p className="text-gray-600">
                      SmartCart's total legal accountability and fulfillment liability for any direct delivery issue, missing item, or logistic delay is <strong className="text-gray-800 border-b border-gray-300">strictly limited to the invoice value of that specific order transaction</strong>.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">8. Client Support Channels</h3>
                    <p className="text-gray-600">
                      If you require terms explanation, help with a ride, or account inquiries, please dispatch an email directly to our center: <a href="mailto:smartcart.busi@gmail.com" className="text-green-600 hover:underline font-extrabold">smartcart.busi@gmail.com</a>.
                    </p>
                  </div>
                </div>
              )}

              {activePolicy === "refund" && (
                <div className="space-y-3.5">
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-2">Order Cancellation Policies</h3>
                    <p className="text-gray-600 leading-relaxed">
                      To maintain a super fast 10-minute grocery service, we organize a strict cancellation standard:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1.5 text-gray-600 font-medium">
                      <li>You can easily initiate order cancellations inside the application before a delivery partner has accepted the order.</li>
                      <li>Once a rider partner is assigned and begins the pickup process, cancellations are locked and are strictly non-refundable.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-2">Return & Refund Standards</h3>
                    <p className="text-gray-600">
                      Due to the fresh nature of grocery supplies, perishables, fruits, and dairy products:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1.5 text-gray-600 font-medium">
                      <li>We do not accept product returns or coordinate arbitrary item swaps once the package is delivered.</li>
                      <li>If any element is missing, incorrect, or reaches you in damaged state, report it to <span className="font-black text-gray-800">smartcart.busi@gmail.com</span> with details for custom resolution.</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5">Non-Refundable Service Surcharges</h3>
                    <p className="text-gray-600">
                      Standard service fees like the Platform Surcharge, Handling Surcharge, and Delivery partner dispatch fee are entirely non-refundable once courier transit has initiated or was attempted.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-gray-100 mt-4 flex justify-end">
              <button
                onClick={() => setActivePolicy(null)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer font-sans shadow-md shadow-green-100"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-55 md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] pb-safe">
        <div className="flex h-16 items-center justify-around px-4">
          
          {/* Home Nav Item */}
          <button
            onClick={() => {
              setIsCartOpen(false);
              setActiveTab("home");
            }}
            className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === "home" && !isCartOpen
                ? "text-green-600 font-extrabold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Home className={`h-5 w-5 transition-transform duration-200 ${activeTab === "home" && !isCartOpen ? "scale-110 stroke-[2.5px]" : "stroke-[2px]"}`} />
              {activeTab === "home" && !isCartOpen && (
                <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] tracking-wider uppercase mt-1 font-sans">
              Home
            </span>
          </button>

          {/* Profile Nav Item */}
          <button
            onClick={() => {
              setIsCartOpen(false);
              setActiveTab("profile");
            }}
            className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 active:scale-95 cursor-pointer ${
              activeTab === "profile" && !isCartOpen
                ? "text-green-600 font-extrabold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <User className={`h-5 w-5 transition-transform duration-200 ${activeTab === "profile" && !isCartOpen ? "scale-110 stroke-[2.5px]" : "stroke-[2px]"}`} />
              {activeTab === "profile" && !isCartOpen && (
                <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] tracking-wider uppercase mt-1 font-sans">
              Profile
            </span>
          </button>

          {/* Cart Nav Item */}
          <button
            onClick={() => {
              setIsCartOpen(true);
            }}
            className={`flex flex-col items-center justify-center w-24 h-full transition-all duration-200 active:scale-95 cursor-pointer ${
              isCartOpen
                ? "text-green-600 font-extrabold"
                : "text-gray-400 hover:text-gray-600 font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <ShoppingBag className={`h-5 w-5 transition-transform duration-200 ${isCartOpen ? "scale-110 stroke-[2.5px]" : "stroke-[2px]"}`} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white ring-2 ring-white animate-bounce" style={{ animationDuration: '2s' }}>
                  {cartCount}
                </span>
              )}
              {isCartOpen && (
                <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] tracking-wider uppercase mt-1 font-sans">
              Cart
            </span>
          </button>

        </div>
      </div>

    </div>
  );
}