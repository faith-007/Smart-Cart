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
  where
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
import { Order, Rider } from "../types";
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
    await setDoc(profileRef, payload);
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
    await setDoc(riderRef, payload);
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
 * Sync Order to Firestore
 */
export async function syncOrderToFirebase(order: Order): Promise<{ success: boolean; error?: string }> {
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
      total: Number(order.total),
      status: order.status,
      address: order.address,
      paymentMethod: order.paymentMethod,
      eta: Number(order.eta),
      rider_id: order.rider_id || null,
      rider_name: order.rider_name || null,
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
    await setDoc(orderRef, payload);
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

  try {
    let querySnapshot;
    const isAdminUser = currentUser?.email === "himanshu712007@gmail.com" || userRole === "Admin";
    const isRiderUser = userRole === "Rider";
    
    // Admins and Riders (even when simulated or unauthenticated on Firebase) can query all orders
    if (isAdminUser || isRiderUser || forceQueryAll) {
      console.log(`[SmartCart Firebase] Querying complete order collection for role: ${userRole}`);
      const qAll = query(collection(db, "orders"));
      querySnapshot = await getDocs(qAll);
    } else if (currentUser) {
      console.log(`[SmartCart Firebase] Fetching user-scoped orders for: ${currentUser.uid}`);
      const qUser = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
      querySnapshot = await getDocs(qUser);
    } else {
      console.log("[SmartCart Firebase] Guest/simulated customer session. Skipping remote sync.");
      return [];
    }

    const orders: Order[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const partner = data.deliveryPartner || undefined;
      orders.push({
        id: data.id || docSnapshot.id,
        userId: data.userId || "anonymous",
        userEmail: data.userEmail || "",
        date: data.date,
        items: data.items,
        subtotal: Number(data.subtotal),
        discount: Number(data.discount),
        deliveryCharge: Number(data.deliveryCharge),
        total: Number(data.total),
        status: data.status as Order["status"],
        address: data.address,
        paymentMethod: data.paymentMethod,
        eta: Number(data.eta),
        deliveryPartner: partner || undefined,
        rider_id: partner?.id || undefined,
        rider_name: partner?.name || undefined,
        assigned_at: partner?.assigned_at || undefined,
        accepted_at: partner?.accepted_at || undefined,
        delivery_status: partner?.delivery_status || data.status || undefined,
      });
    });

    // Sort by id descending (so newly created orders appear first)
    return orders.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.warn("[SmartCart Firebase] Order fetch error quietly handled:", error);
    return [];
  }
}
