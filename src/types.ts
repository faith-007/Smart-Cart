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
  total: number;
  status: "placed" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  address: Address;
  paymentMethod: string;
  eta: number; // remaining minutes
  deliveryPartner?: DeliveryPartner;
  deliveryInstructions?: string;
  rejectedByRiders?: string[]; // list of rider IDs who rejected this order
  rider_id?: string;
  rider_name?: string;
  assigned_at?: string;
  accepted_at?: string;
  delivery_status?: string;
}

export interface PromoCode {
  code: string;
  description: string;
  discountValue: number; // flat discount or percentage (we'll implement flat rupee savings)
  minimumOrder: number;
}

export interface ComboDeal {
  id: string;
  title: string;
  productIds: string[];
  originalPrice: number;
  sellingPrice: number;
  image: string;
  badge: string;
}
