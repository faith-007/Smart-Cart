import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy,
  deleteDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { Order, Rider, Address } from "../types.ts";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase with custom or platform configuration
export const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== "(default)"
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup };

// Error formats according to System Skill instructions
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error("Firestore Permission/Access Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// User Profile interface
export interface UserProfileData {
  userId: string;
  phone: string;
  name: string;
  email: string;
  last_login?: string;
  created_at?: string;
  addresses: any[];
  role?: "Admin" | "Rider" | "Customer";
  riderId?: string;
}

/**
 * Sync user profile to Firestore
 */
export async function syncUserProfileToFirebase(profile: UserProfileData): Promise<{ success: boolean; error?: string }> {
  const pathForWrite = `profiles/${profile.userId}`;
  try {
    const payload = {
      userId: profile.userId,
      phone: profile.phone || "",
      name: profile.name || "Customer",
      email: profile.email || "",
      last_login: new Date().toISOString(),
      created_at: profile.created_at || new Date().toISOString(),
      addresses: profile.addresses || [],
      role: profile.role || "Customer",
      riderId: profile.riderId || null,
    };

    console.log(`[SmartCart Firebase] Syncing user profile: ${profile.userId}`, payload);
    const profileRef = doc(db, "profiles", profile.userId);
    await setDoc(profileRef, removeUndefined(payload));
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Fetch a user profile by UID
 */
export async function fetchUserProfileFromFirebase(userId: string): Promise<UserProfileData | null> {
  const pathForGet = `profiles/${userId}`;
  let attempts = 3;
  while (attempts > 0) {
    try {
      const profileRef = doc(db, "profiles", userId);
      const snapshot = await getDoc(profileRef);
      if (!snapshot.exists()) return null;
      return snapshot.data() as UserProfileData;
    } catch (error: any) {
      attempts--;
      const isPermissionDenied = error?.code === "permission-denied" || String(error).includes("permission-denied");
      if (isPermissionDenied && attempts > 0) {
        console.warn(`[SmartCart Firebase] Get profile permission check failed. Retrying (Attempts left: ${attempts})...`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      } else {
        handleFirestoreError(error, OperationType.GET, pathForGet);
      }
    }
  }
  return null;
}

/**
 * Fetch all user profiles (Admin restricted, bypasses if not authorized to avoid console level rules exceptions)
 */
export async function fetchUserProfilesFromFirebase(): Promise<UserProfileData[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return [];
  }

  const isAdminUser = currentUser.email === "himanshu712007@gmail.com";
  if (!isAdminUser) {
    console.log("[SmartCart Firebase] Bypassing complete profiles fetch for non-admin session.");
    return [];
  }

  const pathForList = "profiles";
  try {
    const q = query(collection(db, "profiles"));
    const querySnapshot = await getDocs(q);
    const profiles: UserProfileData[] = [];
    querySnapshot.forEach((docClassification) => {
      profiles.push(docClassification.data() as UserProfileData);
    });
    return profiles;
  } catch (error) {
    console.warn("[SmartCart Firebase] Profile fetch error quietly handled:", error);
    return [];
  }
}

/**
 * Sync Rider to Firestore
 */
export async function syncRiderToFirebase(rider: Rider): Promise<{ success: boolean; error?: string }> {
  const pathForWrite = `riders/${rider.id}`;
  try {
    const payload = {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      email: rider.email || "",
      password: rider.password || "123456",
      vehicleNumber: rider.vehicleNumber,
      isActiveOnDuty: rider.isActiveOnDuty,
      lat: Number(rider.lat),
      lng: Number(rider.lng),
      battery: rider.battery || "100%",
      avatar: rider.avatar || "",
      completedDeliveries: Number(rider.completedDeliveries) || 0,
      activeDeliveries: Number(rider.activeDeliveries) || 0,
      avgDeliveryTime: Number(rider.avgDeliveryTime) || 12,
      role: "Rider"
    };

    console.log(`[SmartCart Firebase] Syncing rider: ${rider.id}`, payload);
    const riderRef = doc(db, "riders", rider.id);
    await setDoc(riderRef, removeUndefined(payload));
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Delete Rider from Firestore
 */
export async function deleteRiderFromFirebase(riderId: string): Promise<{ success: boolean; error?: string }> {
  const pathForDelete = `riders/${riderId}`;
  try {
    console.log(`[SmartCart Firebase] Deleting rider from database: ${riderId}`);
    const riderRef = doc(db, "riders", riderId);
    await deleteDoc(riderRef);
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
  }
}

/**
 * Fetch all riders from Firestore
 */
export async function fetchRidersFromFirebase(): Promise<Rider[]> {
  const pathForList = "riders";
  try {
    const qLabel = query(collection(db, "riders"));
    const querySnapshot = await getDocs(qLabel);
    const fetched: Rider[] = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      fetched.push({
        id: data.id || docSnapshot.id,
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        password: data.password || "123456",
        vehicleNumber: data.vehicleNumber || "",
        isActiveOnDuty: !!data.isActiveOnDuty,
        lat: Number(data.lat) || 50,
        lng: Number(data.lng) || 50,
        battery: data.battery || "100%",
        avatar: data.avatar || "",
        completedDeliveries: Number(data.completedDeliveries) || 0,
        activeDeliveries: Number(data.activeDeliveries) || 0,
        avgDeliveryTime: Number(data.avgDeliveryTime) || 12,
      });
    });
    return fetched;
  } catch (error) {
    console.error("[SmartCart Firebase] Failed to fetch riders from Firestore", error);
    return [];
  }
}

/**
 * Get dynamic localStorage key for orders
 */
function getLocalOrdersStorageKey(): string {
  try {
    const isCustomerLoggedIn = localStorage.getItem("smartcart_customer_logged_in") === "true";
    const userEmail = localStorage.getItem("smartcart_customer_email") || "";
    const userPhone = localStorage.getItem("smartcart_customer_phone") || "";
    
    if (isCustomerLoggedIn) {
      if (userEmail) {
        return `smartcart_orders_sim_${userEmail.replace(/[@.]/g, "_")}`;
      }
      if (userPhone) {
        return `smartcart_orders_sim_${userPhone.replace(/\D/g, "")}`;
      }
    }
  } catch (e) {}
  return "smartcart_orders_anonymous";
}

/**
 * Safe utility to recursively clean object properties that are undefined.
 * Modern Firestore SDK throws validation errors on encountering undefined fields.
 */
export function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  }
  if (typeof obj === "object") {
    const result: any = {};
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = removeUndefined(val);
      }
    });
    return result;
  }
  return obj;
}

