import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "English (IN)" | "Hindi (हिन्दी)";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const HINDI_TRANSLATIONS: Record<string, string> = {
  // Navigation / Tabs
  "Home": "होम",
  "Wishlist": "इच्छा-सूची",
  "Profile": "प्रोफ़ाइल",
  "Admin": "एडमिन",
  "Rider": "राइडर",
  "Guest": "अतिथि",

  // Header Elements
  "15 Min Delivery": "१५ मिनट में डिलीवरी",
  "Delivering to": "वितरण का स्थान",
  "Select Address": "पता चुनें",
  "Select Delivery Address": "डिलिवरी पता चुनें",
  "Manage Addresses in Profile": "प्रोफ़ाइल में पते प्रबंधित करें",
  "Search milk, bananas, fresh organic bread...": "दूध, केला, ताजी जैविक ब्रेड खोजें...",
  "Search milk, bananas, fresh organic bread": "दूध, केला, ताजी जैविक ब्रेड",
  "Search standard essentials, fresh grocery...": "सामान्य आवश्यकताएं, ताजा ग्रोसरी खोजें...",
  "Search standard essentials, fresh grocery": "सामान्य आवश्यकताएं, ताजा ग्रोसरी",
  "Matching Products": "मिलते-जुलते उत्पाद",
  "Recent Searches": "हालिया खोजें",
  "Clear All": "सभी साफ करें",
  "Trending Categories": "प्रचलित श्रेणियां",
  "Popular Items": "लोकप्रिय वस्तुएं",
  "Items in Basket": "बास्केट में सामान",
  "Ready to Deliver": "डिलिवरी के लिए तैयार",

  // Account / UserProfile
  "Languages": "भाषाएं",
  "Change Password": "पासवर्ड बदलें",
  "Update Password": "पासवर्ड अपडेट करें",
  "Personal Details": "व्यक्तिगत जानकारी",
  "Personal Information": "व्यक्तिगत जानकारी",
  "Preferences & Settings": "प्राथमिकताएं और सेटिंग्स",
  "My Orders": "मेरे ऑर्डर्स",
  "Edit Profile": "प्रोफ़ाइल संपादित करें",
  "Edit Profile Details": "प्रोफ़ाइल संपादित करें",
  "Save Profile": "प्रोफ़ाइल सहेजें",
  "Save Changes": "सहेजें",
  "Full Name": "पूरा नाम",
  "Full Identity Name": "पूरा नाम",
  "Email Address": "ईमेल पता",
  "E-Mail Address": "ईमेल पता",
  "Phone Number": "फ़ोन नंबर",
  "Contact Number": "फ़ोन नंबर",
  "Address Book Coordinates": "सहेजे गए पते",
  "Saved Addresses": "सहेजे गए पते",
  "Add New Address": "नया पता जोड़ें",
  "Default Address": "डिफ़ॉल्ट पता",
  "Set Default": "डिफ़ॉल्ट सेट करें",
  "Delete": "हटाएं",
  "Manage Locations": "स्थान प्रबंधन",
  "Disconnect Phone": "फ़ोन डिस्कनेक्ट करें",
  "Log Out": "लॉग आउट",
  "Logout": "लॉग आउट",
  "Password": "पासवर्ड",
  "Security": "सुरक्षा",
  "Notifications": "सूचनाएं",
  "Update Password Form": "पासवर्ड अपडेट करें",
  "New Password": "नया पासवर्ड",
  "Verify Password": "पासवर्ड सत्यापित करें",
  "Current Password": "वर्तमान पासवर्ड",
  "Submit": "जमा करें",
  "Save": "सहेजें",
  "Cancel": "रद्द करें",
  "House, Flat, Building Name": "मकान, फ्लैट, बिल्डिंग का नाम",
  "Street, Sector, Locality": "सड़क, सेक्टर, इलाका",
  "City": "शहर",
  "State": "राज्य",
  "Pincode": "पिनकोड",
  "Enter 6-digit PIN": "६ अंकों का पिन कोड दर्ज करें",
  "Active Orders": "सक्रिय ऑर्डर",
  "Order History": "ऑर्डर का इतिहास",
  "Cart Summary": "कार्ट सारांश",
  "Total Orders": "कुल ऑर्डर",
  "Total Spent": "कुल खर्च",
  "Select localized website strings": "वेबसाइट की स्थानीयकृत भाषा चुनें",
  "Update Security Codes": "सुरक्षा कोड अपडेट करें",

  // Cart / Checkout
  "Your Cart": "आपका कार्ट",
  "Subtotal": "उप-योग",
  "Delivery Charge": "डिलिवरी शुल्क",
  "Grand Total": "कुल योग",
  "Proceed to Checkout": "चेकआउट करें",
  "Promo Code": "प्रोमो कोड",
  "Apply": "लागू करें",
  "Checkout": "चेकआउट",
  "Order Summary": "ऑर्डर का सारांश",
  "Place Order": "ऑर्डर प्लेस करें",
  "Confirm Order": "ऑर्डर की पुष्टि करें",

  // Buttons & Labels
  "Add to Basket": "कार्ट में जोड़ें",
  "Added": "जोड़ा गया",
  "Item added to cart!": "सामान कार्ट में जोड़ा गया!",
  "Out of Stock": "स्टॉक में नहीं है",
  "Track Order": "ऑर्डर ट्रैक करें",
  "Select a category": "एक श्रेणी चुनें",
  "Trending Items": "ट्रेंडिंग उत्पाद",
  "Shop by Category": "श्रेणी के अनुसार खरीदें",
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("smartcart_language") as Language) || "English (IN)";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("smartcart_language", lang);
  };

  const t = (text: string): string => {
    if (language === "Hindi (हिन्दी)") {
      const trimmed = text.trim();
      
      // Exact Match
      if (HINDI_TRANSLATIONS[trimmed]) {
        return HINDI_TRANSLATIONS[trimmed];
      }
      
      // Case-insensitive Match
      const lowerKey = Object.keys(HINDI_TRANSLATIONS).find(
        key => key.toLowerCase() === trimmed.toLowerCase()
      );
      if (lowerKey) {
        return HINDI_TRANSLATIONS[lowerKey];
      }
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
