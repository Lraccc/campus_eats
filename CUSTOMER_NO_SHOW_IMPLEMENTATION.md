# Customer No-Show Report Feature Implementation

## Overview
This feature allows customers to report when a dasher doesn't show up for delivery, similar to how dashers can report customer no-shows. The system handles proof submission, creates reimbursement requests, and updates order status accordingly.

## Backend Changes

### 1. OrderEntity.java
**Added Fields:**
- `customerNoShowProofImage` - Stores the Azure Blob Storage URL of the proof image uploaded by the customer
- `customerNoShowGcashQr` - Stores the Azure Blob Storage URL of the customer's GCash QR code for refund

**New Getters/Setters:**
- `getCustomerNoShowProofImage()` / `setCustomerNoShowProofImage(String customerNoShowProofImage)`
- `getCustomerNoShowGcashQr()` / `setCustomerNoShowGcashQr(String customerNoShowGcashQr)`

### 2. ReimburseEntity.java
**Added Fields:**
- `userId` - Stores the customer's user ID when customer reports a dasher no-show
- `type` - Distinguishes between "dasher-report" and "customer-report"

**New Getters/Setters:**
- `getUserId()` / `setUserId(String userId)`
- `getType()` / `setType(String type)`

### 3. OrderService.java
**New Method: `reportCustomerNoShow(String orderId, MultipartFile proofImage, MultipartFile gcashQr)`**

This method handles the complete workflow for customer no-show reports:

1. **Validates the order exists** and has a dasher assigned
2. **Uploads proof image** to Azure Blob Storage under `customerNoShowProof/` folder
3. **Uploads GCash QR code** to Azure Blob Storage under `customerGcashQr/` folder
4. **Updates order status** to `"dasher-no-show"`
5. **Creates a reimbursement entry** with:
   - Order ID
   - Dasher ID
   - Customer's User ID
   - Total order amount
   - Type: "customer-report"
   - Status: "pending"
   - Proof image URL
   - GCash QR URL (for refund processing)
6. **Records offense** for the dasher (ready for future implementation)
7. **Sends notification** to customer confirming report submission

### 4. OrderController.java
**New Endpoints:**

#### POST `/api/orders/customer-report-no-show`
- **Purpose:** Allows customers to report dasher no-shows
- **Content-Type:** `multipart/form-data`
- **Request Parameters:**
  - `orderId` (String) - The order ID to report
  - `proofImage` (MultipartFile) - Proof image (required)
  - `gcashQr` (MultipartFile) - Customer's GCash QR code (required)
- **Response Success (200):**
  ```json
  {
    "message": "No-show report submitted successfully. Our team will review it.",
    "success": true,
    "orderId": "ORDER123"
  }
  ```
- **Response Error (400):**
  ```json
  {
    "error": "Order ID is required" | "Proof image is required" | "GCash QR code is required" | "No dasher assigned to this order"
  }
  ```

#### GET `/api/orders/dasher-no-show-orders`
- **Purpose:** Retrieves all orders where customers reported dasher no-shows
- **Response:** Array of OrderEntity objects with status "dasher-no-show"

## How It Works

### Flow Diagram
```
Customer Reports No-Show
    ↓
Upload Proof Image to Azure Blob
    ↓
Upload GCash QR to Azure Blob
    ↓
Update Order Status → "dasher-no-show"
    ↓
Create Reimbursement Entry (with GCash QR for refund)
    ↓
Record Dasher Offense (future)
    ↓
Send Confirmation Notification
```

### Comparison: Dasher vs Customer No-Show

| Aspect | Dasher Reports Customer | Customer Reports Dasher |
|--------|------------------------|-------------------------|
| **Status** | `"no-show"` or `"no_show"` | `"dasher-no-show"` |
| **Proof Field** | `noShowProofImage` | `customerNoShowProofImage` |
| **GCash QR Field** | `gcashQr` (in reimburse) | `customerNoShowGcashQr` |
| **Blob Folders** | `noShowProof/`, `reimburse/` | `customerNoShowProof/`, `customerGcashQr/` |
| **Reimbursement Type** | (implicit dasher-report) | `"customer-report"` |
| **Offense Target** | Customer (User) | Dasher |
| **Endpoint** | `/update-order-status-with-proof` | `/customer-report-no-show` |

## Mobile Implementation Guide

### ✅ IMPLEMENTED - Customer No-Show Reporting in Mobile App

The customer no-show reporting feature has been **fully implemented** in the mobile app!

#### Location: `mobile/screens/User/Order.tsx`

#### Features Added:

1. **"Report Dasher No-Show" Button**
   - Appears when order status is `"Order is on the way"` (active_onTheWay)
   - Only visible when dasher is assigned
   - Orange button with warning icon for visibility

2. **Dual Image Capture**
   - **Proof Image**: Camera integration for live proof capture
   - **GCash QR Code**: Gallery picker for QR code selection
   - Preview both images before submission
   - Both images are required for submission

3. **Report No-Show Modal**
   - Clean UI matching app design
   - Required proof image upload (orange theme)
   - Required GCash QR upload (green theme)
   - Scrollable content for better UX
   - Warning about false reports
   - Submit button disabled until both images are uploaded