/**
 * Sync Order to Firestore
 */
export async function syncOrderToFirebase(order: Order): Promise<{ success: boolean; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log("[SmartCart Firebase] Guest/simulated user session. Skipping Firestore document write.");
    return { success: true };
  }

  const pathForWrite = `orders/${order.id}`;
  try {
    const payload = {
      id: order.id,
      userId: order.userId || "anonymous",
      userEmail: order.userEmail || "",
      date: order.date,
      items: order.items,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      deliveryCharge: Number(order.deliveryCharge),
      platformFee: order.platformFee !== undefined ? Number(order.platformFee) : 3,
      handlingCharge: order.handlingCharge !== undefined ? Number(order.handlingCharge) : 10,
      total: Number(order.total),
      status: order.status,
      delivery_status: order.delivery_status || order.status || "placed",
      address: order.address,
      paymentMethod: order.paymentMethod,
      eta: Number(order.eta),
      rider_id: order.rider_id || null,
      rider_name: order.rider_name || null,
      riderId: order.riderId || order.rider_id || null,
      riderName: order.riderName || order.rider_name || null,
      placed_at: order.placed_at || null,
      packed_at: order.packed_at || null,
      out_for_delivery_at: order.out_for_delivery_at || null,
      delivered_at: order.delivered_at || null,
      cancelled_at: order.cancelled_at || null,
      cancelledAt: order.cancelledAt || order.cancelled_at || null,
      deliveryPartner: order.deliveryPartner ? {
        id: order.deliveryPartner.id || order.rider_id || null,
        name: order.deliveryPartner.name || order.rider_name || null,
        rating: order.deliveryPartner.rating || 4.8,
        phone: order.deliveryPartner.phone || null,
        avatar: order.deliveryPartner.avatar || null,
        vehicleNumber: order.deliveryPartner.vehicleNumber || null,
        assigned_at: order.assigned_at || order.deliveryPartner.assigned_at || null,
        accepted_at: order.accepted_at || order.deliveryPartner.accepted_at || null,
        delivery_status: order.delivery_status || order.deliveryPartner.delivery_status || order.status || null,
      } : null,
    };

    console.log(`[SmartCart Firebase] Syncing order: ${order.id}...`, payload);
    const orderRef = doc(db, "orders", order.id);
    await setDoc(orderRef, removeUndefined(payload));
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Fetch all orders from Firestore (sorted by new ID/date desc equivalent or manual timestamp)
 * Uses intelligent client-side query delegation to avoid triggering Firebase Security Rule exception logs.
 */
export async function fetchOrdersFromFirebase(userRole?: string, forceQueryAll?: boolean): Promise<Order[]> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.log("[SmartCart Firebase] Guest/simulated customer session. Skipping remote sync, loading locally.");
    try {
      const key = getLocalOrdersStorageKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return [];
  }

  try {
    let orders: Order[] = [];
    const isAdminUser = currentUser?.email === "himanshu712007@gmail.com" || userRole === "Admin";
    const isRiderUser = userRole === "Rider";
    
    if (isAdminUser || forceQueryAll) {
      console.log(`[SmartCart Firebase] Querying complete order collection for role: Admin`);
      const qAll = query(collection(db, "orders"));
      const querySnapshot = await getDocs(qAll);
      querySnapshot.forEach((docSnapshot) => {
        orders.push(mapDocToOrder(docSnapshot));
      });
    } else if (isRiderUser) {
      console.log(`[SmartCart Firebase] Multi-query for Rider to prevent unauthorized lists: ${currentUser.uid}`);
      
      // Attempt to resolve the correct rider_id (e.g., 'rider-1' etc) from local storage or user profile
      let resolvedRiderId: string | null = null;
      try {
        const cachedSession = localStorage.getItem("smartcart_rider_session");
        if (cachedSession) {
          const parsed = JSON.parse(cachedSession);
          if (parsed && parsed.id) {
            resolvedRiderId = parsed.id;
          }
        }
      } catch (e) {}

      if (!resolvedRiderId) {
        try {
          const profileRef = doc(db, "profiles", currentUser.uid);
          const snapshot = await getDoc(profileRef);
          if (snapshot.exists()) {
            const profileData = snapshot.data();
            if (profileData && profileData.riderId) {
              resolvedRiderId = profileData.riderId;
            }
          }
        } catch (e) {
          console.warn("[SmartCart Firebase] Could not fetch profile on rider order query:", e);
        }
      }

      const orderIds = new Set<string>();
      
      // Query 1: status == 'placed' (Available orders)
      const qPlaced = query(collection(db, "orders"), where("status", "==", "placed"));
      const snapPlaced = await getDocs(qPlaced);
      snapPlaced.forEach((docSnapshot) => {
        const ord = mapDocToOrder(docSnapshot);
        orders.push(ord);
        orderIds.add(ord.id);
      });
      
      // Query 2: rider_id == currentUser.uid (Assigned to me via user UID)
      const qAssignedUid = query(collection(db, "orders"), where("rider_id", "==", currentUser.uid));
      const snapAssignedUid = await getDocs(qAssignedUid);
      snapAssignedUid.forEach((docSnapshot) => {
        const ord = mapDocToOrder(docSnapshot);
        if (!orderIds.has(ord.id)) {
          orders.push(ord);
          orderIds.add(ord.id);
        }
      });

      // Query 3: rider_id == resolvedRiderId (Assigned to me via specific Rider ID e.g. rider-1)
      if (resolvedRiderId && resolvedRiderId !== currentUser.uid) {
        const qAssignedRiderId = query(collection(db, "orders"), where("rider_id", "==", resolvedRiderId));
        const snapAssignedRiderId = await getDocs(qAssignedRiderId);
        snapAssignedRiderId.forEach((docSnapshot) => {
          const ord = mapDocToOrder(docSnapshot);
          if (!orderIds.has(ord.id)) {
            orders.push(ord);
            orderIds.add(ord.id);
          }
        });
      }

      // Query 4: rider_id == 'rider-unassigned' (Unassigned orders with confirmed/packed/placed status in system)
      try {
        const qUnassignedSt = query(collection(db, "orders"), where("rider_id", "==", "rider-unassigned"));
        const snapUnassignedSt = await getDocs(qUnassignedSt);
        snapUnassignedSt.forEach((docSnapshot) => {
          const ord = mapDocToOrder(docSnapshot);
          if (!orderIds.has(ord.id)) {
            orders.push(ord);
            orderIds.add(ord.id);
          }
        });
      } catch (e) {
        console.warn("[SmartCart Firebase] Could not fetch rider-unassigned query:", e);
      }

      // Query 5: rider_id == null (Unassigned orders where.rider_id is null)
      try {
        const qNullRider = query(collection(db, "orders"), where("rider_id", "==", null));
        const snapNullRider = await getDocs(qNullRider);
        snapNullRider.forEach((docSnapshot) => {
          const ord = mapDocToOrder(docSnapshot);
          if (!orderIds.has(ord.id)) {
            orders.push(ord);
            orderIds.add(ord.id);
          }
        });
      } catch (e) {
        console.warn("[SmartCart Firebase] Could not fetch rider_id==null query:", e);
      }
    } else {
      console.log(`[SmartCart Firebase] Fetching user-scoped orders for Customer: ${currentUser.uid}`);
      const qUser = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
      const querySnapshot = await getDocs(qUser);
      querySnapshot.forEach((docSnapshot) => {
        orders.push(mapDocToOrder(docSnapshot));
      });
    }

    // Sort by id descending (so newly created orders appear first)
    return orders.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.warn("[SmartCart Firebase] Order fetch error quietly handled:", error);
    return [];
  }
}

