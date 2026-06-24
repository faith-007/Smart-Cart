export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  weight: string;
  marketPrice: number; // MRP
  sellingPrice: number; // Discounted Price
  discount: number; // calculated as %
  stock: number;
  image: string;
  description: string;
  ingredients?: string;
  nutrition?: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  isFeatured: boolean;
  isBestOffer: boolean;
  rating: number;
  ratingCount: number;
  
  // Dynamic analytics fields
  totalOrders?: number;
  totalSales?: number;
  totalViews?: number;
  totalSearchClicks?: number;
  totalAddToCart?: number;
  
  // Strict Firestore-only product system fields
  price?: number;
  mrp?: number;
  available?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  id: string;
  label: "Home" | "Work" | "Other";
  name: string;
  addressLine: string;
  city: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
  fullName?: string;
  phoneNumber?: string;
  houseFlatNumber?: string;
  street?: string;
  landmark?: string;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
  serviceable?: boolean;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  vehicleNumber: string;
  isActiveOnDuty: boolean;
  lat: number;
  lng: number;
  battery: string;
  avatar: string;
  completedDeliveries: number;
  activeDeliveries: number;
  avgDeliveryTime: number; // In minutes
  lastUpdated?: string;
  riderName?: string;
}

export interface DeliveryPartner {
  id?: string; // Links back to a Rider's ID if assigned from our DB
  name: string;
  rating: number;
  phone: string;
  avatar: string;
  vehicleNumber?: string;
  assigned_at?: string;
  accepted_at?: string;
  delivery_status?: string;
  rider_id?: string;
  rider_name?: string;
}

export interface Order {
  id: string;
  userId?: string;
  userEmail?: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  platformFee?: number;
  handlingCharge?: number;
  total: number;
  status: "placed" | "accepted" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  address: Address;
  paymentMethod: string;
  eta: number; // remaining minutes
  deliveryPartner?: DeliveryPartner;
  deliveryInstructions?: string;
  rejectedByRiders?: string[]; // list of rider IDs who rejected this order
  proofs?: {
    packedPhoto?: string;
    deliveredPhoto?: string;
    uploadedAt?: string;
  };
  rider_id?: string;
  rider_name?: string;
  assigned_at?: string;
  accepted_at?: string;
  delivery_status?: string;
  riderId?: string;
  riderName?: string;
  acceptedAt?: string;
  placed_at?: string;
  packed_at?: string;
  out_for_delivery_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancelledAt?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
}

export interface ComboDeal {
  id: string;
  title: string; // compatibility mapping
  name?: string; // firebase name
  productIds: string[];
  products?: Product[]; // included products objects
  originalPrice: number;
  sellingPrice: number; // compatibility mapping
  comboPrice?: number; // firebase comboPrice
  savings?: number; // firebase savings amount
  image: string;
  badge: string;
  description?: string;
  createdAt?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  orderId?: string;
}
