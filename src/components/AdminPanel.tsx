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
import { Product, Order, Rider } from "../types";
import { INITIAL_CATEGORIES } from "../data";
import { fetchUserProfilesFromFirebase, UserProfileData, syncRiderToFirebase, deleteRiderFromFirebase } from "../lib/firebase";
import RiderAvatar from "./RiderAvatar";

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
}

export default function AdminPanel({
  products,
  onAddProduct,
  onDeleteProduct,
  onUpdateStock,
  orders,
  onUpdateOrderStatus,
  onAssignPartner,
  riders,
  setRiders,
  isCustomerLoggedIn = false,
  userEmail = "",
  onCustomerLogout,
}: AdminPanelProps) {
  // --- Admin Navigation & Auth States ---
  const [adminTab, setAdminTab] = useState<"kpis" | "products" | "orders" | "riders" | "users">("kpis");
  const isLoggedIn = isCustomerLoggedIn && userEmail === "himanshu712007@gmail.com";

  // --- Real-Time Logged-In User Monitoring state ---
  const [userProfiles, setUserProfiles] = useState<UserProfileData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Sub-navigation tab selector for riders
  const [riderSubTab, setRiderSubTab] = useState<"map" | "manage">("map");

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

  const [selectedRiderId, setSelectedRiderId] = useState<string>("rider-1");

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
                            <button
                              onClick={() => onDeleteProduct(p.id)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                              title="Delete Item"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
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
              {orders.map((order) => {
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
            
            <div className="flex space-x-2 bg-gray-50/80 p-1 rounded-xl border border-gray-150 shrink-0">
              <button
                type="button"
                onClick={() => setRiderSubTab("map")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  riderSubTab === "map" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Live GPS Beacon Map
              </button>
              <button
                type="button"
                onClick={() => setRiderSubTab("manage")}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  riderSubTab === "manage" 
                    ? "bg-orange-500 text-white shadow-xs" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Rider Accounts DB ({riders.length})
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

          {/* ====== SUBTAB A: LIVE GPS MAP VIEW ====== */}
          {riderSubTab === "map" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Col 1&2: Interactive Vector GPS Map Frame */}
              <div className="lg:col-span-2 space-y-3.5">
                {/* Map Canvas viewport (Fully SVG Simulated Map Layout) */}
                <div className="relative h-96 w-full rounded-3xl bg-gray-900 border border-gray-850 overflow-hidden shadow-inner flex items-center justify-center">
                  
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#2d3748_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-40" />

                  {/* Simulated Map Streets */}
                  <svg className="absolute inset-0 h-full w-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                    {/* Horizontal Streets */}
                    <line x1="0" y1="50" x2="100%" y2="50" stroke="#4a5568" strokeWidth="2" strokeDasharray="3 3" />
                    <line x1="0" y1="120" x2="100%" y2="120" stroke="#4a5568" strokeWidth="3" />
                    <line x1="0" y1="200" x2="100%" y2="200" stroke="#4a5568" strokeWidth="2" />
                    <line x1="0" y1="280" x2="100%" y2="280" stroke="#4a5568" strokeWidth="4" />
                    <line x1="0" y1="340" x2="100%" y2="340" stroke="#4a5568" strokeWidth="2" />
                    
                    {/* Vertical Streets */}
                    <line x1="80" y1="0" x2="80" y2="100%" stroke="#4a5568" strokeWidth="2" />
                    <line x1="220" y1="0" x2="220" y2="100%" stroke="#4a5568" strokeWidth="3" />
                    <line x1="420" y1="0" x2="420" y2="100%" stroke="#4a5568" strokeWidth="2" strokeDasharray="5 5" />
                    <line x1="580" y1="0" x2="580" y2="100%" stroke="#4a5568" strokeWidth="4" />
                    <line x1="720" y1="0" x2="720" y2="100%" stroke="#4a5568" strokeWidth="2" />

                    {/* Cyber Park circular ring */}
                    <circle cx="220" cy="200" r="80" stroke="#4a5568" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                    <circle cx="580" cy="120" r="60" stroke="#4a5568" strokeWidth="2" fill="none" />
                  </svg>

                  {/* central Fulfillment Hub Indicator */}
                  <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                    <div className="h-10 w-10 bg-orange-500 border-4 border-black rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg shadow-orange-500/50 animate-pulse">
                      HUB
                    </div>
                    <span className="text-[10px] bg-black text-orange-500 font-extrabold uppercase px-1.5 py-0.5 rounded border border-orange-500 mt-1 shadow-xs tracking-wider leading-none">
                      SmartCart ND01
                    </span>
                  </div>

                  {/* Rider coordinates coordinates markers */}
                  {riders.map((item) => {
                    const isSelected = item.id === selectedRiderId;
                    return (
                      <div
                        key={item.id}
                        className={`absolute z-10 transition-all duration-1000 ease-in-out cursor-pointer ${
                          !item.isActiveOnDuty ? "opacity-40" : "opacity-100"
                        }`}
                        style={{ top: `${item.lat}%`, left: `${item.lng}%` }}
                        onClick={() => setSelectedRiderId(item.id)}
                      >
                        <div className="relative flex flex-col items-center">
                          
                          {/* Connection Signal wave circles (if selected) */}
                          {isSelected && (
                            <div className="absolute -inset-4 h-11 w-11 bg-orange-500/20 rounded-full animate-ping z-0" />
                          )}

                          {/* Map Pin or bike icon */}
                          <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-transform scale-100 hover:scale-110 z-10 ${
                            isSelected 
                              ? "bg-orange-500 text-white border-white shadow-lg" 
                              : "bg-gray-800 text-orange-400 border-orange-500 shadow-md"
                          }`}>
                            <Bike className="h-4.5 w-4.5" />
                          </div>

                          {/* Display name label */}
                          <div className={`mt-1 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10 ${
                            isSelected ? "bg-orange-500 text-white" : "bg-black text-gray-300 border border-gray-800"
                          }`}>
                            {item.name.split(" ")[0]} 
                            {!item.isActiveOnDuty && " (rest)"}
                          </div>

                        </div>
                      </div>
                    );
                  })}

                  {/* Map Floating Zoom Compass */}
                  <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-xs border border-gray-800 p-2 text-[9px] font-bold text-gray-450 rounded-xl space-y-1.5 cursor-default select-none">
                    <span className="flex items-center gap-1 text-green-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> SIMULATED METROS GRID
                    </span>
                    <p>Lat: 28.4595° N</p>
                    <p>Lng: 77.0266° E</p>
                    <p>Telemetry: Real-Time Ingress</p>
                  </div>

                </div>
              </div>

              {/* Col 3: Right Rider Diagnostics Drawer */}
              <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between text-left h-fit">
                <div>
                  <div className="border-b border-gray-50 pb-3 mb-4">
                    <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest">Rider Diagnostics Hub</h3>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Select a rider agent on the map to inspect stream</p>
                  </div>

                  {/* Riders lists selectors */}
                  <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                    {riders.map((r) => {
                      const isSelected = r.id === selectedRiderId;
                      // Find real active assigned order if any
                      const activeDelivery = orders.find(
                        (o) => o.deliveryPartner?.name === r.name && o.status !== "delivered"
                      );

                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRiderId(r.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition ${
                            isSelected 
                              ? "border-orange-500 bg-orange-50/20 text-gray-900 font-bold" 
                              : "border-gray-50 hover:bg-gray-50 text-gray-600 font-semibold"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <RiderAvatar name={r.name} className="h-7 w-7 text-[10px]" />
                            <div>
                              <p className="text-xs text-gray-800 font-black">{r.name}</p>
                              <p className="text-[9px] text-gray-400 uppercase font-sans">
                                {r.isActiveOnDuty ? "ON-DUTY" : "OFF-DUTY"} • {activeDelivery ? `Delivering #${activeDelivery.id}` : "Idle"}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            r.isActiveOnDuty ? "bg-green-100 text-green-700 animate-pulse" : "bg-gray-150 text-gray-500"
                          }`}>
                            {r.isActiveOnDuty ? "On duty" : "Off duty"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Diagnostics Detail Box */}
                  {activeRider ? (
                    (() => {
                      const activeDelivery = orders.find(
                        (o) => o.deliveryPartner?.name === activeRider.name && o.status !== "delivered"
                      );

                      return (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2.5 text-xs text-gray-700">
                          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                            <RiderAvatar name={activeRider.name} className="h-9 w-9 text-xs" />
                            <div>
                              <h4 className="font-bold text-gray-900">{activeRider.name}</h4>
                              <p className="text-[10px] text-gray-450 font-semibold uppercase">{activeRider.phone}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-[11px] font-sans">
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Duty State:</span>
                              <strong className={`uppercase ${activeRider.isActiveOnDuty ? "text-green-600" : "text-gray-400"}`}>
                                {activeRider.isActiveOnDuty ? "Active Duty" : "Rest Mode"}
                              </strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Current Coordinate:</span>
                              <strong className="text-gray-950">{activeRider.lat.toFixed(2)}% N, {activeRider.lng.toFixed(2)}% E</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Active Destination:</span>
                              <strong className="text-gray-900 truncate max-w-[130px]" title={activeDelivery?.address.addressLine}>
                                {activeDelivery ? activeDelivery.address.addressLine : "No Active Route"}
                              </strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Battery Level:</span>
                              <strong className="text-green-600">{activeRider.battery || "100%"}</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Assign Shipment:</span>
                              <strong className="text-orange-500 font-bold uppercase">{activeDelivery ? `#${activeDelivery.id}` : "Unassigned"}</strong>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-gray-450">Vehicle PIN-code:</span>
                              <strong className="text-gray-900 font-mono text-[10px] font-bold uppercase">{activeRider.vehicleNumber}</strong>
                            </div>
                          </div>

                          <div className="pt-2">
                            <a
                              href={`tel:${activeRider.phone}`}
                              onClick={(e) => {
                                e.preventDefault();
                                alert(`Rider line active. Simulating call dispatch to phone ${activeRider.phone}`);
                              }}
                              className="w-full inline-flex items-center justify-center space-x-1 border border-gray-200 rounded-xl bg-white hover:bg-gray-100 py-1.5 text-[10px] font-black uppercase text-gray-750 transition"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ping Diagnostics Call</span>
                            </a>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center text-xs p-8 text-gray-400 font-medium">
                      No registered rider accounts found to run diagnostics on. Include a partner in the database.
                    </div>
                  )}
                </div>

                <div className="bg-gray-100/50 p-2.5 rounded-xl text-[10px] text-gray-400 font-bold uppercase mt-4 text-center">
                  ● Active broad GPS Tracking Grid
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

    </div>
  );
}