// Reusable doc mapper to DRY things up
function mapDocToOrder(docSnapshot: any): Order {
  const data = docSnapshot.data();
  const partner = data.deliveryPartner || undefined;
  return {
    id: data.id || docSnapshot.id,
    userId: data.userId || "anonymous",
    userEmail: data.userEmail || "",
    date: data.date,
    items: data.items,
    subtotal: Number(data.subtotal),
    discount: Number(data.discount),
    deliveryCharge: Number(data.deliveryCharge),
    platformFee: data.platformFee !== undefined ? Number(data.platformFee) : 3,
    handlingCharge: data.handlingCharge !== undefined ? Number(data.handlingCharge) : 10,
    total: Number(data.total),
    status: data.status as Order["status"],
    address: data.address,
    paymentMethod: data.paymentMethod,
    eta: Number(data.eta),
    deliveryPartner: partner || undefined,
    rider_id: data.rider_id || partner?.id || undefined,
    rider_name: data.rider_name || partner?.name || undefined,
    assigned_at: data.assigned_at || partner?.assigned_at || undefined,
    accepted_at: data.accepted_at || partner?.accepted_at || data.acceptedAt || undefined,
    delivery_status: data.delivery_status || partner?.delivery_status || data.status || undefined,
    placed_at: data.placed_at || undefined,
    packed_at: data.packed_at || undefined,
    out_for_delivery_at: data.out_for_delivery_at || undefined,
    delivered_at: data.delivered_at || undefined,
    cancelled_at: data.cancelled_at || undefined,
    cancelledAt: data.cancelledAt || data.cancelled_at || undefined,
  };
}

