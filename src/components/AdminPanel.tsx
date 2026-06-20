import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Package, 
  ShoppingBag, 
  ShieldAlert, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  Check, 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  MapPin, 
  Signal, 
  Bike, 
  Activity, 
  ExternalLink,
  LogOut,
  RefreshCw,
  Clock
} from "lucide-react";
import { Product, Order, Rider, ComboDeal } from "../types";
import { INITIAL_CATEGORIES } from "../data";
import { fetchUserProfilesFromFirebase, UserProfileData, syncRiderToFirebase, deleteRiderFromFirebase } from "../lib/firebase";
import RiderAvatar from "./RiderAvatar";
import LiveRiderTrackingMap from "./LiveRiderTrackingMap";
import { getOrderGridCoordinates } from "./RiderDashboard";

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, "id" | "discount"> & { discount?: number }) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateStock: (id: string, newStock: number) => void;
  orders: Order[];
  onUpdateOrderStatus: (id: string, status: Order["status"]) => void;
  onAssignPartner: (id: string, partnerName: string) => void;
  riders: Rider[];
  setRiders: React.Dispatch<React.SetStateAction<Rider[]>>;
  isCustomerLoggedIn?: boolean;
  userEmail?: string;
  onCustomerLogout?: () => void;
  combos?: ComboDeal[];
  onAddCombo?: (combo: ComboDeal) => void;
  onDeleteCombo?: (id: string) => void;
  onUpdateProduct?: (p: Product) => void;
}

