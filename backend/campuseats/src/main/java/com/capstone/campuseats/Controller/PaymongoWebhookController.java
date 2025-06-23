package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Service.DasherService;
import com.capstone.campuseats.Service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/paymongo-webhook")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class PaymongoWebhookController {

    private final DasherService dasherService;
    private final PaymentService paymentService;

    @PostMapping
    public ResponseEntity<?> handlePaymongoWebhook(@RequestBody Map<String, Object> payload) {
        try {
            // Extract the data object from the webhook payload
            Map<String, Object> data = (Map<String, Object>) payload.get("data");
            
            // Check if this is a payment event
            String type = (String) data.get("type");
            if (type != null && type.equals("payment")) {
                // Get the attributes
                Map<String, Object> attributes = (Map<String, Object>) data.get("attributes");
                String status = (String) attributes.get("status");
                
                // Get metadata if available
                Map<String, Object> metadata = (Map<String, Object>) attributes.get("metadata");
                
                // Process payment based on status
                if ("paid".equals(status) && metadata != null) {
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
                                "message", "Dasher wallet updated successfully",
                                "dasherId", dasherId,
                                "amount", amount
                            ));
                        } else {
                            return ResponseEntity.badRequest().body(Map.of(
                                "success", false,
                                "message", "Failed to update dasher wallet"
                            ));
                        }
                    }
                }
            }
            
            // Return acknowledgment for other events
            return ResponseEntity.ok(Map.of(
                "received", true,
                "message", "Webhook received but no action taken"
            ));
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }
}