/**
 * Fetch all saved addresses for a user from Firestore under users/{userId}/addresses/{addressId}
 */
export async function fetchSavedAddressesFromFirebase(userId: string): Promise<Address[]> {
  const pathForList = `users/${userId}/addresses`;
  try {
    const addressesRef = collection(db, "users", userId, "addresses");
    const qSnapshot = await getDocs(addressesRef);
    const addresses: Address[] = [];
    qSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const combinedAddressLine = data.houseFlatNumber && data.street
        ? `${data.houseFlatNumber}, ${data.street}`
        : (data.street || data.houseFlatNumber || "");
      addresses.push({
        id: docSnapshot.id,
        label: (data.landmark || "Home") as "Home" | "Work" | "Other",
        name: data.fullName || "",
        addressLine: combinedAddressLine,
        city: data.city || "",
        pincode: data.pincode || "",
        phone: data.phoneNumber || "",
        isDefault: !!data.isDefault,
        fullName: data.fullName || "",
        phoneNumber: data.phoneNumber || "",
        houseFlatNumber: data.houseFlatNumber || "",
        street: data.street || "",
        landmark: data.landmark || "Home",
        state: data.state || "",
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      });
    });
    // Sort so that isDefault is first, then by createdAt asc
    return addresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tA - tB;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathForList);
  }
}

