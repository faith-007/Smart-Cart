import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../lib/LanguageContext";
import { Search, ShoppingBag, User, MapPin, Heart, ShieldAlert, Sparkles, X, Clock, ChevronDown, Bike } from "lucide-react";
import { Product, Address, Rider } from "../types";

const brandLogo = new URL("../../images/logo.png", import.meta.url).href;

interface HeaderProps {
  cartCount: number;
  cartTotal: number;
  onCartToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  savedAddresses: Address[];
  currentAddress: Address | null;
  setCurrentAddress: (address: Address | null) => void;
  onSearch: (query: string) => void;
  allProducts: Product[];
  onProductClick: (product: Product) => void;
  isCustomerLoggedIn?: boolean;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  riders: Rider[];
  riderSession: Rider | null;
  setRiderSession: React.Dispatch<React.SetStateAction<Rider | null>>;
  userRole?: "Admin" | "Rider" | "Customer" | "Guest";
}

export default function Header({
  cartCount,
  cartTotal,
  onCartToggle,
  activeTab,
  setActiveTab,
  savedAddresses,
  currentAddress,
  setCurrentAddress,
  onSearch,
  allProducts,
  onProductClick,
  isCustomerLoggedIn = false,
  userName = "",
  userEmail = "",
  userPhone = "",
  riders = [],
  riderSession,
  setRiderSession,
  userRole = "Guest",
}: HeaderProps) {
  const { t } = useLanguage();
  const [searchVal, setSearchVal] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggests, setShowSuggests] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smartcart_recent_searches");
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {
      // Ignored
    }
  }, []);

  // Sync outside search query
  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    onSearch(val);

    if (val.trim() === "") {
      setSuggestions([]);
      return;
    }

    const filtered = allProducts.filter((p) =>
      p.name.toLowerCase().includes(val.toLowerCase()) ||
      p.brand.toLowerCase().includes(val.toLowerCase()) ||
      p.category.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 5);

    setSuggestions(filtered);
  };

  const handleSearchSubmit = (val: string) => {
    setSearchVal(val);
    onSearch(val);
    setShowSuggests(false);

    if (val.trim() !== "" && !recentSearches.includes(val)) {
      const updated = [val, ...recentSearches.slice(0, 4)];
      setRecentSearches(updated);
      try {
        localStorage.setItem("smartcart_recent_searches", JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("smartcart_recent_searches");
    } catch (e) {}
  };

  // Close suggestions and address dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(event.target as Node)) {
        setShowSuggests(false);
      }
      if (addressRef.current && !addressRef.current.contains(event.target as Node)) {
        setShowAddressDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex flex-wrap md:flex-nowrap md:h-16 items-center justify-between px-3 sm:px-6 lg:px-8 py-2 md:py-0 gap-y-2 md:gap-x-4 max-w-7xl">
        
        {/* Branding Logo */}
        <div 
          onClick={() => {
            setActiveTab("home");
            setSearchVal("");
            onSearch("");
          }}
          className="flex cursor-pointer items-center space-x-2"
          id="header-brand-logo"
        >
          <img 
            src={brandLogo} 
            alt="SmartCart Logo" 
            className="h-10 w-10 object-contain rounded-xl shadow-md shadow-green-100 transition-transform active:scale-95" 
            referrerPolicy="no-referrer"
          />
          <div>
            <span className="font-extrabold text-l sm:text-2xl tracking-tight text-gray-900">
              Smart<span className="text-orange-500">Cart</span>
            </span>
            <div className="hidden sm:flex items-center text-[10px] font-bold text-green-600 uppercase tracking-wider">
              <Sparkles className="mr-0.5 h-3 w-3 animate-pulse" />
              {t("15 Min Delivery")}
            </div>
          </div>
        </div>

        {/* Location Picker */}
        <div ref={addressRef} className="relative hidden md:block" id="header-location-picker">
          <button
            onClick={() => setShowAddressDropdown(!showAddressDropdown)}
            className="flex items-center space-x-1.5 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-1.5 text-left transition hover:bg-gray-50 hover:border-gray-200"
          >
            <MapPin className="h-4.5 w-4.5 text-orange-500 shrink-0" />
            <div className="max-w-[140px] truncate">
              <div className="text-[10px] leading-tight font-semibold text-gray-400 uppercase">
                {t("Delivering to")} {currentAddress?.label || t("Home")}
              </div>
              <div className="text-xs font-bold text-gray-800 truncate">
                {currentAddress ? `${currentAddress.name}, ${currentAddress.addressLine}` : t("Select Address")}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          </button>

          {/* Address Dropdown */}
          {showAddressDropdown && (
            <div className="absolute top-12 left-0 w-72 rounded-xl border border-gray-100 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{t("Select Delivery Address")}</h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => {
                      setCurrentAddress(addr);
                      setShowAddressDropdown(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition border ${
                      currentAddress && currentAddress.id === addr.id
                        ? "border-green-500 bg-green-50/20 text-gray-900 font-medium"
                        : "border-gray-50 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800 capitalize">{addr.label}</span>
                      {currentAddress && currentAddress.id === addr.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      )}
                    </div>
                    <div className="text-gray-500 font-medium mt-0.5 truncate">{addr.addressLine}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{addr.phone}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowAddressDropdown(false);
                  }}
                  className="w-full text-center py-1.5 rounded-lg text-xs font-bold text-green-600 hover:bg-green-50/50 transition"
                >
                  {t("Manage Addresses in Profile")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Smart Search Bar */}
        <div ref={suggestRef} className="relative w-full md:w-auto md:flex-1 max-w-lg order-last md:order-none mx-0 md:mx-6" id="header-search-bar">
          <div className="flex items-center rounded-xl bg-gray-100 px-3.5 py-2.5 shadow-inner transition focus-within:ring-2 focus-within:ring-green-500 focus-within:bg-white border border-transparent focus-within:border-gray-200">
            <Search className="h-4.5 w-4.5 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder={t("Search milk, bananas, fresh organic bread...")}
              value={searchVal}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggests(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit(searchVal);
              }}
              className="w-full p-0 text-sm font-medium text-gray-800 bg-transparent placeholder-gray-400 border-0 outline-hidden focus:ring-0"
            />
            {searchVal && (
              <button 
                onClick={() => {
                  setSearchVal("");
                  onSearch("");
                  setSuggestions([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Autocomplete & Recent Suggestions */}
          {showSuggests && (
            <div className="absolute top-12 left-0 right-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              
              {/* Autocomplete Products */}
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Matching Products</h4>
                  <div className="space-y-1">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onProductClick(p);
                          setShowSuggests(false);
                          setSearchVal("");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center space-x-2.5">
                          <img src={p.image} alt={p.name} className="h-8 w-8 rounded-lg object-cover bg-gray-50" />
                          <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">{p.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{p.brand} • {p.weight}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-green-600">₹{p.sellingPrice}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Searches</h4>
                    <button onClick={clearRecentSearches} className="text-[10px] font-bold text-orange-500 hover:underline">
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearchSubmit(term)}
                        className="flex items-center space-x-1 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-xs text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 transition"
                      >
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                suggestions.length === 0 && (
                  <div className="py-2 text-center text-xs text-gray-400 font-medium">
                    Type to search for the freshest groceries...
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Actions Menu */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          
          {/* Admin Portal Button */}
          {(isCustomerLoggedIn && userEmail === "himanshu712007@gmail.com") && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`p-2 rounded-xl transition flex items-center space-x-1 sm:space-x-1.5 border shrink-0 ${
                activeTab === "admin"
                  ? "bg-orange-50 text-orange-600 border-orange-200"
                  : "text-orange-600 hover:bg-orange-50/50 hover:text-orange-700 border-orange-100"
              }`}
              title="Admin Portal"
              id="header-admin-portal-button"
            >
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wider">
                Admin Portal
              </span>
            </button>
          )}

          {/* Rider Portal Dropdown - Guarded by secure role checks, completely hidden from non-Riders (Customers and Admins) */}
          {userRole === "Rider" && (
            <button
              onClick={() => {
                setActiveTab("rider");
              }}
              className={`p-2 rounded-xl transition flex items-center space-x-1 sm:space-x-1.5 border shrink-0 ${
                activeTab === "rider"
                  ? "bg-orange-50 text-orange-600 border-orange-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-gray-150"
              }`}
              title="Rider Partner Terminal"
              id="header-rider-portal-button"
            >
              <Bike className="h-4 w-4 text-orange-500" />
              <span className="hidden md:inline text-[11px] font-extrabold uppercase tracking-wider">
                Rider Portal
              </span>
            </button>
          )}
          
          {/* Wishlist Trigger */}
          <button
            onClick={() => setActiveTab("wishlist")}
            className={`relative p-2 rounded-xl transition ${
              activeTab === "wishlist"
                ? "bg-red-50 text-red-500"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
            title="Wishlist"
            id="header-wishlist-button"
          >
            <Heart className="h-5 w-5" />
          </button>

          {/* User Profile */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`p-2 rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === "profile"
                ? "bg-green-50 text-green-600"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
            title={isCustomerLoggedIn ? "Authorized Account Dashboard" : "Authenticate / Sign-up by OTP"}
            id="header-profile-button"
          >
            <User className="h-5 w-5" />
            <span className="hidden md:inline text-xs font-bold text-gray-700">
              {isCustomerLoggedIn && userName ? userName : "Login / Signup"}
            </span>
          </button>

          {/* Cart Trigger Button */}
          <button
            onClick={onCartToggle}
            className="flex items-center space-x-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-3.5 py-2 text-white font-bold text-sm shadow-md shadow-orange-100 transition active:scale-95"
            id="header-cart-button"
          >
            <div className="relative">
              <ShoppingBag className="h-4.5 w-4.5" />
              {cartCount > 0 && (
                <div className="absolute -top-2.5 -right-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-gray-900 ring-2 ring-orange-500">
                  {cartCount}
                </div>
              )}
            </div>
            <span className="hidden sm:inline">₹{cartTotal}</span>
          </button>

        </div>

      </div>
    </header>
  );
}
