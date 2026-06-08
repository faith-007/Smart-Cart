# Zero-Trust Firestore Security Specification

This document defines the high-integrity security invariants, the "Dirty Dozen" spoofing payloads, and unit testing guidelines for the SmartCart Firestore database rules.

## 1. Data Invariants

1. **Profile Isolation (Identity Principle)**: A user's profile (`/profiles/{userId}`) can only be created or modified by the authenticated owner (`request.auth.uid == userId`). Standard users are strictly blocked from writing or escalating roles (e.g., upgrading to `Admin` or `Rider`).
2. **Order Integrity (Ownership Principle)**: Customers can only register orders (`/orders/{orderId}`) under their own verified `userId`. Orders cannot be modified by anonymous or other customers post-placement.
3. **Restricted Rider Mutations (Operational Clearance)**: Rider partner files (`/riders/{uid}`) cannot be generated or deleted by standard customers. Only pre-configured administrators or the assigned courier itself can update limited tracking state variables (`lat`, `lng`, `isActiveOnDuty`).
4. **Systems Control**: Administrative access `/admins/{uid}` is strictly read-only for verified accounts and completely inaccessible to normal customers for write operations.

---

## 2. The "Dirty Dozen" Payloads (Anti-Spoofing and Exploits Validation)

The following payloads represent real-world malicious attempts to bypass identity checks, poison state transitions, or execute privilege escalation. Standard validation rules must return `PERMISSION_DENIED` for all:

### P1: Privilege Escalation (Self-Assigned Admin Role)
* **Target Path**: `/profiles/user_abc`
* **Intended Exploit**: Normal user attempts to insert `"role": "Admin"` into their profile.
* **Payload**:
  ```json
  {
    "userId": "user_abc",
    "name": "Attacker",
    "email": "attacker@darkside.io",
    "role": "Admin"
  }
  ```

### P2: Identity Spoofing (Orphaned Order Creation)
* **Target Path**: `/orders/order_999`
* **Intended Exploit**: Authenticated user `user_attacker` attempts to post an order for `user_victim`.
* **Payload**:
  ```json
  {
    "id": "order_999",
    "userId": "user_victim",
    "items": [],
    "total": 120,
    "status": "placed"
  }
  ```

### P3: Resource Poisoning (Giant Key Size Injection)
* **Target Path**: `/profiles/user_abc`
* **Intended Exploit**: Sending an extremely large name key to deplete resource memory or trigger overflow.
* **Payload**:
  ```json
  {
    "userId": "user_abc",
    "name": "A-Very-Long-Attacker-Name-That-Exceeds-One-Hundred-Characters-For-An-Atypical-Denial-Of-Wallet-Storage-Vector-Attack...",
    "email": "attacker@darkside.io"
  }
  ```

### P4: Direct Access of Administrative Lists
* **Target Path**: `/admins/hacker_uid`
* **Intended Exploit**: Writing a document directly inside the admin authorization path to gain level-6 clearance.
* **Payload**:
  ```json
  {
    "authorized": true,
    "email": "attacker@darkside.io"
  }
  ```

### P5: Bypassing Immutable Creation Date
* **Target Path**: `/profiles/user_abc`
* **Intended Exploit**: Standard user updating their profile with an invalid, arbitrary historical creation date.
* **Payload**:
  ```json
  {
    "userId": "user_abc",
    "name": "Attacker",
    "email": "attacker@darkside.io",
    "created_at": "1999-01-01T00:00:00Z"
  }
  ```

### P6: Unauthorized Status Hijacking (State Shortcutting)
* **Target Path**: `/orders/order_123`
* **Intended Exploit**: Customer attempts to directly transition their pending order to `delivered` without financial dispatch.
* **Payload**:
  ```json
  {
    "id": "order_123",
    "userId": "user_abc",
    "items": [],
    "total": 150,
    "status": "delivered"
  }
  ```

### P7: Value Poisoning (Invalid Type in Numerical Fields)
* **Target Path**: `/orders/order_123`
* **Intended Exploit**: Injecting list formats into numeric pricing variables to bypass calculations.
* **Payload**:
  ```json
  {
    "id": "order_123",
    "userId": "user_abc",
    "items": [],
    "total": "one-hundred-and-fifty-dollars",
    "status": "placed"
  }
  ```

### P8: Overwriting Rider Registration Documents
* **Target Path**: `/riders/rider_777`
* **Intended Exploit**: Customer or random user attempting to register themselves as a courier partner.
* **Payload**:
  ```json
  {
    "id": "rider_777",
    "name": "Hacker Delivery",
    "phone": "555-0100",
    "email": "hacker@delivery.net",
    "password": "PIN-MALFORMED-12345",
    "vehicleNumber": "XYZ-9999",
    "isActiveOnDuty": true,
    "lat": 0,
    "lng": 0
  }
  ```

### P9: Illegal Deletion of Order Records
* **Target Path**: `/orders/order_123`
* **Intended Exploit**: Non-admin attempting to clear out invoice trails.
* **Payload**: `N/A` (Incoming DELETE request)

### P10: PII Exfiltration (Blanket Read Harvesting)
* **Target Path**: `/profiles` (List query)
* **Intended Exploit**: Authenticated customer attempts to scrape and extract user phone numbers and emails of other customers.
* **Payload**: `N/A` (GET collection stream request)

### P11: Tampering Rider Battery Logs (Out-of-Duty Modification)
* **Target Path**: `/riders/rider_777`
* **Intended Exploit**: Triggering state modifications of coordinates or battery telemetry without active duty authorization.
* **Payload**:
  ```json
  {
    "battery": "100%",
    "isActiveOnDuty": false
  }
  ```

### P12: Overriding Courier Password Credentials
* **Target Path**: `/riders/rider_777`
* **Intended Exploit**: Attempting to update a Rider document's secure 6-digit access numeric PIN code.
* **Payload**:
  ```json
  {
    "password": "999999"
  }
  ```

---

## 3. Test Runner Definitions

Rules can be local or cloud-verified. The following outline implements declarative unit assertions to block all spoofed payloads:

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("SmartCart Fortress Rules Validation", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "smartcart-fortress",
      firestore: {
        rules: "firestore.rules"
      }
    });
  });

  it("should fail self-assigned admin updates from standard profiles (P1)", async () => {
    const context = testEnv.authenticatedContext("user_abc");
    const db = context.firestore();
    await assertFails(db.doc("profiles/user_abc").set({
      userId: "user_abc",
      name: "Attacker",
      email: "attacker@darkside.io",
      role: "Admin"
    }));
  });

  it("should block orphaned order matching (P2)", async () => {
    const context = testEnv.authenticatedContext("user_attacker");
    const db = context.firestore();
    await assertFails(db.doc("orders/order_999").set({
      id: "order_999",
      userId: "user_victim",
      items: [],
      total: 120,
      status: "placed"
    }));
  });
});
```