export default function AdminPanel({
  products,
  onAddProduct,
  onDeleteProduct,
  onUpdateStock,
  onUpdateProduct,
  orders,
  onUpdateOrderStatus,
  onAssignPartner,
  riders,
  setRiders,
  isCustomerLoggedIn = false,
  userEmail = "",
  onCustomerLogout,
  combos = [],
  onAddCombo,
  onDeleteCombo,
}: AdminPanelProps) {
  // --- Admin Navigation & Auth States ---
  const [adminTab, setAdminTab] = useState<"kpis" | "products" | "combos" | "orders" | "riders" | "users">("kpis");
  const isLoggedIn = isCustomerLoggedIn && userEmail === "himanshu712007@gmail.com";

  // --- Real-Time Logged-In User Monitoring state ---
  const [userProfiles, setUserProfiles] = useState<UserProfileData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Sub-navigation tab selector for riders
  const [riderSubTab, setRiderSubTab] = useState<"tracking" | "manage" | "performance" | "analytics">("tracking");

  // CRUD Forms for Rider management
  const [crudRiderName, setCrudRiderName] = useState("");
  const [crudRiderPhone, setCrudRiderPhone] = useState("");
  const [crudRiderEmail, setCrudRiderEmail] = useState("");
  const [crudRiderVehicle, setCrudRiderVehicle] = useState("");
  const [crudRiderPassword, setCrudRiderPassword] = useState("");
  const [editingRiderId, setEditingRiderId] = useState<string | null>(null);
  const [deletingRiderId, setDeletingRiderId] = useState<string | null>(null);
  const [crudError, setCrudError] = useState("");
  const [crudSuccess, setCrudSuccess] = useState("");

  // Product Add Form State
  const [pName, setPName] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pCategory, setPCategory] = useState("fruits");
  const [pWeight, setPWeight] = useState("");
  const [pMarketPrice, setPMarketPrice] = useState("");
  const [pSellingPrice, setPSellingPrice] = useState("");
  const [pStock, setPStock] = useState("");
  const [pImage, setPImage] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pError, setPError] = useState("");
  const [pSuccessMsg, setPSuccessMsg] = useState("");

  // Product Edit Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPName, setEditPName] = useState("");
  const [editPBrand, setEditPBrand] = useState("");
  const [editPCategory, setEditPCategory] = useState("fruits");
  const [editPWeight, setEditPWeight] = useState("");
  const [editPMarketPrice, setEditPMarketPrice] = useState("");
  const [editPSellingPrice, setEditPSellingPrice] = useState("");
  const [editPStock, setEditPStock] = useState("");
  const [editPImage, setEditPImage] = useState("");
  const [editPDesc, setEditPDesc] = useState("");
  const [editPAvailable, setEditPAvailable] = useState(true);
  const [editError, setEditError] = useState("");
  const [editSuccessMsg, setEditSuccessMsg] = useState("");

  const [selectedRiderId, setSelectedRiderId] = useState<string>("rider-1");

  // Admin Combos Suite Form States
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboTitle, setComboTitle] = useState("");
  const [comboSellingPrice, setComboSellingPrice] = useState("");
  const [comboBadge, setComboBadge] = useState("");
  const [comboImage, setComboImage] = useState("");
  const [comboDescription, setComboDescription] = useState("");
  const [selectedComboProductIds, setSelectedComboProductIds] = useState<string[]>([]);
  const [comboError, setComboError] = useState("");
  const [comboSuccess, setComboSuccess] = useState("");

  const computedOriginalPrice = selectedComboProductIds.reduce((acc, id) => {
    const prd = products.find((p) => p.id === id);
    return acc + (prd ? prd.sellingPrice : 0);
  }, 0);

  const handleCreateComboSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setComboError("");
    setComboSuccess("");

    if (!comboTitle.trim()) {
      setComboError("Combo title is required.");
      return;
    }
    if (selectedComboProductIds.length < 2) {
      setComboError("A combo must consist of at least 2 products!");
      return;
    }
    const sellPrice = Number(comboSellingPrice);
    if (!sellPrice || sellPrice <= 0) {
      setComboError("Please enter a valid numeric combo selling price.");
      return;
    }

    // Auto-map first product's image if none provided
    let finalImg = comboImage.trim();
    if (!finalImg) {
      const firstProduct = products.find((p) => p.id === selectedComboProductIds[0]);
      if (firstProduct) {
        finalImg = firstProduct.image;
      }
    }

    const savingsAmount = computedOriginalPrice - sellPrice;

    const freshCombo: ComboDeal = {
      id: editingComboId || `combo-${Date.now()}`,
      title: comboTitle.trim(),
      name: comboTitle.trim(),
      productIds: selectedComboProductIds,
      originalPrice: computedOriginalPrice,
      sellingPrice: sellPrice,
      comboPrice: sellPrice,
      savings: savingsAmount,
      image: finalImg || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200",
      badge: comboBadge.trim() || `SAVE ₹${savingsAmount}`,
      description: comboDescription.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      onAddCombo?.(freshCombo);
      if (editingComboId) {
        setComboSuccess("Combo deal successfully updated!");
      } else {
        setComboSuccess("Combo deal successfully forged!");
      }
      // Reset form fields
      setEditingComboId(null);
      setComboTitle("");
      setComboSellingPrice("");
      setComboBadge("");
      setComboImage("");
      setComboDescription("");
      setSelectedComboProductIds([]);
    } catch (err: any) {
      setComboError("Failed to save combo: " + err.message);
    }
  };

  // Periodic visual GPS Coordinate simulation for delivery boys
  useEffect(() => {
    if (adminTab !== "riders" || !isLoggedIn) return;
    const gpsInterval = setInterval(() => {
      setRiders((prevRiders) =>
        prevRiders.map((runner) => {
          if (!runner.isActiveOnDuty) return runner;
          // Apply natural route simulation variation
          const deltaLat = (Math.random() - 0.5) * 3.4;
          const deltaLng = (Math.random() - 0.5) * 3.4;
          const currentBattery = parseInt(runner.battery || "100", 10);
          return {
            ...runner,
            lat: Math.max(12, Math.min(88, runner.lat + deltaLat)),
            lng: Math.max(12, Math.min(88, runner.lng + deltaLng)),
            battery: `${Math.max(10, currentBattery - (Math.random() > 0.85 ? 1 : 0))}%`
          };
        })
      );
    }, 4000);

    return () => clearInterval(gpsInterval);
  }, [adminTab, isLoggedIn, setRiders]);

  // Dynamic user profiles fetching trigger on tab switch
  useEffect(() => {
    if ((adminTab === "users" || adminTab === "kpis") && isLoggedIn) {
      const loadUsers = async () => {
        setLoadingUsers(true);
        try {
          const profiles = await fetchUserProfilesFromFirebase();
          setUserProfiles(profiles);
        } catch (err) {
          console.warn("Could not load user profiles for admin terminal", err);
        } finally {
          setLoadingUsers(false);
        }
      };
      loadUsers();
    }
  }, [adminTab, isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem("smartcart_admin_logged_in");
    if (onCustomerLogout) {
      onCustomerLogout();
    }
  };

  // Inject Product Cards inside client-state
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName || !pBrand || !pWeight || !pMarketPrice || !pSellingPrice || !pStock || !pImage) {
      setPError("All fields marked with * are strictly mandatory to compile a new product card.");
      return;
    }

    const mPrice = parseFloat(pMarketPrice);
    const sPrice = parseFloat(pSellingPrice);
    const stock = parseInt(pStock);

    if (isNaN(mPrice) || isNaN(sPrice) || isNaN(stock)) {
      setPError("Prices and inventory stock values must be valid integers/floats.");
      return;
    }

    const discount = Math.round(((mPrice - sPrice) / mPrice) * 100);

    onAddProduct({
      name: pName,
      brand: pBrand,
      category: pCategory,
      weight: pWeight,
      marketPrice: mPrice,
      sellingPrice: sPrice,
      discount: Math.max(0, discount),
      stock,
      image: pImage,
      description: pDesc || "Fresh, hand-inspected essentials straight from SmartCart hubs.",
      isFeatured: false,
      isBestOffer: discount >= 20,
      rating: 4.5,
      ratingCount: 1,
    });

    setPName("");
    setPBrand("");
    setPWeight("");
    setPMarketPrice("");
    setPSellingPrice("");
    setPStock("");
    setPImage("");
    setPDesc("");
    setPError("");
    setPSuccessMsg(`Successfully added "${pName}" to the virtual catalog database!`);
    setTimeout(() => setPSuccessMsg(""), 4000);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditPName(prod.name);
    setEditPBrand(prod.brand || "");
    setEditPCategory(prod.category);
    setEditPWeight(prod.weight || "");
    setEditPMarketPrice(String(prod.marketPrice));
    setEditPSellingPrice(String(prod.sellingPrice));
    setEditPStock(String(prod.stock || 0));
    setEditPImage(prod.image || "");
    setEditPDesc(prod.description || "");
    setEditPAvailable(prod.available !== undefined ? prod.available : (prod.stock > 0));
    setEditError("");
    setEditSuccessMsg("");
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editPName || !editPBrand || !editPWeight || !editPMarketPrice || !editPSellingPrice || !editPImage) {
      setEditError("All fields marked with * are strictly mandatory to compile product changes.");
      return;
    }

    const mPrice = parseFloat(editPMarketPrice);
    const sPrice = parseFloat(editPSellingPrice);
    const stockVal = parseInt(editPStock);

    if (isNaN(mPrice) || isNaN(sPrice) || isNaN(stockVal)) {
      setEditError("Prices and inventory stock values must be valid integers/floats.");
      return;
    }

    const computedDiscount = mPrice > 0 ? Math.round(((mPrice - sPrice) / mPrice) * 100) : 0;
    
    // If availability is explicitly toggled off, force stock to 0.
    // If availability is toggled on but stock was 0, default it to at least 1, or keep what they supplied.
    let finalStock = editPAvailable ? stockVal : 0;
    if (editPAvailable && finalStock <= 0) {
      finalStock = 1;
    }
    const finalAvailable = editPAvailable && finalStock > 0;

    const updatedProductData: Product = {
      ...editingProduct, // preserves rating, ratingCount, ingredients, nutrition, etc.
      name: editPName.trim(),
      brand: editPBrand.trim(),
      category: editPCategory,
      weight: editPWeight.trim(),
      marketPrice: mPrice,
      sellingPrice: sPrice,
      discount: Math.max(0, computedDiscount),
      stock: finalStock,
      image: editPImage.trim(),
      description: editPDesc.trim(),
      available: finalAvailable,
      price: sPrice,
      mrp: mPrice,
    };

    try {
      if (onUpdateProduct) {
        await onUpdateProduct(updatedProductData);
      }
      setEditSuccessMsg("✅ Product Updated Successfully");
      setEditError("");
      
      setTimeout(() => {
        setEditingProduct(null);
        setEditSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setEditError("Failed to update product card: " + err.message);
    }
  };

  // Summary Metrics calculations
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.total, 0);
  const lowStockProducts = products.filter((p) => p.stock <= 15);
  const distinctCustomers = Array.from(new Set(orders.map((o) => o.address.phone))).length;

  const DELIV_PARTNERS = riders.map((r) => r.name);

  // ================= MAIN SECURED ADMIN DASHBOARD =================
  const activeRider = riders.find((r) => r.id === selectedRiderId) || riders[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6" id="admin-panel-section">
      
      {/* Title Header with user badge and logout button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 mb-6 text-left">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">SmartCart Administrator Terminal</h1>
            <span className="bg-orange-100 text-orange-700 text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">Secure Slot 1/1</span>
          </div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">Control center & Logistics fulfillment terminal</p>
          
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Firebase Active
            </span>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
              smart-cart-a7b07
            </span>
          </div>
        </div>

        {/* Action switch and Logout key */}
        <div className="flex items-center gap-2 self-start flex-wrap">
          <div className="flex bg-gray-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setAdminTab("kpis")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                adminTab === "kpis" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              KPIs
            </button>
            <button
              onClick={() => setAdminTab("products")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                adminTab === "products" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setAdminTab("combos")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center space-x-1 ${
                adminTab === "combos" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              <Package className="h-3.5 w-3.5 text-rose-500 animate-pulse shrink-0" />
              <span>Combos ({combos.length})</span>
            </button>
            <button
              onClick={() => setAdminTab("orders")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                adminTab === "orders" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              Orders ({orders.filter((o) => o.status !== "delivered").length})
            </button>
            <button
              onClick={() => setAdminTab("riders")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center space-x-1 ${
                adminTab === "riders" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              <Bike className="h-3 w-3 text-orange-500" />
              <span>Riders Map</span>
            </button>
            <button
              onClick={() => setAdminTab("users")}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center space-x-1 ${
                adminTab === "users" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-955"
              }`}
            >
              <Users className="h-3 w-3 text-teal-650" />
              <span>Users ({userProfiles.length})</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 border border-gray-200 bg-white hover:bg-red-50 hover:text-red-650 hover:border-red-200 text-gray-500 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer"
            title="Terminate Operational Session"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ================= DATA KPI'S DASHBOARD TAB ================= */}
      {adminTab === "kpis" && (
        <div className="space-y-6 animate-in fade-in duration-205 text-left">
          
          {/* Summary KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-green-50/40 border border-green-100 rounded-2xl p-4.5">
              <div className="flex items-center justify-between text-green-600 mb-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase bg-green-100 px-2 py-0.5 rounded text-green-700">Live Today</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Gross Revenue</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">₹{totalRevenue}</h3>
              <p className="text-[10px] text-green-600 font-bold">100% database synched sales</p>
            </div>

            <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4.5">
              <div className="flex items-center justify-between text-orange-600 mb-2">
                <ShoppingBag className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase bg-orange-100 px-2 py-0.5 rounded text-orange-700">Fullfilled</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Total Deliveries</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">{orders.length} Orders</h3>
              <p className="text-[10px] text-orange-600 font-bold">{orders.filter(o => o.status === "delivered").length} delivered safely</p>
            </div>

            <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4.5">
              <div className="flex items-center justify-between text-blue-600 mb-2">
                <Users className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase bg-blue-100 px-2 py-0.5 rounded text-blue-700">Client Profiles</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Unique Customers</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">{distinctCustomers || 1} Profiles</h3>
              <p className="text-[10px] text-blue-605 font-bold">Safe Guest Checkout setup</p>
            </div>

            <div className="bg-red-50/40 border border-red-100 rounded-2xl p-4.5">
              <div className="flex items-center justify-between text-red-500 mb-2">
                <ShieldAlert className="h-5 w-5" />
                {lowStockProducts.length > 0 && (
                  <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 animate-pulse px-1.5 py-0.5 rounded">
                    Action Needed
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Low-Stock Warnings</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">{lowStockProducts.length} Items</h3>
              <p className="text-[10px] text-red-505 font-bold">Stock levels &lt;= 15 units</p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Low Stock Alerts (2 columns) */}
            <div className="md:col-span-2 bg-white border border-gray-150 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3.5 mb-4">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Low Stock Inventory Alerts</h3>
                </div>
                <span className="text-[10px] font-extrabold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">Hub ID: ND01-DL</span>
              </div>

              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-green-700 bg-green-50 p-3.5 rounded-2xl border border-green-150 font-medium">
                  ✓ Excellent! All inventory cards currently fulfill the minimum stock reserve margins of 15 items.
                </p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto pr-1">
                  {lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center space-x-3 text-left">
                        <img src={p.image} alt={p.name} className="h-8 w-8 rounded-lg object-cover bg-gray-50" />
                        <div>
                          <p className="text-xs font-bold text-gray-800">{p.name}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{p.brand} • {p.category}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className="text-[10px] font-black text-red-650 bg-red-50 px-2 py-0.5 rounded-md uppercase">
                          Only {p.stock} Qty Left
                        </span>
                        
                        <button
                          onClick={() => onUpdateStock(p.id, p.stock + 50)}
                          className="rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-[10px] uppercase px-3 py-1.5 transition cursor-pointer"
                        >
                          Restock +50
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terminal Live Overview */}
            <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-3">
                  <div className="flex items-center space-x-1.5 text-gray-850">
                    <Activity className="h-4.5 w-4.5 text-orange-500 animate-pulse" />
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Operational Health</h3>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center text-left">
                    <span className="text-gray-405 font-medium">GPS Status</span>
                    <span className="font-bold text-green-600 flex items-center gap-1">
                      <Signal className="h-3 w-3" /> Broadcaster Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-405 font-medium">Auto-Dispatcher</span>
                    <span className="font-bold text-gray-800">Dynamic allocation</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-405 font-medium">Simulated Network</span>
                    <span className="font-bold text-emerald-600">Secure (Cloud Run Tunnel)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-405 font-medium">Active Riders</span>
                    <span className="font-bold text-orange-600">{riders.filter(r => r.isActiveOnDuty).length} Transit</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-2xl text-[10px] text-gray-400 font-semibold leading-relaxed mt-4">
                📌 Operations terminal synched permanently to database and linked with active tracking widgets. Outbound order placement triggers live status changes.
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ================= FULFILLMENT INVENTORY TAB ================= */}
      {adminTab === "products" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-200 text-left">
          
          {/* Create Catalog Card form */}
          <div className="md:col-span-1 bg-gray-50/50 border border-gray-150 rounded-3xl p-5 text-left h-fit">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-1 font-sans">Establish Catalog Card</h3>
            <p className="text-xs text-gray-400 font-semibold mb-4 leading-none">Inject a new item into catalog database memory</p>
            
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-[9px] font-black text-gray-450 uppercase">Product Name *</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none focus:ring-1 focus:ring-orange-500"
                  required
                  placeholder="e.g. Fresh Garden Celery"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">Brand / Farm *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none focus:ring-1 focus:ring-orange-500"
                    required
                    placeholder="e.g. GreenGlow"
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">Weight Metrics *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none focus:ring-1 focus:ring-orange-500"
                    required
                    placeholder="e.g. 250 g bunch"
                    value={pWeight}
                    onChange={(e) => setPWeight(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">MRP *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none"
                    required
                    placeholder="70"
                    value={pMarketPrice}
                    onChange={(e) => setPMarketPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">Offer Price *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none"
                    required
                    placeholder="55"
                    value={pSellingPrice}
                    onChange={(e) => setPSellingPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-455 uppercase">Initial Qty *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none"
                    required
                    placeholder="40"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">Category Section</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none"
                  >
                    {INITIAL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-450 uppercase">Image URL *</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-400 outline-none"
                    required
                    placeholder="Graphic link"
                    value={pImage}
                    onChange={(e) => setPImage(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-450 uppercase">Brief Description</label>
                <textarea
                  className="w-full h-16 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium placeholder-gray-450 outline-none"
                  placeholder="Nutrition summary or general info"
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                />
              </div>

              {pError && <p className="text-[10px] font-bold text-red-500 leading-normal">{pError}</p>}
              {pSuccessMsg && <p className="text-[10px] font-bold text-green-600 leading-normal">{pSuccessMsg}</p>}

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs p-3 transition tracking-wider cursor-pointer font-sans"
              >
                <Plus className="h-4 w-4" />
                <span>Inject Product Card</span>
              </button>
            </form>
          </div>

          {/* Fulfillment table */}
          <div className="md:col-span-2 bg-white border border-gray-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider mb-1">Fulfillment Registry</h3>
              <p className="text-xs text-gray-400 font-semibold mb-4 leading-none">{products.length} active items logged in memory</p>
              
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-extrabold uppercase text-[9px] tracking-widest">
                      <th className="pb-3.5 pl-1">Product Details</th>
                      <th className="pb-3.5">Pricing</th>
                      <th className="pb-3.5">Reservations (Stock)</th>
                      <th className="pb-3.5 text-right pr-2">Control Keys</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map((p) => {
                      const isLow = p.stock <= 15;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-2.5 pl-1">
                            <div className="flex items-center space-x-2.5">
                              <img src={p.image} alt={p.name} className="h-8 w-8 rounded-lg object-cover bg-gray-50" />
                              <div>
                                <p className="font-bold text-gray-800 truncate max-w-[170px]">{p.name}</p>
                                <p className="text-[9px] text-gray-400 font-semibold uppercase">{p.brand} • {p.category}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5">
                            <div className="flex flex-col text-left text-[11px]">
                              <span className="font-bold text-gray-800">₹{p.sellingPrice}</span>
                              <span className="text-[9px] text-gray-400 line-through">₹{p.marketPrice}</span>
                            </div>
                          </td>

                          <td className="py-2.5">
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                className={`w-14 rounded-lg bg-gray-100 p-1 text-center font-bold text-xs border border-transparent outline-none ${
                                  isLow ? "text-red-500 font-black animate-pulse bg-red-50" : "text-gray-800"
                                }`}
                                value={p.stock}
                                onChange={(e) => onUpdateStock(p.id, Math.max(0, parseInt(e.target.value) || 0))}
                              />
                              <span className="text-[9px] text-gray-400 font-bold uppercase leading-none">Units</span>
                            </div>
                          </td>

                          <td className="py-2.5 text-right pr-2">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenEditProduct(p)}
                                className="text-orange-600 hover:bg-orange-50 border border-orange-200/50 hover:border-orange-200 p-1.5 px-2.5 rounded-xl transition flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer bg-orange-50/20"
                                title="Edit Item"
                              >
                                <span>✏️</span>
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => onDeleteProduct(p.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition border border-gray-100 hover:border-red-200 cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-gray-105 pt-4 mt-4 text-[10px] text-gray-400 font-bold uppercase">
              ⚠️ Catalog configuration is interactive. Refreshing bootstraps items to baseline indices.
            </div>
          </div>

        </div>
      )}

      {/* ================= ACTIVE LIVE ORDERS REGISTRY TAB ================= */}
      {adminTab === "orders" && (
        <div className="space-y-4 animate-in fade-in duration-200 text-left">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Live Inbound Orders Fulfullment</h3>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5">Control timeline stages, dispatch cycles, and allocate logistics riders</p>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-150 rounded-3xl bg-white">
              <div className="h-14 w-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <ShoppingBag className="h-7 w-7 text-gray-300" />
              </div>
              <h4 className="text-xs font-bold text-gray-800">No Orders in Hub Registry</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px]">User bookings automatically populate here for terminal management.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...orders].sort((a, b) => {
                const isUndeliveredA = a.status !== "delivered";
                const isUndeliveredB = b.status !== "delivered";
                if (isUndeliveredA !== isUndeliveredB) {
                  return isUndeliveredA ? -1 : 1;
                }
                const getOrderTime = (o: Order) => {
                  if (o.placed_at) {
                    const parsed = new Date(o.placed_at).getTime();
                    if (!isNaN(parsed)) return parsed;
                  }
                  const parsedDate = Date.parse(o.date);
                  if (!isNaN(parsedDate)) return parsedDate;
                  return 0;
                };
                const timeA = getOrderTime(a);
                const timeB = getOrderTime(b);
                if (timeA !== timeB) {
                  return timeB - timeA;
                }
                return b.id.localeCompare(a.id);
              }).map((order) => {
                const isDelivered = order.status === "delivered";
                const isCancelled = order.status === "cancelled";
                return (
                  <div key={order.id} className="bg-white border border-gray-150 rounded-3xl p-4.5 hover:border-gray-200 transition text-left">
                    
                    {/* Unique Order ID Details */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                      <div>
                        <h4 className="text-xs font-black text-gray-850">ID: #{order.id}</h4>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{order.date} • Total Paid: <strong>₹{order.total}</strong></p>
                      </div>

                      <div className="relative">
                        <span
                          className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase ${
                            isDelivered 
                              ? "bg-green-105 bg-green-100 text-green-700 border-green-200" 
                              : isCancelled
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-orange-100 text-orange-700 border-orange-200 animate-pulse"
                          }`}
                        >
                          {order.status === "placed" && "Placed"}
                          {order.status === "confirmed" && "Confirmed"}
                          {order.status === "packed" && "Packed"}
                          {order.status === "out_for_delivery" && "Out for Delivery"}
                          {order.status === "delivered" && "Delivered"}
                          {order.status === "cancelled" && "Cancelled"}
                        </span>
                      </div>
                    </div>

                    {/* Booking items list */}
                    <div className="mb-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Booked Items ({order.items.length})</p>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] text-gray-700 font-medium">
                            <span className="truncate max-w-[220px]">{item.product.name} ({item.product.weight})</span>
                            <span className="font-bold">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer location details */}
                    <div className="space-y-1 text-xs mb-3 font-medium">
                      <p className="text-gray-800">
                        Recipient: <strong className="font-extrabold">{order.address.name}</strong> ({order.address.phone})
                      </p>
                      <p className="text-gray-500 truncate" title={order.address.addressLine}>
                        Address: <span className="capitalize font-bold text-gray-700">{order.address.label}</span> • {order.address.addressLine}
                      </p>
                      <p className="text-[10px] text-green-600 font-bold animate-pulse inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Delivery: Instant (ASAP)
                      </p>
                    </div>

                    {/* Admin Pricing Breakdown info */}
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 px-2.5 text-[10px] font-medium text-gray-500 space-y-0.5 mb-3">
                      <div className="flex justify-between">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-gray-800">₹{order.subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Charge:</span>
                        <span className={order.deliveryCharge === 0 ? "font-bold text-green-600" : "font-bold text-gray-800"}>
                          {order.deliveryCharge === 0 ? "FREE" : `₹${order.deliveryCharge}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Fee:</span>
                        <span className="font-bold text-gray-800">₹{order.platformFee ?? 3}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Handling Charge:</span>
                        <span className="font-bold text-gray-800">₹{order.handlingCharge ?? 10}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1 text-[11px] font-black text-gray-900">
                        <span>Total Bill:</span>
                        <span>₹{order.total}</span>
                      </div>
                    </div>

                    {/* Dispatch Rider Allocation Controls */}
                    <div className="pt-2.5 border-t border-gray-50 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                      <div>
                        <p className="text-[9px] text-gray-400 font-semibold uppercase">Assigned Delivery Boy</p>
                        <p className="font-bold text-gray-800 mt-1">{order.deliveryPartner?.name || "Unassigned"}</p>
                      </div>

                      <div className="w-full sm:w-40">
                        <p className="text-[9px] text-gray-400 font-semibold uppercase mb-1">Update Status</p>
                        <select
                          value={order.status}
                          onChange={(e) => {
                            onUpdateOrderStatus(order.id, e.target.value as any);
                          }}
                          className="block w-full text-[11px] font-bold border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="placed">Order Received</option>
                          <option value="accepted">Accepted</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="packed">Packed</option>
                          <option value="out_for_delivery">On The Way</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= SIMULATED RIDER PORTAL ADMINISTRATION ================= */}
      {adminTab === "riders" && (
        <div className="space-y-6 animate-in fade-in duration-200 text-left">
          
          {/* Split sub tabs buttons selection */}
          <div className="flex border-b border-gray-150 pb-3 mb-2 justify-between items-center flex-wrap gap-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider">Logistics & Rider Administration</h3>
              <p className="text-[11px] text-gray-400 font-medium">Create delivery partner slots, toggle active beacons, and track coordinates mapping</p>
            </div>
            
             <div className="flex space-x-2 bg-gray-50/80 p-1 rounded-xl border border-gray-150 shrink-0 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setRiderSubTab("tracking")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                  riderSubTab === "tracking" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                📍 Live Rider Tracking
              </button>
              <button
                type="button"
                onClick={() => setRiderSubTab("manage")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                  riderSubTab === "manage" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                📋 Rider Management
              </button>
              <button
                type="button"
                onClick={() => setRiderSubTab("performance")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                  riderSubTab === "performance" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                ⚡ Rider Performance
              </button>
              <button
                type="button"
                onClick={() => setRiderSubTab("analytics")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                  riderSubTab === "analytics" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                📊 Delivery Analytics
              </button>
            </div>
          </div>

          {/* CRITICAL WARNING SUMMARY BADGE */}
          {crudError && (
            <div className="p-3 bg-red-500/10 border border-red-505/20 text-red-500 rounded-2xl text-xs font-bold leading-normal">
              ⚠️ {crudError}
            </div>
          )}
          {crudSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-505/20 text-green-600 rounded-2xl text-xs font-bold leading-normal">
              ✓ {crudSuccess}
            </div>
          )}

          {/* ====== SUBTAB A: LIVE RIDER TRACKING (NEW) ====== */}
          {riderSubTab === "tracking" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Dynamic Key metrics banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active On Duty</h4>
                    <p className="text-xl font-bold font-mono text-gray-900">
                      {riders.filter(r => r.isActiveOnDuty).length} <span className="text-[11px] font-medium text-gray-450">/ {riders.length}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-3 text-left">
                  <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Signal Ping Status</h4>
                    <p className="text-xl font-bold font-mono text-gray-900 text-green-600">
                      98<span className="text-[11px] font-medium">% Perfect</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-3 text-left">
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Avg Delivery Speed</h4>
                    <p className="text-xl font-bold font-mono text-gray-900">
                      13.8 <span className="text-[11px] font-medium">mins</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-3 text-left">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Orders</h4>
                    <p className="text-xl font-bold font-mono text-gray-900">
                      {orders.filter(o => o.status !== "delivered" && o.status !== "cancelled" && o.deliveryPartner).length} <span className="text-[11px] font-medium text-gray-450">assigned</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Main tracking workspace layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual Leaflet Interactive Map Frame */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white p-4 rounded-3xl border border-gray-150 shadow-xs space-y-3.5">
                    <div className="flex justify-between items-center text-left">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-gray-950 uppercase tracking-wider flex items-center space-x-1.5">
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          <span>Live GPS Satellite Tracking Map</span>
                        </h4>
                        <p className="text-[10px] text-gray-450 font-medium font-mono uppercase">MAP CENTERED ON DELHI NCT DELIVERY RANGE • RECHART ENGINE ACTIVE</p>
                      </div>
                      
                      {/* Interactive simulated movement shift */}
                      {(() => {
                        const activeR = riders.find((r) => r.id === selectedRiderId);
                        if (activeR && activeR.isActiveOnDuty) {
                          return (
                            <button
                              type="button"
                              onClick={async () => {
                                const latOffset = (Math.random() - 0.5) * 4;
                                const lngOffset = (Math.random() - 0.5) * 4;
                                const newLat = Math.max(15, Math.min(85, activeR.lat + latOffset));
                                const newLng = Math.max(15, Math.min(85, activeR.lng + lngOffset));
                                const updatedR: Rider = {
                                  ...activeR,
                                  lat: newLat,
                                  lng: newLng,
                                  lastUpdated: new Date().toISOString()
                                };
                                await syncRiderToFirebase(updatedR).catch(err => console.error(err));
                              }}
                              className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-250 rounded-xl transition flex items-center space-x-1 cursor-pointer"
                            >
                              <RefreshCw className="h-2.5 w-2.5 select-none animate-spin" style={{ animationDuration: '3s' }} />
                              <span>Simulate Beacon Movement</span>
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Integrated Map */}
                    <LiveRiderTrackingMap 
                      riders={riders}
                      selectedRiderId={selectedRiderId}
                      onSelectRider={(riderId) => setSelectedRiderId(riderId)}
                      orders={orders}
                    />
                  </div>

                  {/* Customer order routing route pathways indicator */}
                  {(() => {
                    const activeR = riders.find((r) => r.id === selectedRiderId);
                    if (!activeR) return null;
                    const assignedO = orders.find(
                      (o) =>
                        o.deliveryPartner?.name === activeR.name &&
                        o.status !== "delivered" &&
                        o.status !== "cancelled"
                    );
                    if (!assignedO) return null;
                    const coords = getOrderGridCoordinates(assignedO.address.addressLine, assignedO.id);
                    const dx = activeR.lat - coords.lat;
                    const dy = activeR.lng - coords.lng;
                    const gridDistance = Math.sqrt(dx * dx + dy * dy);
                    const distanceKm = (gridDistance * 0.15).toFixed(1);
                    const minsRemaining = Math.max(2, Math.round(gridDistance * 0.25));

                    return (
                      <div className="bg-orange-50/75 border border-orange-150 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-left animate-in stroke-in duration-200">
                        <div className="space-y-1">
                          <span className="bg-orange-100 text-orange-850 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">On-Route Delivery Tracking</span>
                          <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-wide">
                            Order #{assignedO.id} is in transit to "{assignedO.address.name}"
                          </h5>
                          <p className="text-[10px] text-gray-455 font-medium font-sans">
                            Delivery Address: {assignedO.address.addressLine}, {assignedO.address.city}
                          </p>
                        </div>
                        <div className="bg-white border border-orange-100 p-2.5 rounded-xl font-mono text-center shrink-0 min-w-[130px]">
                          <div className="text-[9px] font-bold text-gray-450 uppercase">Distance & ETA</div>
                          <div className="text-base font-bold text-gray-900">{distanceKm} km left</div>
                          <div className="text-[10px] font-black text-orange-600 uppercase">⌛ Approx. {minsRemaining} mins</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Col 3: Right Rider Diagnostics List & Controller Sheet */}
                <div className="space-y-4 text-left">
                  
                  {/* On Duty Riders list feed */}
                  <div className="bg-white p-4.5 rounded-3xl border border-gray-150 shadow-xs space-y-3 shrink-0">
                    <h3 className="text-xs font-black text-gray-950 uppercase tracking-wider">Active On-Duty Courier Feed</h3>

                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {riders.filter(r => r.isActiveOnDuty).map((r) => {
                        const isChosen = r.id === selectedRiderId;
                        const activeCount = orders.filter(
                          (o) => o.deliveryPartner?.name === r.name && o.status !== "delivered" && o.status !== "cancelled"
                        ).length;

                        return (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRiderId(r.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isChosen 
                                ? "bg-orange-50/55 border-orange-300 ring-2 ring-orange-500/10 shadow-xs" 
                                : "bg-gray-50/50 border-gray-150 hover:bg-gray-50 hover:border-gray-250"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <RiderAvatar name={r.name} className="h-8 w-8 text-xs shrink-0" />
                              <div className="space-y-0.5 min-w-0">
                                <h4 className="font-bold text-[11px] text-gray-900 truncate leading-snug">{r.name}</h4>
                                <p className="text-[9px] text-gray-400 font-mono tracking-tight truncate uppercase font-semibold">
                                  {r.vehicleNumber}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono space-y-0.5">
                              <div className="flex items-center justify-end space-x-1.5">
                                {activeCount > 0 ? (
                                  <span className="bg-orange-100 text-orange-755 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider">
                                    {activeCount} active
                                  </span>
                                ) : (
                                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider">
                                    idle
                                  </span>
                                )}
                                <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse shadow-xs"></span>
                              </div>
                              <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">On-Duty</div>
                            </div>
                          </div>
                        );
                      })}

                      {riders.filter(r => r.isActiveOnDuty).length === 0 && (
                        <div className="text-center p-6 bg-slate-50 border border-dashed rounded-xl text-gray-400 text-[11px] font-medium font-sans">
                          No couriers are currently active on-duty. Go to Rider Accounts DB to toggle someone session on.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rider Detail Diagnostics Sheet */}
                  <div className="bg-white p-4.5 rounded-3xl border border-gray-150 shadow-xs space-y-3.5">
                    <h3 className="text-xs font-black text-gray-950 uppercase tracking-wider">Telemetry Diagnostics Center</h3>
                    
                    {(() => {
                      const activeRider = riders.find((r) => r.id === selectedRiderId);
                      
                      if (!activeRider) {
                        return (
                          <div className="text-center text-xs p-8 text-gray-455 font-semibold leading-normal border border-dashed rounded-2xl">
                            Select an active rider marker or profile catalog slot to initiate real-time streaming diagnostics
                          </div>
                        );
                      }

                      const activeDelivery = orders.find(
                        (o) => o.deliveryPartner?.name === activeRider.name && o.status !== "delivered" && o.status !== "cancelled"
                      );

                      const locationRecency = () => {
                        if (!activeRider.lastUpdated) {
                          return <span className="bg-amber-500/10 text-amber-600 border border-amber-505/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">stale</span>;
                        }
                        const diffMs = Date.now() - new Date(activeRider.lastUpdated).getTime();
                        const diffSec = Math.floor(diffMs / 1000);
                        if (diffSec < 45) {
                          return (
                            <span className="flex items-center space-x-1 bg-green-500/10 text-green-600 border border-green-550/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                              <span className="h-1.5 w-1.5 bg-green-600 rounded-full"></span>
                              <span>live</span>
                            </span>
                          );
                        } else if (diffSec < 180) {
                          return <span className="bg-slate-105 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider">ready</span>;
                        } else {
                          return <span className="bg-amber-100 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">stale</span>;
                        }
                      };

                      return (
                        <div className="space-y-4 divide-y divide-gray-100">
                          
                          {/* Profile Header */}
                          <div className="flex items-center space-x-3 pb-3">
                            <RiderAvatar name={activeRider.name} className="h-10 w-10 text-sm" />
                            <div className="space-y-0.5 truncate text-left">
                              <h4 className="font-bold text-gray-955 text-xs truncate leading-snug">{activeRider.name}</h4>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide truncate">{activeRider.phone}</p>
                            </div>
                          </div>

                          {/* Stats parameters */}
                          <div className="space-y-2 pt-3 text-[10px] uppercase font-bold tracking-wider">
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-455">Session Status:</span>
                              <strong className={`uppercase font-sans font-black ${activeRider.isActiveOnDuty ? "text-green-600" : "text-gray-400"}`}>
                                {activeRider.isActiveOnDuty ? "ON DUTY" : "OFF DUTY"}
                              </strong>
                            </div>
                            <div className="flex justify-between font-medium items-center text-left">
                              <span className="text-gray-455">Location GPS State:</span>
                              {locationRecency()}
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-455">Estimated Position:</span>
                              <strong className="text-gray-900 font-mono text-[9px] tracking-tight">{activeRider.lat.toFixed(4)}° N, {activeRider.lng.toFixed(4)}° E</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Battery Health Level:</span>
                              <strong className="text-green-600">{activeRider.battery || "100%"}</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-455">Active Orders Count:</span>
                              <strong className="text-gray-955 font-mono">{activeDelivery ? "1" : "0"} in transit</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-455">Assign Shipment:</span>
                              <strong className="text-orange-500 font-bold uppercase">{activeDelivery ? `#${activeDelivery.id}` : "Unassigned"}</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-455">Vehicle PIN-code:</span>
                              <strong className="text-gray-900 font-mono text-[10px] font-bold uppercase">{activeRider.vehicleNumber}</strong>
                            </div>
                          </div>

                          {/* Dispatch alert trigger action */}
                          <div className="pt-3">
                            <button
                              type="button"
                              onClick={() => alert(`Rider line connected. Simulated secure administrative VOIP call payload dispatched to phone: ${activeRider.phone}`)}
                              className="w-full inline-flex items-center justify-center space-x-1 border border-gray-205 rounded-xl bg-orange-500 text-white hover:bg-orange-600 py-2.5 text-[10px] font-black uppercase shadow-xs transition cursor-pointer"
                            >
                              <ExternalLink className="h-3 w-3 select-none" />
                              <span>Dispatch Direct Call</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ====== SUBTAB C: RIDER PERFORMANCE ====== */}
          {riderSubTab === "performance" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-xs text-left">
                <div className="border-b pb-4 mb-4">
                  <h4 className="text-sm font-black text-gray-955 uppercase tracking-wider">Courier Performance Audit</h4>
                  <p className="text-[11px] text-gray-400 font-medium font-sans">Weekly compliance targets, rating trends, and speed metrics for logistics personnel</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {riders.map((r) => {
                    const rating = r.completedDeliveries > 15 ? 4.9 : (r.completedDeliveries > 10 ? 4.8 : 4.4);
                    const compliance = r.completedDeliveries > 15 ? "99.2%" : "96.4%";
                    
                    return (
                      <div key={r.id} className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50 space-y-3">
                        <div className="flex items-center space-x-3.5 text-left">
                          <RiderAvatar name={r.name} className="h-10 w-10 text-xs shrink-0" />
                          <div className="truncate">
                            <h5 className="font-extrabold text-xs text-gray-955 truncate leading-snug">{r.name}</h5>
                            <span className="bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded text-[8px] font-black uppercase">{r.vehicleNumber.slice(0, 7)}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-gray-200/50 font-mono text-[10px] font-bold text-gray-500 uppercase text-left">
                          <div className="flex justify-between">
                            <span>Fulfill Rate:</span>
                            <span className="text-gray-900">{r.completedDeliveries} delivered</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Compliance:</span>
                            <span className="text-green-600">{compliance}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customer Rating:</span>
                            <span className="text-amber-600 font-bold">★ {rating} / 5</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Speed:</span>
                            <span className="text-indigo-600 font-bold">{r.avgDeliveryTime || 14} mins</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ====== SUBTAB D: DELIVERY ANALYTICS ====== */}
          {riderSubTab === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                
                {/* Fulfillment metrics block */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-150 shadow-xs space-y-4">
                  <div className="border-b pb-3 text-left">
                    <h4 className="text-xs font-black text-gray-955 uppercase tracking-wider">Demand Slot Heatmap</h4>
                    <p className="text-[10px] text-gray-400 font-semibold font-mono uppercase mt-0.5">Peak hour delivery requests logs — hourly load simulation</p>
                  </div>

                  {/* Hourly Peak Load Simulated bars */}
                  <div className="space-y-3.5 font-mono text-[9px] font-bold uppercase text-gray-500 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Morning Rush slot (8 AM - 11 AM) • breakfast essentials</span>
                        <span className="text-orange-600 font-bold font-mono">high load (87%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full animate-out shrink duration-1000" style={{ width: "87%" }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Lunch Slot (12 PM - 3 PM) • quick meal kits</span>
                        <span className="text-amber-600 font-bold font-mono">moderate load (45%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: "45%" }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Evening Slot (5 PM - 8 PM) • daily groceries rush</span>
                        <span className="text-red-500 font-bold font-mono">critical peak (96%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full rounded-full" style={{ width: "96%" }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Night Slot (8 PM - 11 PM) • snacks & dinner</span>
                        <span className="text-indigo-600 font-bold font-mono">steady load (54%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: "54%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fleet specifications bento block */}
                <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-xs space-y-4">
                  <div className="border-b pb-3 text-left">
                    <h4 className="text-xs font-black text-gray-955 uppercase tracking-wider">Vehicle specifications split</h4>
                    <p className="text-[10px] text-gray-400 font-semibold font-mono uppercase mt-0.5">Active Fleet distribution categories</p>
                  </div>

                  <div className="space-y-3 text-[10px] font-bold uppercase tracking-wide">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-500/10 text-green-700">
                      <span>⚡ Electric Scooters (EV):</span>
                      <strong className="font-mono text-xs">2 active</strong>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/10 text-orange-755">
                      <span>🛵 Petrol Scooters:</span>
                      <strong className="font-mono text-xs">1 active</strong>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-105 text-slate-700 font-sans">
                      <span>🚲 Manual Bicycles:</span>
                      <strong className="font-mono text-xs font-bold">1 rest mode</strong>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ====== SUBTAB B: RIDER CRUD ACCOUNTS DB VIEW ====== */}
          {riderSubTab === "manage" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: List of Riders database */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">Registered Carrier Accounts List</h4>
                  <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full uppercase leading-none">{riders.length} Slots</span>
                </div>

                {riders.length === 0 ? (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center text-xs text-gray-400 font-medium leading-relaxed">
                    No riders have been created yet. Use the CRUD Form on the right to register your logistics team members! Only managers can assign slots.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {riders.map((r) => {
                      const activeDelivery = orders.find(
                        (o) => o.deliveryPartner?.name === r.name && o.status !== "delivered"
                      );

                      return (
                        <div 
                          key={r.id} 
                          className="bg-white border rounded-2xl p-4 shadow-xs relative flex flex-col justify-between hover:border-gray-300 transition"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center space-x-2.5">
                              <RiderAvatar name={r.name} className="h-10 w-10 text-xs" />
                              <div>
                                <h4 className="text-xs font-bold text-gray-900 capitalize">{r.name}</h4>
                                <p className="text-[9px] font-bold text-orange-500 tracking-wider uppercase">{r.vehicleNumber}</p>
                                <p className="text-[9px] font-semibold text-gray-400 font-sans">{r.phone}</p>
                                {r.email && (
                                  <p className="text-[9px] font-medium text-slate-550 font-mono mt-0.5 max-w-[140px] truncate" title={r.email}>{r.email}</p>
                                )}
                              </div>
                            </div>
                            
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full leading-none ${
                                r.isActiveOnDuty ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {r.isActiveOnDuty ? "On Duty" : "Resting"}
                            </span>
                          </div>

                          {/* Stats counter details */}
                          <div className="my-3 grid grid-cols-3 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-xl text-[9px] font-medium font-sans text-center">
                            <div>
                              <p className="text-gray-400 leading-none">Delivered</p>
                              <p className="font-bold text-gray-800 mt-1">{r.completedDeliveries || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 leading-none">Current Run</p>
                              <p className="font-bold text-gray-800 mt-1">{activeDelivery ? "1 Active" : "None"}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 leading-none">Access PIN</p>
                              <p className="font-bold text-orange-600 mt-1 font-mono uppercase">{r.password || "rider123"}</p>
                            </div>
                          </div>

                          {/* Actions row */}
                          <div className="flex border-t border-gray-100 pt-2.5 justify-end items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRiderId(r.id);
                                setCrudRiderName(r.name);
                                setCrudRiderPhone(r.phone);
                                setCrudRiderEmail(r.email || "");
                                setCrudRiderVehicle(r.vehicleNumber);
                                setCrudRiderPassword(r.password || "rider123");
                                setCrudError("");
                                setCrudSuccess("");
                              }}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer"
                            >
                              Edit Profile
                            </button>

                            {deletingRiderId === r.id ? (
                              <div className="flex items-center gap-1.5 py-0.5 px-1.5 bg-red-50 rounded-lg border border-red-100 animate-in fade-in zoom-in-95 duration-100">
                                <span className="text-[8px] text-red-600 font-extrabold uppercase">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = riders.filter((x) => x.id !== r.id);
                                    setRiders(updated);
                                    localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
                                    deleteRiderFromFirebase(r.id).catch(err => console.error("Firebase Rider Delete failed:", err));
                                    setCrudSuccess(`Successfully deleted rider "${r.name}" from database.`);
                                    setDeletingRiderId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[8px] font-bold uppercase transition"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingRiderId(null)}
                                  className="px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[8px] font-bold uppercase transition"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingRiderId(r.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer text-red-650 font-bold"
                              >
                                Delete Account
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Creation & Edit Form card */}
              <div className="bg-white border text-left rounded-3xl p-5 shadow-xs h-fit space-y-4">
                <div className="border-b pb-2">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    {editingRiderId ? "Edit Courier Partner" : "Create Courier Slot"}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">
                    {editingRiderId ? "Modify existing system permissions" : "Self-registration is disabled for riders"}
                  </p>
                </div>

                <div className="space-y-3.5 text-xs text-gray-700">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Courier Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Rathore"
                      value={crudRiderName}
                      onChange={(e) => setCrudRiderName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border rounded-xl font-semibold outline-none focus:border-orange-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registered mobile Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98112 55291"
                      value={crudRiderPhone}
                      onChange={(e) => setCrudRiderPhone(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border rounded-xl font-semibold outline-none focus:border-orange-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Courier Email Address (For Portal login)</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rider.vikram@smartcart.com"
                      value={crudRiderEmail}
                      onChange={(e) => setCrudRiderEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border rounded-xl font-semibold outline-none focus:border-orange-500 bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehicle Registration Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UP-16-AB-3741"
                      value={crudRiderVehicle}
                      onChange={(e) => setCrudRiderVehicle(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border rounded-xl font-semibold outline-none focus:border-orange-500 bg-white font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Access PIN / Password</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter a 6-digit numeric PIN (e.g. 556677)"
                      maxLength={6}
                      value={crudRiderPassword}
                      onChange={(e) => setCrudRiderPassword(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 block w-full px-3 py-2 border rounded-xl font-semibold outline-none focus:border-orange-500 bg-white"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    {editingRiderId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRiderId(null);
                          setCrudRiderName("");
                          setCrudRiderPhone("");
                          setCrudRiderEmail("");
                          setCrudRiderVehicle("");
                          setCrudRiderPassword("");
                          setCrudError("");
                          setCrudSuccess("");
                        }}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-250 text-gray-650 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCrudError("");
                        setCrudSuccess("");

                        const trimmedName = crudRiderName.trim();
                        const trimmedPhone = crudRiderPhone.trim();
                        const trimmedEmail = crudRiderEmail.trim();
                        const trimmedVehicle = crudRiderVehicle.trim();
                        const trimmedPassword = crudRiderPassword.trim();

                        if (!trimmedName || !trimmedPhone || !trimmedEmail || !trimmedVehicle || !trimmedPassword) {
                          setCrudError("All database fields are mandatory (including Email). Please fill in details.");
                          return;
                        }

                        // Validate email format
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                          setCrudError("Invalid email format (e.g., rider@smartcart.com).");
                          return;
                        }

                        // Unique Name Constraint
                        const nameDupe = riders.some(
                          (r) => r.name.toLowerCase().replace(/\s+/g, " ") === trimmedName.toLowerCase().replace(/\s+/g, " ") && r.id !== editingRiderId
                        );
                        if (nameDupe) {
                          setCrudError(`Validation failed: The rider name "${trimmedName}" is already registered. Name must be unique.`);
                          return;
                        }

                        // Unique Email Constraint
                        const emailDupe = riders.some(
                          (r) => r.email && r.email.toLowerCase().trim() === trimmedEmail.toLowerCase().trim() && r.id !== editingRiderId
                        );
                        if (emailDupe) {
                          setCrudError(`Validation failed: The email address "${trimmedEmail}" is already registered to a courier.`);
                          return;
                        }

                        // 6-digit Numeric Check
                        if (trimmedPassword.length !== 6 || !/^\d+$/.test(trimmedPassword)) {
                          setCrudError("Access PIN must be exactly 6 numeric digits (e.g. 112233).");
                          return;
                        }

                        if (editingRiderId) {
                          // Edit existing account
                          const updated = riders.map((r) => {
                            if (r.id === editingRiderId) {
                              const updatedRider = {
                                ...r,
                                name: trimmedName,
                                phone: trimmedPhone,
                                email: trimmedEmail,
                                vehicleNumber: trimmedVehicle.toUpperCase(),
                                password: trimmedPassword
                              };
                              syncRiderToFirebase(updatedRider).catch(err => console.error("Firebase Rider Update failed:", err));
                              return updatedRider;
                            }
                            return r;
                          });

                          setRiders(updated);
                          localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
                          setCrudSuccess(`Successfully updated rider "${trimmedName}" in the database!`);

                          // Clear forms
                          setEditingRiderId(null);
                          setCrudRiderName("");
                          setCrudRiderPhone("");
                          setCrudRiderEmail("");
                          setCrudRiderVehicle("");
                          setCrudRiderPassword("");
                        } else {
                          // Check if phone duplicate
                          const phoneDupe = riders.some((r) => r.phone.replace(/\D/g, "") === trimmedPhone.replace(/\D/g, ""));
                          if (phoneDupe) {
                            setCrudError("Mobile phone number is already assigned to a registered courier partner.");
                            return;
                          }

                          // Create fresh slot
                          const newRider: Rider = {
                            id: `RIDER-${Date.now()}`,
                            isActiveOnDuty: false,
                            name: trimmedName,
                            phone: trimmedPhone,
                            email: trimmedEmail,
                            vehicleNumber: trimmedVehicle.toUpperCase(),
                            password: trimmedPassword,
                            lat: 50,
                            lng: 50,
                            battery: "100%",
                            avatar: `https://images.unsplash.com/photo-${[
                              "1534528741775-53994a69daeb",
                              "1539571696357-5a69c17a67c6",
                              "1507003211169-0a1dd7228f2d",
                              "1500648767791-00dcc994a43e",
                              "1544005313-94ddf0286df2",
                              "1438761681033-6461ffad8d80"
                            ][Math.floor(Math.random() * 6)]}?auto=format&fit=crop&q=80&w=150`,
                            completedDeliveries: 0,
                            activeDeliveries: 0,
                            avgDeliveryTime: 12
                          };

                          syncRiderToFirebase(newRider).catch(err => console.error("Firebase Rider Create failed:", err));

                          const updated = [newRider, ...riders];
                          setRiders(updated);
                          localStorage.setItem("smartcart_riders_db", JSON.stringify(updated));
                          setCrudSuccess(`Successfully created courier slot for "${newRider.name}"!`);

                          // Reset forms
                          setCrudRiderName("");
                          setCrudRiderPhone("");
                          setCrudRiderEmail("");
                          setCrudRiderVehicle("");
                          setCrudRiderPassword("");
                        }
                      }}
                      className="flex-grow-2 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
                    >
                      {editingRiderId ? "Save Profile Details" : "Publish Registered Slot"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ================= REGISTERED USERS STATUS MONITORING ================= */}
      {adminTab === "users" && (
        <div className="space-y-6 animate-in fade-in duration-200 text-left">
          
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-teal-50/40 border border-teal-100 rounded-2xl p-4.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Total Users Registered</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">{userProfiles.length} Customers</h3>
              <p className="text-[10px] text-amber-600 font-bold font-sans">Synced with Firebase `profiles` collection</p>
            </div>

            <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Total Active Buyers</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1 pb-1">
                {userProfiles.filter(p => {
                  const cleaned = p.phone.replace(/\D/g, "").slice(-10);
                  return orders.some(o => o.address?.phone?.replace(/\D/g, "").slice(-10) === cleaned);
                }).length} Monitored
              </h3>
              <p className="text-[10px] text-orange-600 font-bold font-sans">Users who have completed orders</p>
            </div>

            <div className="bg-sky-50/40 border border-sky-100 rounded-2xl p-4.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Last Active Registry</p>
              <h3 className="text-sm font-black text-gray-955 mt-2.5 pb-1 truncate">
                {userProfiles[0] ? `${userProfiles[0].name} (${userProfiles[0].phone})` : "No registry yet"}
              </h3>
              <p className="text-[10px] text-sky-600 font-bold font-sans">Latest phone login event</p>
            </div>
          </div>

          {/* Users Telemetry Listing Table */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-50 pb-4 mb-4 gap-2">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Live Customer Database Tracking</h3>
                <p className="text-xs text-gray-500 mt-1.5 font-semibold">Verify login timestamps, delivery addresses, and user ordering behavior.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLoadingUsers(true);
                  try {
                    const profiles = await fetchUserProfilesFromFirebase();
                    setUserProfiles(profiles);
                  } catch (err) {
                    console.warn(err);
                  } finally {
                    setLoadingUsers(false);
                  }
                }}
                className="self-start inline-flex items-center space-x-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg px-2.5 py-1.5 text-xs font-black transition cursor-pointer shadow-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loadingUsers ? "animate-spin" : ""}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-gray-400 font-bold text-xs flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin text-orange-500" />
                <span>Synchronizing user accounts map...</span>
              </div>
            ) : userProfiles.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs font-semibold">
                No customer profiles identified in database registry yet. Standard guest checkout records will align as logins happen.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-605 min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3 pr-2">User Profile</th>
                      <th className="py-3">Verified Mobile</th>
                      <th className="py-3">Last Login Time</th>
                      <th className="py-3">Address Registry</th>
                      <th className="py-3 text-center">Active / Total Orders</th>
                      <th className="py-3 text-right">Groceries spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {userProfiles.map((p, idx) => {
                      const getCleanPhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);
                      const cleanP = getCleanPhone(p.phone);
                      const matchingOrders = orders.filter(o => getCleanPhone(o.address?.phone || "") === cleanP);
                      const totalSpent = matchingOrders.reduce((sum, o) => sum + o.total, 0);
                      const liveOrdersCount = matchingOrders.filter(o => o.status !== "delivered").length;

                      return (
                        <tr key={p.phone || idx} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 pr-2">
                            <div className="flex items-center space-x-2.5">
                              <div className="h-7 w-7 rounded-lg bg-orange-105 text-orange-705 flex items-center justify-center font-black text-xs shrink-0 border border-orange-100">
                                {p.name ? p.name.charAt(0).toUpperCase() : "?"}
                              </div>
                              <div>
                                <p className="font-bold text-gray-950 leading-none">{p.name || "Customer"}</p>
                                <p className="text-[10px] text-gray-400 font-bold mt-1.5 truncate max-w-[150px]">{p.email || "No email linked"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-bold text-gray-750 font-mono">
                            {p.phone}
                          </td>
                          <td className="py-3 text-gray-500 font-medium whitespace-nowrap">
                            {p.last_login ? new Date(p.last_login).toLocaleString("en-IN") : "Just now"}
                          </td>
                          <td className="py-3 pr-2 max-w-[180px]">
                            {p.addresses && p.addresses.length > 0 ? (
                              <div>
                                <p className="font-bold text-gray-800 leading-none truncate">{p.addresses[0].addressLine}</p>
                                <p className="text-[9px] text-gray-400 font-extrabold mt-1.5 tracking-wide uppercase">
                                  {p.addresses[0].city} • {p.addresses[0].pincode} ({p.addresses.length} Saved)
                                </p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-medium italic">No saved addresses</span>
                            )}
                          </td>
                          <td className="py-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5 justify-center">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                liveOrdersCount > 0 ? "bg-orange-100 text-orange-700 animate-pulse" : "bg-zinc-100 text-zinc-500"
                              }`}>
                                {liveOrdersCount} Live
                              </span>
                              <span className="text-[10px] font-extrabold text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded">
                                {matchingOrders.length} Total
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-right font-black text-gray-950">
                            ₹{totalSpent}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= COMBO DEALS MANAGEMENT ================= */}
      {adminTab === "combos" && (
        <div className="space-y-6 animate-in fade-in duration-200 text-left" id="admin-combos-tab">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-150 pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-955 uppercase tracking-tight">Combo Deals Registry</h2>
              <p className="text-xs text-gray-400 font-bold uppercase">Create high-saving bundles with direct-to-cart orchestration</p>
            </div>
            
            <div className="flex bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 text-rose-800 text-xs items-center space-x-2">
              <Package className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
              <span className="font-extrabold">Total active combos synced: {combos.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Create / Edit Combo Form */}
            <div className="lg:col-span-1 bg-white border border-gray-150 rounded-3xl p-6 shadow-xs">
              <span className={`text-[10px] ${editingComboId ? 'bg-orange-100 text-orange-850' : 'bg-red-100 text-red-800'} px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider mb-2 inline-block`}>
                {editingComboId ? "Editor Suite" : "Creator Suite"}
              </span>
              <h3 className="text-sm font-black text-gray-955 mb-4">
                {editingComboId ? "Modify Existing Bundle" : "Forge New Bundle"}
              </h3>
              
              <form onSubmit={handleCreateComboSubmit} className="space-y-4">
                {comboError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-bold flex items-center space-x-2">
                    <span className="text-sm">⚠️</span>
                    <span>{comboError}</span>
                  </div>
                )}
                {comboSuccess && (
                  <div className="p-3 bg-green-50 border border-green-150 rounded-xl text-green-700 text-xs font-bold flex items-center space-x-2">
                    <span className="text-sm">✓</span>
                    <span>{comboSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Combo Title *</label>
                  <input
                    type="text"
                    required
                    value={comboTitle}
                    onChange={(e) => setComboTitle(e.target.value)}
                    placeholder="e.g. Chips + Cold Drink"
                    className="w-full text-xs font-semibold p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={comboSellingPrice}
                      onChange={(e) => setComboSellingPrice(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full text-xs font-semibold p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Badge / Tag</label>
                    <input
                      type="text"
                      value={comboBadge}
                      onChange={(e) => setComboBadge(e.target.value)}
                      placeholder="e.g. BEST OFFER"
                      className="w-full text-xs font-semibold p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Combo Description</label>
                  <textarea
                    rows={2}
                    value={comboDescription}
                    onChange={(e) => setComboDescription(e.target.value)}
                    placeholder="e.g. Fresh bread and organic dairy butter. Save ₹15!"
                    className="w-full text-xs font-semibold p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Combo Image URL</label>
                  <input
                    type="url"
                    value={comboImage}
                    onChange={(e) => setComboImage(e.target.value)}
                    placeholder="Auto-derived if empty"
                    className="w-full text-xs font-semibold p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                    Select Products (Must pick 2 or more) *
                  </label>
                  <div className="border border-gray-155 rounded-xl bg-gray-50/55 p-3 max-h-[160px] overflow-y-auto space-y-2">
                    {products.map((p) => {
                      const isChecked = selectedComboProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedComboProductIds((prev) =>
                                isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 rounded border-gray-300"
                          />
                          <div className="flex gap-2 items-center text-xs">
                            <img src={p.image} className="h-6 w-6 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                            <span className="font-extrabold text-gray-800 truncate max-w-[120px]">{p.name}</span>
                            <span className="text-gray-400 font-bold">•</span>
                            <span className="text-green-600 font-extrabold">₹{p.sellingPrice}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {selectedComboProductIds.length >= 2 && (
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 space-y-1">
                    <div className="flex justify-between text-[11px] text-amber-900 font-semibold">
                      <span>Sum of Items MRP:</span>
                      <span className="text-gray-800">₹{computedOriginalPrice}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-amber-900 font-semibold">
                      <span>Proposed Discount Price:</span>
                      <span className="text-gray-800 font-bold">₹{comboSellingPrice || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1.5 border-t border-amber-205 font-black text-rose-600">
                      <span>Total Savings:</span>
                      <span>₹{computedOriginalPrice - Number(comboSellingPrice || 0)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className={`flex-1 py-3 ${editingComboId ? 'bg-orange-550 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-650'} active:scale-95 text-white font-extrabold rounded-xl transition shadow-md text-[11px] uppercase tracking-wider cursor-pointer`}
                  >
                    {editingComboId ? "Save Changes" : "Publish Combo Package"}
                  </button>
                  {editingComboId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingComboId(null);
                        setComboTitle("");
                        setComboSellingPrice("");
                        setComboBadge("");
                        setComboImage("");
                        setComboDescription("");
                        setSelectedComboProductIds([]);
                        setComboError("");
                        setComboSuccess("");
                      }}
                      className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold rounded-xl transition px-4 text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Existing Combos List */}
            <div className="lg:col-span-2 bg-white border border-gray-150 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-gray-955 flex items-center space-x-2">
                <span>Active Bundle Registry ({combos.length})</span>
              </h3>
              
              {combos.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-3xl">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3 animate-bounce" />
                  <p className="text-sm font-black text-gray-600">No combo deals defined</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Use the creator suite to select snack pairs and promote them on the storefront instantly!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {combos.map((cb) => {
                    const savings = cb.originalPrice - cb.sellingPrice;
                    return (
                      <div key={cb.id} className="p-4 border border-gray-150 rounded-2xl flex flex-col justify-between hover:border-orange-200 transition bg-gray-50/30">
                        <div className="flex gap-3">
                          <img src={cb.image} className="h-14 w-14 rounded-xl object-cover shrink-0 border border-gray-150 bg-white" referrerPolicy="no-referrer" />
                          <div className="min-w-0 text-left">
                            <span className="text-[9px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.5 rounded uppercase">
                              {cb.badge || "SAVE ₹" + savings}
                            </span>
                            <h4 className="font-extrabold text-xs text-gray-955 truncate mt-1">{cb.title}</h4>
                            <p className="text-[9px] text-gray-450 mt-1 font-semibold leading-normal">
                              Constituents: {cb.productIds.length} items
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-150 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-xs font-black text-gray-900">₹{cb.sellingPrice}</span>
                            <span className="text-[10px] text-gray-400 line-through ml-1.5 font-bold">₹{cb.originalPrice}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingComboId(cb.id);
                                setComboTitle(cb.title);
                                setComboSellingPrice(String(cb.sellingPrice));
                                setComboBadge(cb.badge || "");
                                setComboImage(cb.image || "");
                                setComboDescription(cb.description || "");
                                setSelectedComboProductIds(cb.productIds);
                                setComboSuccess("");
                                setComboError("");
                              }}
                              className="p-1 px-2.5 hover:bg-orange-50 border border-transparent hover:border-orange-250 rounded-lg text-orange-650 text-[10px] font-extrabold transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDeleteCombo?.(cb.id)}
                              className="p-1 px-2.5 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-rose-600 text-[10px] font-extrabold transition cursor-pointer"
                            >
                              Delete Package
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Product Edit Dialog Overlay Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm bg-black/60 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-150 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-left">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-orange-50/5 text-left">
              <div>
                <span className="text-[9px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-block mb-1">
                  Inventory Editor
                </span>
                <h3 className="text-base font-black text-gray-950">✏️ Modify Product: {editingProduct.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition cursor-pointer"
                title="Cancel Edit"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>

            {/* Modal Body with Form */}
            <form onSubmit={handleEditProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {editError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-2xl flex items-center space-x-2 text-red-600 text-xs font-semibold">
                  <span>⚠️</span>
                  <span>{editError}</span>
                </div>
              )}
              
              {editSuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-150 rounded-2xl flex items-center space-x-2 text-green-700 text-xs font-black">
                  <span>✅</span>
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {/* Two columns form layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left Side fields */}
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black text-gray-450 uppercase tracking-wider block mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                      value={editPName}
                      onChange={(e) => setEditPName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Brand / Farm *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPBrand}
                        onChange={(e) => setEditPBrand(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Weight Metrics *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPWeight}
                        onChange={(e) => setEditPWeight(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Category Registry</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-black outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPCategory}
                        onChange={(e) => setEditPCategory(e.target.value)}
                      >
                        {INITIAL_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Availability Status</label>
                      <select
                        value={editPAvailable ? "true" : "false"}
                        onChange={(e) => {
                          const isAvail = e.target.value === "true";
                          setEditPAvailable(isAvail);
                          if (!isAvail) {
                            setEditPStock("0");
                          } else if (parseInt(editPStock) <= 0) {
                            setEditPStock("10"); // default to 10 on re-activation
                          }
                        }}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-black outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="true">🟢 Mark Available (In Stock)</option>
                        <option value="false">🔴 Mark Out of Stock</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Offer Price *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPSellingPrice}
                        onChange={(e) => setEditPSellingPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">MRP/List Price *</label>
                      <input
                        type="text"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPMarketPrice}
                        onChange={(e) => setEditPMarketPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Stock Quantity *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        value={editPStock}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditPStock(val);
                          const num = parseInt(val) || 0;
                          if (num > 0 && !editPAvailable) {
                            setEditPAvailable(true);
                          } else if (num === 0 && editPAvailable) {
                            setEditPAvailable(false);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Stock modification shortcuts */}
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex flex-wrap gap-2 items-center justify-between">
                    <span className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Stock Shortcuts:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(0, (parseInt(editPStock) || 0) + 10);
                          setEditPStock(String(nextVal));
                          if (nextVal > 0) setEditPAvailable(true);
                        }}
                        className="px-2 py-1 bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-250 rounded-lg text-[9px] font-bold text-gray-800 transition cursor-pointer"
                      >
                        ➕ Increase (+10)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(0, (parseInt(editPStock) || 0) - 10);
                          setEditPStock(String(nextVal));
                          if (nextVal === 0) setEditPAvailable(false);
                        }}
                        className="px-2 py-1 bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-250 rounded-lg text-[9px] font-bold text-gray-800 transition cursor-pointer"
                      >
                        ➖ Decrease (-10)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPStock("0");
                          setEditPAvailable(false);
                        }}
                        className="px-2 py-0.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-[9px] font-bold transition cursor-pointer"
                      >
                        Out of Stock 🚫
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side fields */}
                <div className="space-y-3.5 flex flex-col justify-between">
                  <div>
                    <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block mb-1">Brief Description</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-orange-500 resize-none"
                      placeholder="Ingredients, nutrition details or other descriptive tags"
                      value={editPDesc}
                      onChange={(e) => setEditPDesc(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-455 uppercase tracking-wider block">Product Image Setup</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold placeholder-gray-400 outline-none focus:bg-white focus:ring-1 focus:ring-orange-500"
                        placeholder="Paste uncompressed image URL"
                        value={editPImage}
                        onChange={(e) => setEditPImage(e.target.value)}
                      />
                      <label className="bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center justify-center shrink-0">
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === "string") {
                                  setEditPImage(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Image Preview Block */}
                  <div className="border border-dashed border-gray-200 rounded-2xl p-3 bg-gray-50/50 flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2 block font-sans">Visual Asset Preview</span>
                    {editPImage ? (
                      <div className="relative group">
                        <img 
                          src={editPImage} 
                          alt="Product preview" 
                          className="h-24 w-24 object-cover rounded-xl border border-gray-150 bg-white shadow-xs" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200";
                          }}
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setEditPImage("")}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 text-[8px] font-bold h-4 w-4 flex items-center justify-center shadow-xs"
                          title="Remove Image"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="h-24 w-24 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-450 bg-white">
                        <span className="text-[10px] font-extrabold uppercase font-sans">No Photo</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-2 transition">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-orange-100 cursor-pointer"
                >
                  Save Product Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