/**
 * Save an address to Firestore under users/{userId}/addresses/{addressId}
 */
export async function saveAddressToFirebase(
  userId: string,
  address: Address | Omit<Address, "id">,
  isDefault = false
): Promise<Address> {
  const addressId = "id" in address && address.id ? address.id : `addr-${Date.now()}`;
  const pathForWrite = `users/${userId}/addresses/${addressId}`;
  try {
    const addressRef = doc(db, "users", userId, "addresses", addressId);
    
    let houseFlatNumber = "";
    let street = "";
    if ("houseFlatNumber" in address && address.houseFlatNumber) {
      houseFlatNumber = address.houseFlatNumber;
      street = address.street || "";
    } else {
      const parts = (address.addressLine || "").split(",");
      houseFlatNumber = parts[0]?.trim() || "";
      street = parts.slice(1).join(",")?.trim() || address.addressLine || "";
    }

    const payload = {
      fullName: address.name || ("fullName" in address ? (address as any).fullName : "") || "",
      phoneNumber: address.phone || ("phoneNumber" in address ? (address as any).phoneNumber : "") || "",
      houseFlatNumber: houseFlatNumber,
      street: street,
      landmark: address.label || ("landmark" in address ? (address as any).landmark : "Home") || "Home",
      city: address.city || "",
      state: ("state" in address ? (address as any).state : "") || "Delhi",
      pincode: address.pincode || "",
      isDefault: isDefault,
      createdAt: ("createdAt" in address ? (address as any).createdAt : "") || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDefault) {
      const addressesRef = collection(db, "users", userId, "addresses");
      const qSnapshot = await getDocs(addressesRef);
      const batch = writeBatch(db);
      let count = 0;
      qSnapshot.forEach((docSnap) => {
        if (docSnap.id !== addressId) {
          batch.update(doc(db, "users", userId, "addresses", docSnap.id), { 
            isDefault: false, 
            updatedAt: new Date().toISOString() 
          });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }

    await setDoc(addressRef, removeUndefined(payload));

    return {
      id: addressId,
      label: payload.landmark as "Home" | "Work" | "Other",
      name: payload.fullName,
      addressLine: "houseFlatNumber" in address && address.houseFlatNumber 
        ? `${payload.houseFlatNumber}, ${payload.street}` 
        : address.addressLine || payload.street,
      city: payload.city,
      pincode: payload.pincode,
      phone: payload.phoneNumber,
      isDefault: payload.isDefault,
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      houseFlatNumber: payload.houseFlatNumber,
      street: payload.street,
      landmark: payload.landmark,
      state: payload.state,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Delete an address from Firestore
 */
export async function deleteAddressFromFirebase(userId: string, addressId: string): Promise<void> {
  const pathForDelete = `users/${userId}/addresses/${addressId}`;
  try {
    const addressRef = doc(db, "users", userId, "addresses", addressId);
    await deleteDoc(addressRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
  }
}

/**
 * Set an address as default in Firestore and unset all other default addresses
 */
export async function setDefaultAddressInFirebase(userId: string, addressId: string): Promise<void> {
  const pathForWrite = `users/${userId}/addresses/${addressId}`;
  try {
    const addressesRef = collection(db, "users", userId, "addresses");
    const querySnapshot = await getDocs(addressesRef);
    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((docSnap) => {
      const isCurrent = docSnap.id === addressId;
      batch.update(doc(db, "users", userId, "addresses", docSnap.id), { 
        isDefault: isCurrent, 
        updatedAt: new Date().toISOString() 
      });
      count++;
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Clear/reset all saved addresses for a user in Firestore
 */
export async function clearAllAddressesFromFirebase(userId: string): Promise<void> {
  const pathForDelete = `users/${userId}/addresses`;
  try {
    const addressesRef = collection(db, "users", userId, "addresses");
    const qSnapshot = await getDocs(addressesRef);
    const batch = writeBatch(db);
    let count = 0;
    qSnapshot.forEach((docSnapshot) => {
      batch.delete(doc(db, "users", userId, "addresses", docSnapshot.id));
      count++;
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
  }
}
