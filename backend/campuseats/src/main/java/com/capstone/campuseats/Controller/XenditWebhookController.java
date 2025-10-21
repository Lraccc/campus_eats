package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Service.DasherService;
import com.capstone.campuseats.Service.ShopService;
import com.capstone.campuseats.Service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/xendit-webhook")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class XenditWebhookController {

    private final DasherService dasherService;
    private final ShopService shopService;
    private final PaymentService paymentService;

    @Value("${XENDIT_WEBHOOK_VERIFICATION_TOKEN}")
    private String xenditWebhookVerificationToken;

    @PostMapping
    public ResponseEntity<?> handleXenditWebhook(
            @RequestHeader(value = "x-callback-token", required = false) String callbackToken,
            @RequestBody Map<String, Object> payload) {
        try {
            System.out.println("=== Xendit Webhook Received ===");
            System.out.println("Payload: " + payload);
            
            // Verify webhook authenticity using callback token
            if (callbackToken == null || !callbackToken.equals(xenditWebhookVerificationToken)) {
                System.err.println("⚠️ Webhook verification failed! Invalid token.");
                return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Unauthorized: Invalid webhook token"
                ));
            }

            System.out.println("✅ Webhook verification successful");
            
            // Extract event type from Xendit webhook
            String event = (String) payload.get("event");
            System.out.println("Event type: " + event);
            
            // Check if this is an e-wallet charge success event
            if (event != null && event.equals("ewallet.charge.succeeded")) {
                // Get the data object
                Map<String, Object> data = (Map<String, Object>) payload.get("data");
                String status = (String) data.get("status");
                System.out.println("Payment status: " + status);
                
                // Get metadata if available
                Map<String, Object> metadata = (Map<String, Object>) data.get("metadata");
                System.out.println("Metadata: " + metadata);
                
                // Process payment based on status
                if ("SUCCEEDED".equals(status) && metadata != null) {
                    String paymentType = (String) metadata.get("type");
                    System.out.println("Payment type: " + paymentType);
                    
                    // Handle topup payment
                    if ("topup".equals(paymentType)) {
                        // Check if it's a dasher or shop topup
                        String dasherId = (String) metadata.get("dasherId");
                        String shopId = (String) metadata.get("shopId");
                        double amount = Double.parseDouble(metadata.get("amount").toString());
                        
                        System.out.println("Processing topup - dasherId: " + dasherId + ", shopId: " + shopId + ", amount: " + amount);
                        
                        // Update dasher wallet if dasherId is present
                        if (dasherId != null && !dasherId.isEmpty()) {
                            boolean updated = dasherService.updateDasherWallet(dasherId, amount);
                            
                            if (updated) {
                                System.out.println("✅ Dasher wallet updated successfully for dasher: " + dasherId);
                                return ResponseEntity.ok(Map.of(
                                    "success", true, 
                                    "message", "Dasher topup processed successfully"
                                ));
                            } else {
                                System.err.println("❌ Failed to update dasher wallet for dasher: " + dasherId);
                                return ResponseEntity.badRequest().body(Map.of(
                                    "success", false, 
                                    "message", "Failed to update dasher wallet"
                                ));
                            }
                        }
                        
                        // Update shop wallet if shopId is present
                        if (shopId != null && !shopId.isEmpty()) {
                            boolean updated = shopService.updateShopWallet(shopId, (float) amount);
                            
                            if (updated) {
                                System.out.println("✅ Shop wallet updated successfully for shop: " + shopId);
                                return ResponseEntity.ok(Map.of(
                                    "success", true, 
                                    "message", "Shop topup processed successfully"
                                ));
                            } else {
                                System.err.println("❌ Failed to update shop wallet for shop: " + shopId);
                                return ResponseEntity.badRequest().body(Map.of(
                                    "success", false, 
                                    "message", "Failed to update shop wallet"
                                ));
                            }
                        }
                        
                        System.err.println("⚠️ No dasherId or shopId found in topup metadata");
                        return ResponseEntity.badRequest().body(Map.of(
                            "success", false, 
                            "message", "No dasherId or shopId provided for topup"
                        ));
                    }
                    
                    // Handle order payment
                    if ("order".equals(paymentType)) {
                        String orderId = (String) metadata.get("orderId");
                        System.out.println("Processing order payment for orderId: " + orderId);
                        // Process the order payment
                        // Add your order processing logic here
                        
                        return ResponseEntity.ok(Map.of(
                            "success", true, 
                            "message", "Order payment processed successfully"
                        ));
                    }
                }
            }
            
            // Return success for other events
            System.out.println("Webhook processed - no specific action needed");
            return ResponseEntity.ok(Map.of("success", true));
            
        } catch (Exception e) {
            System.err.println("❌ Error processing webhook: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false, 
                "message", "Error processing webhook: " + e.getMessage()
            ));
        }
    }
}