4. **Backend Integration**
   - Calls `/api/orders/customer-report-no-show` endpoint
   - Sends FormData with orderId, proof image, and GCash QR
   - Handles success/error responses with detailed messages
   - Refreshes order list after submission

#### User Flow:

```
1. Customer sees "Order is on the way" status
2. "Report Dasher No-Show" button appears (orange)
3. Customer taps button → Modal opens
4. Customer takes photo proof using camera
5. Customer selects GCash QR from gallery
6. Reviews both image previews
7. Taps "Submit Report"
8. App uploads proof and GCash QR to backend
9. Success message shown
10. Order list refreshes automatically
```

#### State Variables Added:
```typescript
const [showReportNoShowModal, setShowReportNoShowModal] = useState(false)
const [noShowProofImage, setNoShowProofImage] = useState<string | null>(null)
const [noShowGcashQr, setNoShowGcashQr] = useState<string | null>(null)
const [isSubmittingNoShow, setIsSubmittingNoShow] = useState(false)
```

#### Key Functions:
- `handlePickNoShowProof()` - Opens camera to capture proof image
- `handlePickGcashQr()` - Opens gallery to select GCash QR code
- `handleReportNoShow()` - Validates both images and submits report to backend
- `showReportNoShowButton` - Logic to show button only when appropriate

### ✅ IMPLEMENTED - No-Show Report History in Profile

**Location:** `mobile/screens/User/Profile.tsx`

**Features Added:**

1. **No-Show Reports Card**
   - Displays all customer-reported dasher no-shows
   - Shows order ID, date/time, and total amount
   - Badge count for number of active reports
   - Visual proof indicator when image is attached

2. **Report Status Display**
   - "Under Review" status for all submitted reports
   - Order details with timestamp
   - Amount and proof attachment indicators
   - Scrollable list for multiple reports

3. **Auto-Refresh**
   - Fetches reports when profile loads
   - Refreshes when screen comes into focus
   - Only visible for regular customers

4. **UI Features:**
   - Empty state when no reports exist
   - Loading indicator while fetching
   - Clean card design matching app theme
   - Orange/warning color scheme for visibility

---

## Original Implementation Guide (for reference)

To implement this feature in the mobile app, you'll need to:

### 1. Create the Report No-Show Screen
```typescript
// Suggested location: mobile/app/report-dasher-no-show.tsx
// or mobile/screens/User/ReportDasherNoShow.tsx

interface ReportNoShowProps {
  orderId: string;
  onSuccess: () => void;
}
```

### 2. Add Image Picker Functionality
Use `expo-image-picker` to capture or select proof:
```typescript
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  
  if (!result.canceled) {
    setProofImage(result.assets[0]);
  }
};
```

### 3. Create API Call
```typescript
// In mobile/services/axiosConfig.ts or similar

export const reportDasherNoShow = async (
  orderId: string,
  proofImage: { uri: string; type: string; name: string }
): Promise<{ success: boolean; message: string }> => {
  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('proofImage', {
    uri: proofImage.uri,
    type: proofImage.type || 'image/jpeg',
    name: proofImage.name || 'proof.jpg',
  } as any);

  const response = await api.post('/orders/customer-report-no-show', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
```

### 4. Add UI Button/Option
Add a "Report No-Show" button in:
- Active order details screen
- Order history for orders that are ready for pickup/delivery

```typescript
<Button
  title="Report Dasher No-Show"
  onPress={() => navigation.navigate('ReportDasherNoShow', { orderId })}
/>
```

### 5. Handle Response
```typescript
const handleSubmitReport = async () => {
  try {
    setLoading(true);
    const result = await reportDasherNoShow(orderId, proofImage);
    
    Alert.alert(
      'Report Submitted',
      result.message,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  } catch (error) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to submit report');
  } finally {
    setLoading(false);
  }
};
```

## Testing

### Backend Testing (using Postman or similar)
```
POST http://localhost:8080/api/orders/customer-report-no-show
Content-Type: multipart/form-data

Body:
- orderId: [valid order ID with dasher assigned]
- proofImage: [image file]
```

### Expected Behavior
1. Image uploads to Azure Blob Storage
2. Order status changes to "dasher-no-show"
3. Reimbursement entry created with type "customer-report"
4. Customer receives notification
5. Can fetch using GET `/api/orders/dasher-no-show-orders`

## Database Changes
The system uses MongoDB, so no migration is needed. The new fields will be automatically added when first used:
- `OrderEntity.customerNoShowProofImage`
- `ReimburseEntity.userId`
- `ReimburseEntity.type`

## Future Enhancements
1. Add dasher offense tracking (similar to customer offenses)
2. Implement admin review panel for no-show reports
3. Add automatic refund processing after admin approval
4. Send notifications to dashers about no-show reports
5. Add dispute resolution system

## Notes
- Proof image is mandatory for customer no-show reports
- Only orders with assigned dashers can be reported
- Reimbursement status starts as "pending" and requires admin approval
- The system prevents duplicate reimbursement entries for the same order
