package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.*;
import com.capstone.campuseats.Repository.*;
import com.capstone.campuseats.config.CustomException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final OrderRepository orderRepository;
    private final ItemRepository itemRepository;
    private final PaymentRepository paymentRepository;

    private final DasherRepository dasherRepository;
    private final ShopRepository shopRepository;

    private final RatingRepository ratingRepository;

    @Value("${XENDIT_SECRET:}")
    private String xenditSecret;

     @Value("${XENDIT_WEBHOOK_URL:}")
    private String xenditWebhookUrl;

    public void confirmOrderCompletion(String orderId, String dasherId, String shopId, String userId, String paymentMethod, float deliveryFee, float totalPrice, List<CartItem> items, float previousNoShowFee, float previousNoShowItems) {
        System.out.println("=== PAYMENT SERVICE DEBUG ===");
        System.out.println("Order ID: " + orderId);
        System.out.println("Dasher ID: " + dasherId);
        System.out.println("Shop ID: " + shopId);
        System.out.println("Payment Method: " + paymentMethod);
        System.out.println("Delivery Fee: ₱" + deliveryFee);
        System.out.println("Total Price (includes previous no-show): ₱" + totalPrice);
        System.out.println("Previous No-Show Fee: ₱" + previousNoShowFee);
        System.out.println("Previous No-Show Items: ₱" + previousNoShowItems);
        System.out.println("==============================");
        
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);
        if (orderOptional.isEmpty()) {
            throw new CustomException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        order.setStatus("completed");
        order.setDeliveryFee(deliveryFee);
        orderRepository.save(order);

        // Update item quantities
        for (CartItem item : items) {
            Optional<ItemEntity> itemOptional = itemRepository.findById(item.getItemId());
            if (itemOptional.isPresent()) {
                ItemEntity itemEntity = itemOptional.get();
                int newQuantity = itemEntity.getQuantity() - item.getQuantity();
                itemEntity.setQuantity(newQuantity);
                itemRepository.save(itemEntity);
            }
        }

        // Calculate actual food cost (excluding previous no-show charges)
        float actualFoodCost = totalPrice - previousNoShowFee - previousNoShowItems;
        System.out.println("Actual food cost calculation:");
        System.out.println("- Total price: ₱" + totalPrice);
        System.out.println("- Minus previous no-show fee: ₱" + previousNoShowFee);
        System.out.println("- Minus previous no-show items: ₱" + previousNoShowItems);
        System.out.println("- Actual food cost for this shop: ₱" + actualFoodCost);
        
        // Update shop wallet based on payment method
        Optional<ShopEntity> shopOptional = shopRepository.findById(shopId);
        if (shopOptional.isPresent()) {
            ShopEntity shop = shopOptional.get();
            
            if (paymentMethod.equalsIgnoreCase("gcash")) {
                // For online payments: Shop receives ONLY the actual food cost (not previous no-show charges)
                shop.setWallet(shop.getWallet() + actualFoodCost);
                System.out.println("Shop wallet updated (GCash): +" + actualFoodCost + " = " + shop.getWallet());
                if (previousNoShowFee > 0 || previousNoShowItems > 0) {
                    System.out.println("Note: Previous no-show charges (₱" + (previousNoShowFee + previousNoShowItems) + ") will be credited to original dasher when order completes");
                }
            } else if (paymentMethod.equalsIgnoreCase("cash")) {
                // For COD: Shop gets paid directly by dasher in person, no system wallet update
                System.out.println("Shop wallet unchanged (COD): " + shop.getWallet() + " (dasher pays shop directly)");
            }
            
            shopRepository.save(shop);
        } else {
            throw new CustomException("Shop not found");
        }

        // Handle dasher payment and delivery fee distribution
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();
            System.out.println("DASHER WALLET BEFORE UPDATE: ₱" + dasher.getWallet());

            // Fetch ratings for the dasher
            List<RatingEntity> ratings = ratingRepository.findByDasherId(dasherId);
            float averageRating = calculateAverageRating(ratings);

            // Determine the admin fee percentage based on average rating
            float adminFeePercentage = determineFeePercentage(averageRating);
            
            // Calculate fee distribution
            float adminFee = deliveryFee * adminFeePercentage;          // Admin gets percentage of delivery fee
            float dasherDeliveryFee = deliveryFee - adminFee;           // Dasher gets remaining delivery fee

            System.out.println("Fee Distribution Calculation:");
            System.out.println("- Total delivery fee: ₱" + deliveryFee);
            System.out.println("- Admin fee (" + (adminFeePercentage * 100) + "% of delivery): ₱" + adminFee);
            System.out.println("- Dasher delivery fee (" + ((1-adminFeePercentage) * 100) + "% of delivery): ₱" + dasherDeliveryFee);
            System.out.println("- Shop food cost (actual): ₱" + actualFoodCost);
            if (previousNoShowFee > 0 || previousNoShowItems > 0) {
                System.out.println("- Previous no-show charges (for original dasher): ₱" + (previousNoShowFee + previousNoShowItems));
            }

            if (paymentMethod.equalsIgnoreCase("gcash")) {
                // For GCash payments: 
                // Customer paid electronically, so dasher just receives their delivery fee portion
                dasher.setWallet(dasher.getWallet() + dasherDeliveryFee);
                System.out.println("GCash payment: Dasher receives ₱" + dasherDeliveryFee + " delivery fee");
                
            } else if (paymentMethod.equalsIgnoreCase("cash")) {
                // For Cash on Delivery (COD):
                // 1. Dasher uses personal money to buy food from shop (₱100)
                // 2. Dasher collected full amount (totalPrice + deliveryFee) from customer (₱110)
                // 3. Dasher keeps delivery fee portion (₱8) 
                // 4. Dasher owes system ONLY admin fee (₱2), NOT food cost
                // 5. Shop gets paid directly by dasher in cash, not through system wallet
                
                double amountOwed = adminFee;  // Only admin fee owed to system
                double dasherWalletChange = -amountOwed;     // Negative because it's a debt
                dasher.setWallet(dasher.getWallet() + dasherWalletChange);
                
                System.out.println("COD payment breakdown:");
                System.out.println("- Dasher uses personal money to buy food: ₱" + actualFoodCost);
                System.out.println("- Dasher collected from customer: ₱" + (totalPrice + deliveryFee));
                System.out.println("- Dasher keeps (delivery fee after admin cut): ₱" + dasherDeliveryFee);
                System.out.println("- Dasher owes system (admin fee only): ₱" + amountOwed);
                System.out.println("- Dasher wallet change: ₱" + dasherWalletChange + " (debt to system)");
                System.out.println("- Shop gets paid directly by dasher: ₱" + actualFoodCost);
                System.out.println("- Admin gets: ₱" + adminFee);
                if (previousNoShowFee > 0 || previousNoShowItems > 0) {
                    System.out.println("- Customer also paid previous no-show charges: ₱" + (previousNoShowFee + previousNoShowItems) + " (for original dasher)");
                }
            }

            // Save the updated dasher wallet
            dasherRepository.save(dasher);
            System.out.println("DASHER WALLET AFTER UPDATE AND SAVE: ₱" + dasher.getWallet());
            
            // Verify the save by fetching fresh data
            Optional<DasherEntity> verifyDasher = dasherRepository.findById(dasherId);
            if (verifyDasher.isPresent()) {
                System.out.println("DATABASE VERIFICATION - Dasher wallet in DB: ₱" + verifyDasher.get().getWallet());
            }
        } else {
            throw new CustomException("Dasher not found");
        }

        // Save payment information
        PaymentEntity payment = PaymentEntity.builder()
                .orderId(orderId)
                .dasherId(dasherId)
                .shopId(shopId)
                .userId(userId)
                .paymentMethod(paymentMethod)
                .completedAt(LocalDateTime.now())
                .deliveryFee(deliveryFee)
                .totalPrice(totalPrice)
                .build();
        String stringId = UUID.randomUUID().toString();
        payment.setId(stringId);
        paymentRepository.save(payment);
    }

    // Method to calculate average rating
    private float calculateAverageRating(List<RatingEntity> ratings) {
        if (ratings.isEmpty()) {
            return 0; // Default value if no ratings are found
        }

        float total = 0;
        for (RatingEntity rating : ratings) {
            total += rating.getRate(); // Assuming 'rate' is the field that stores the rating value
        }
        return total / ratings.size();
    }

    // Method to determine the percentage deduction based on average rating
    private float determineFeePercentage(float averageRating) {
        if (averageRating >= 4) {
            return 0.20f; // 20%
        } else if (averageRating >= 3) {
            return 0.30f; // 30%
        } else if (averageRating >= 2) {
            return 0.40f; // 40%
        } else if (averageRating >= 1) {
            return 0.50f; // 50%
        } else {
            return 1.0f; // 100%
        }
    }




    public ResponseEntity<?> createGcashPayment(float amount, String description, String orderId) {
        return createGcashPayment(amount, description, orderId, "mobile"); // Default to mobile
    }
    
    public ResponseEntity<?> createGcashPayment(float amount, String description, String orderId, String platform) {
        try {
            // Guard: ensure Xendit secret is configured
            if (xenditSecret == null || xenditSecret.isEmpty()) {
                System.err.println("\u26a0\ufe0f XENDIT secret is not configured. Set the XENDIT_SECRET_KEY environment variable or application property.");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "XENDIT secret not configured on server"));
            }

            System.out.println("=== Creating Xendit GCash Payment ===");
            System.out.println("Amount: " + amount);
            System.out.println("Description: " + description);
            System.out.println("Order ID: " + orderId);
            System.out.println("Platform: " + platform);
            System.out.println("Xendit Secret Key present: " + (xenditSecret != null && !xenditSecret.isEmpty()));
            
            // Check for active orders
            // Exclude orders that are waiting for no-show confirmation or are dasher no-shows
            // as these are essentially completed/disputed orders, not active deliveries
            List<OrderEntity> existingOrders = orderRepository.findByUid(orderId);
            boolean activeOrderExists = existingOrders.stream()
                    .anyMatch(order -> {
                        String status = order.getStatus();
                        return status.startsWith("active") 
                            && !status.equals("active_waiting_for_no_show_confirmation")
                            && !status.equals("dasher-no-show");
                    });

            if (activeOrderExists) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "An active order already exists for this user"));
            }

            // Prepare Xendit API request for e-wallet charge (GCash)
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();

            // For e-wallets, Xendit expects the amount as-is (not in centavos)
            // The amount should be sent as the actual PHP amount (e.g., 135 for ₱135.00)
            int amountInPHP = (int) amount; // Xendit e-wallets use whole PHP amounts
            
            rootNode.put("reference_id", "order_" + orderId + "_" + System.currentTimeMillis());
            rootNode.put("currency", "PHP");
            rootNode.put("amount", amountInPHP);
            rootNode.put("checkout_method", "ONE_TIME_PAYMENT");
            rootNode.put("channel_code", "PH_GCASH");
            
            ObjectNode channelProperties = rootNode.putObject("channel_properties");
            
            // Use platform-specific redirect URLs
            if ("web".equalsIgnoreCase(platform)) {
                channelProperties.put("success_redirect_url", "https://citu-campuseats.vercel.app/success");
                channelProperties.put("failure_redirect_url", "https://citu-campuseats.vercel.app/failed");
                System.out.println("Using web redirect URLs");
            } else {
                channelProperties.put("success_redirect_url", "campus-eats://payment/success");
                channelProperties.put("failure_redirect_url", "campus-eats://payment/failed");
                System.out.println("Using mobile deep link URLs");
            }

            ObjectNode metadataNode = rootNode.putObject("metadata");
            metadataNode.put("description", description);
            metadataNode.put("order_id", orderId);
            
            System.out.println("Request payload: " + objectMapper.writeValueAsString(rootNode));
            System.out.println("Amount in PHP: ₱" + String.format("%.2f", amount) + " → Sending to Xendit: " + amountInPHP);

            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            System.out.println("Configured callback URL: " + xenditWebhookUrl);
            
            // Only send callback URL header if it's not localhost (for development)
            boolean isLocalhost = xenditWebhookUrl.contains("localhost") || xenditWebhookUrl.contains("127.0.0.1");
            
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.xendit.co/ewallets/charges"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json");
            
            // Add callback URL header only if it's a public URL
            if (!isLocalhost) {
                requestBuilder.header("x-callback-url", xenditWebhookUrl);
                System.out.println("✅ Using callback URL (production): " + xenditWebhookUrl);
            } else {
                System.out.println("⚠️ Skipping callback URL header (localhost detected). Configure webhook in Xendit Dashboard instead.");
            }
            
            HttpRequest request = requestBuilder
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();
            
            System.out.println("Request headers: " + request.headers().map());

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            JsonNode responseBody = objectMapper.readTree(response.body());
            
            System.out.println("Xendit Response Status: " + response.statusCode());
            System.out.println("Xendit Response Body: " + response.body());
            
            // Accept 200, 201, and 202 status codes (202 = Accepted)
            if (response.statusCode() != 200 && response.statusCode() != 201 && response.statusCode() != 202) {
                String errorMessage = responseBody.has("message") ? 
                    responseBody.get("message").asText() : 
                    responseBody.has("error_code") ? 
                    responseBody.get("error_code").asText() : "Unknown error";
                System.err.println("Xendit API Error: " + errorMessage);
                throw new RuntimeException(errorMessage);
            }
            
            System.out.println("✅ Payment created successfully!");

            // Extract checkout URL from Xendit response
            String checkoutUrl = "";
            if (responseBody.has("actions")) {
                JsonNode actionsNode = responseBody.get("actions");
                if (actionsNode.has("mobile_web_checkout_url")) {
                    checkoutUrl = actionsNode.get("mobile_web_checkout_url").asText();
                } else if (actionsNode.has("desktop_web_checkout_url")) {
                    checkoutUrl = actionsNode.get("desktop_web_checkout_url").asText();
                }
            }
            
            String id = responseBody.has("id") ? responseBody.get("id").asText() : "";
            String referenceId = responseBody.has("reference_id") ? responseBody.get("reference_id").asText() : "";
            
            System.out.println("checkoutURL: " + checkoutUrl);
            System.out.println("Charge ID: " + id);
            System.out.println("Reference ID: " + referenceId);

            return ResponseEntity.ok(Map.of("checkout_url", checkoutUrl, "id", id, "reference_number", referenceId));
        } catch (Exception e) {
            System.err.println("=== Error Creating GCash Payment ===");
            e.printStackTrace();
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Unknown error occurred";
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", errorMessage, "details", e.getClass().getSimpleName()));
        }
    }


    public ResponseEntity<?> createTopupGcashPayment(float amount, String description) {
        return createTopupGcashPayment(amount, description, null, "mobile");
    }
    
    public ResponseEntity<?> createTopupGcashPayment(float amount, String description, Map<String, Object> metadata) {
        return createTopupGcashPayment(amount, description, metadata, "mobile");
    }
    
    public ResponseEntity<?> createTopupGcashPayment(float amount, String description, Map<String, Object> metadata, String platform) {
        try {
            // Guard: ensure Xendit secret is configured
            if (xenditSecret == null || xenditSecret.isEmpty()) {
                System.err.println("\u26a0\ufe0f XENDIT secret is not configured. Set the XENDIT_SECRET_KEY environment variable or application property.");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "XENDIT secret not configured on server"));
            }

            System.out.println("=== Creating Xendit GCash Topup Payment ===");
            System.out.println("Platform: " + platform);
            
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();

            rootNode.put("reference_id", "topup_" + System.currentTimeMillis());
            rootNode.put("currency", "PHP");
            rootNode.put("amount", (int) amount); // Xendit e-wallets use whole PHP amounts (not centavos)
            rootNode.put("checkout_method", "ONE_TIME_PAYMENT");
            rootNode.put("channel_code", "PH_GCASH");
            
            ObjectNode channelProperties = rootNode.putObject("channel_properties");
            
            // Use platform-specific redirect URLs
            if ("web".equalsIgnoreCase(platform)) {
                channelProperties.put("success_redirect_url", "https://citu-campuseats.vercel.app/success");
                channelProperties.put("failure_redirect_url", "https://citu-campuseats.vercel.app/failed");
                System.out.println("Using web redirect URLs for topup");
            } else {
                channelProperties.put("success_redirect_url", "campus-eats://payment/success");
                channelProperties.put("failure_redirect_url", "campus-eats://payment/failed");
                System.out.println("Using mobile deep link URLs for topup");
            }
            
            // Add metadata if provided
            ObjectNode metadataNode = rootNode.putObject("metadata");
            metadataNode.put("description", description);
            if (metadata != null && !metadata.isEmpty()) {
                for (Map.Entry<String, Object> entry : metadata.entrySet()) {
                    if (entry.getValue() instanceof String) {
                        metadataNode.put(entry.getKey(), (String) entry.getValue());
                    } else if (entry.getValue() instanceof Number) {
                        metadataNode.put(entry.getKey(), entry.getValue().toString());
                    } else if (entry.getValue() instanceof Boolean) {
                        metadataNode.put(entry.getKey(), (Boolean) entry.getValue());
                    }
                }
            }

            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            // Only send callback URL header if it's not localhost (for development)
            boolean isLocalhost = xenditWebhookUrl.contains("localhost") || xenditWebhookUrl.contains("127.0.0.1");
            
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.xendit.co/ewallets/charges"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json");
            
            // Add callback URL header only if it's a public URL
            if (!isLocalhost) {
                requestBuilder.header("x-callback-url", xenditWebhookUrl);
            }
            
            HttpRequest request = requestBuilder
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            JsonNode responseBody = objectMapper.readTree(response.body());
            
            // Accept 200, 201, and 202 status codes (202 = Accepted)
            if (response.statusCode() != 200 && response.statusCode() != 201 && response.statusCode() != 202) {
                String errorMessage = responseBody.has("message") ? 
                    responseBody.get("message").asText() : "Unknown error";
                throw new RuntimeException(errorMessage);
            }

            String checkoutUrl = responseBody.has("actions") && responseBody.get("actions").has("mobile_web_checkout_url") ?
                responseBody.get("actions").get("mobile_web_checkout_url").asText() : "";
            String id = responseBody.get("id").asText();
            String referenceId = responseBody.get("reference_id").asText();
            
            System.out.println("checkoutURL: " + checkoutUrl);

            return ResponseEntity.ok(Map.of(
                "checkout_url", checkoutUrl, 
                "id", id, 
                "reference_number", referenceId
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public ResponseEntity<?> processRefund(String paymentId, float amount, String reason, String notes) {
        try {
            // Guard: ensure Xendit secret is configured
            if (xenditSecret == null || xenditSecret.isEmpty()) {
                System.err.println("\u26a0\ufe0f XENDIT secret is not configured. Set the XENDIT_SECRET_KEY environment variable or application property.");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "XENDIT secret not configured on server"));
            }

            // Xendit requires the amount to be in cents
            int amountInCents = (int) (amount * 100);
            System.out.println("paymentId: " + paymentId);
            System.out.println("amount: " + amount);
            System.out.println("reason: " + reason);
            System.out.println("notes: " + notes);
            
            // Build the request body for Xendit Refund API
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();

            rootNode.put("amount", amountInCents);
            rootNode.put("reason", reason);
            
            ObjectNode metadataNode = rootNode.putObject("metadata");
            metadataNode.put("notes", notes);

            // Encode the secret key for authorization
            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            // Prepare the HTTP request to Xendit
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.xendit.co/ewallets/charges/" + paymentId + "/refunds"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();

            // Send the request
            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // Check if the response is successful
            if (response.statusCode() == 200 || response.statusCode() == 201) {
                JsonNode responseBody = objectMapper.readTree(response.body());
                String refundId = responseBody.get("id").asText();
                return ResponseEntity.ok(Map.of("refundId", refundId, "message", "Refund processed successfully"));
            } else {
                JsonNode errorResponse = objectMapper.readTree(response.body());
                String errorMessage = errorResponse.has("message") ? 
                    errorResponse.get("message").asText() : "Unknown error";
                return ResponseEntity.status(response.statusCode()).body(Map.of("error", errorMessage));
            }

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public ResponseEntity<?> getPaymentByReference(String referenceNumber) {
        try {
            // Prepare the Xendit API request
            System.out.println("refnum: " + referenceNumber);
            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            // Xendit uses reference_id to query charges
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.xendit.co/ewallets/charges?reference_id=" + referenceNumber))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // Parse the response
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode responseBody = objectMapper.readTree(response.body());

            System.out.println("response: " + responseBody);
            
            // Check if the API returned data successfully
            if (response.statusCode() != 200) {
                String errorMessage = responseBody.has("message") ? 
                    responseBody.get("message").asText() : "Unknown error";
                return ResponseEntity.status(response.statusCode()).body(Map.of("error", errorMessage));
            }

            // Xendit returns an array of charges
            if (responseBody.isArray() && responseBody.size() > 0) {
                String chargeId = responseBody.get(0).get("id").asText();
                return ResponseEntity.ok(Map.of("payment_id", chargeId));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No payment found for the provided reference number"));
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
