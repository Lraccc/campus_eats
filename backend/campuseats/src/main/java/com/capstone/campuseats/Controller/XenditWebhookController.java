package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Service.DasherService;
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
    private final PaymentService paymentService;

    @Value("${XENDIT_WEBHOOK_VERIFICATION_TOKEN}")
    private String xenditWebhookVerificationToken;

    @PostMapping
    public ResponseEntity<?> handleXenditWebhook(
            @RequestHeader(value = "x-callback-token", required = false) String callbackToken,
            @RequestBody Map<String, Object> payload) {
        try {
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
            
            // Check if this is an e-wallet charge success event
            if (event != null && event.equals("ewallet.charge.succeeded")) {
                // Get the data object
                Map<String, Object> data = (Map<String, Object>) payload.get("data");
                String status = (String) data.get("status");
                
                // Get metadata if available
                Map<String, Object> metadata = (Map<String, Object>) data.get("metadata");
                
                // Process payment based on status
                if ("SUCCEEDED".equals(status) && metadata != null) {
                    String paymentType = (String) metadata.get("type");
                    
                    // Handle topup payment
                    if ("topup".equals(paymentType)) {
                        String dasherId = (String) metadata.get("dasherId");
                        double amount = Double.parseDouble(metadata.get("amount").toString());
                        
                        // Update the dasher's wallet
                        boolean updated = dasherService.updateDasherWallet(dasherId, amount);
                        
                        if (updated) {
                            return ResponseEntity.ok(Map.of(
                                "success", true, 
                                "message", "Topup processed successfully"
                            ));
                        } else {
                            return ResponseEntity.badRequest().body(Map.of(
                                "success", false, 
                                "message", "Failed to update dasher wallet"
                            ));
                        }
                    }
                    
                    // Handle order payment
                    if ("order".equals(paymentType)) {
                        String orderId = (String) metadata.get("orderId");
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
            return ResponseEntity.ok(Map.of("success", true));
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false, 
                "message", "Error processing webhook: " + e.getMessage()
            ));
        }
    }
}
