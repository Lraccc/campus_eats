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

    @Value("${PAYMONGO_SECRET}")
    private String paymongoSecret;

    public void confirmOrderCompletion(String orderId, String dasherId, String shopId, String userId, String paymentMethod, float deliveryFee, float totalPrice, List<CartItem> items) {
        System.out.println("=== PAYMENT SERVICE DEBUG ===");
        System.out.println("Order ID: " + orderId);
        System.out.println("Dasher ID: " + dasherId);
        System.out.println("Shop ID: " + shopId);
        System.out.println("Payment Method: " + paymentMethod);
        System.out.println("Delivery Fee: ₱" + deliveryFee);
        System.out.println("Total Price (Food Cost): ₱" + totalPrice);
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

        // Update shop wallet first (shop always gets the food cost)
        Optional<ShopEntity> shopOptional = shopRepository.findById(shopId);
        if (shopOptional.isPresent()) {
            ShopEntity shop = shopOptional.get();
            // Shop receives the full order amount (food cost)
            shop.setWallet(shop.getWallet() + totalPrice);
            shopRepository.save(shop);
            System.out.println("Shop wallet updated: +" + totalPrice + " = " + shop.getWallet());
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
            System.out.println("- Shop food cost: ₱" + totalPrice);

            if (paymentMethod.equalsIgnoreCase("gcash")) {
                // For GCash payments: 
                // Customer paid electronically, so dasher just receives their delivery fee portion
                dasher.setWallet(dasher.getWallet() + dasherDeliveryFee);
                System.out.println("GCash payment: Dasher receives ₱" + dasherDeliveryFee + " delivery fee");
                
            } else if (paymentMethod.equalsIgnoreCase("cash")) {
                // For Cash on Delivery:
                // 1. Dasher collected full amount (totalPrice + deliveryFee) from customer
                // 2. Dasher keeps their delivery fee portion (dasherDeliveryFee)
                // 3. Dasher owes the system: totalPrice (food cost) + adminFee
                // 4. Dasher's wallet shows NEGATIVE balance (debt to system)
                // 5. When dasher tops up later, the debt is cleared
                
                double amountOwed = totalPrice + adminFee;  // Food cost + admin fee owed to system
                double dasherWalletChange = -amountOwed;     // Negative because it's a debt
                dasher.setWallet(dasher.getWallet() + dasherWalletChange);
                
                System.out.println("COD payment breakdown:");
                System.out.println("- Dasher collected from customer: ₱" + (totalPrice + deliveryFee));
                System.out.println("- Dasher keeps (delivery fee): ₱" + dasherDeliveryFee);
                System.out.println("- Dasher owes system (food + admin): ₱" + amountOwed);
                System.out.println("- Dasher wallet change: ₱" + dasherWalletChange + " (debt to system)");
                System.out.println("- Shop gets: ₱" + totalPrice);
                System.out.println("- Admin gets: ₱" + adminFee);
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
        try {
            // Check for active orders
            List<OrderEntity> existingOrders = orderRepository.findByUid(orderId);
            boolean activeOrderExists = existingOrders.stream()
                    .anyMatch(order -> order.getStatus().startsWith("active"));

            if (activeOrderExists) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "An active order already exists for this user"));
            }

            // Prepare PayMongo API request
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();
            ObjectNode dataNode = rootNode.putObject("data");
            ObjectNode attributesNode = dataNode.putObject("attributes");

            attributesNode.put("amount", (int) (amount * 100));
            attributesNode.put("currency", "PHP");
            attributesNode.put("description", description);
            attributesNode.put("type", "gcash");

            ObjectNode redirectNode = attributesNode.putObject("redirect");
            redirectNode.put("success", "https://citu-campuseats.vercel.app/success");
            redirectNode.put("failed", "https://citu-campuseats.vercel.app/failed");

            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/links"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            JsonNode responseBody = objectMapper.readTree(response.body());
            String checkoutUrl = responseBody.at("/data/attributes/checkout_url").asText();
            String id = responseBody.at("/data/id").asText();
            String referenceNumber = responseBody.at("/data/attributes/reference_number").asText();
            System.out.println("checkoutURL: " +checkoutUrl);
            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText();
                throw new RuntimeException(errorDetail);
            }

            return ResponseEntity.ok(Map.of("checkout_url", checkoutUrl, "id", id,"reference_number",referenceNumber));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    public ResponseEntity<?> createTopupGcashPayment(float amount, String description) {
        return createTopupGcashPayment(amount, description, null);
    }
    
    public ResponseEntity<?> createTopupGcashPayment(float amount, String description, Map<String, Object> metadata) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();
            ObjectNode dataNode = rootNode.putObject("data");
            ObjectNode attributesNode = dataNode.putObject("attributes");

            attributesNode.put("amount", (int) (amount * 100));
            attributesNode.put("currency", "PHP");
            attributesNode.put("description", description);
            attributesNode.put("type", "gcash");
            
            // Add metadata if provided
            if (metadata != null && !metadata.isEmpty()) {
                ObjectNode metadataNode = attributesNode.putObject("metadata");
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

            // For production payments
            ObjectNode redirectNode = attributesNode.putObject("redirect");
            redirectNode.put("success", "https://citu-campuseats.vercel.app/success");
            redirectNode.put("failed", "https://citu-campuseats.vercel.app/failed");
            
            // For mobile app deep linking
            redirectNode.put("success_mobile", "campus-eats://payment/success");
            redirectNode.put("failed_mobile", "campus-eats://payment/failed");

            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/links"))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            JsonNode responseBody = objectMapper.readTree(response.body());
            String checkoutUrl = responseBody.at("/data/attributes/checkout_url").asText();
            String id = responseBody.at("/data/id").asText();
            String referenceNumber = responseBody.at("/data/attributes/reference_number").asText();
            
            System.out.println("checkoutURL: " + checkoutUrl);
            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText();
                throw new RuntimeException(errorDetail);
            }

            return ResponseEntity.ok(Map.of(
                "checkout_url", checkoutUrl, 
                "id", id, 
                "reference_number", referenceNumber
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public ResponseEntity<?> processRefund(String paymentId, float amount, String reason, String notes) {
        try {
            // PayMongo requires the amount to be in cents
            int amountInCents = (int) (amount * 100);
            System.out.println("paymentId: "+paymentId);

            System.out.println("amount: "+amount);
            System.out.println("reason: "+reason);
            System.out.println("notes: "+notes);
            // Build the request body for PayMongo Refund API
            ObjectMapper objectMapper = new ObjectMapper();
            ObjectNode rootNode = objectMapper.createObjectNode();
            ObjectNode dataNode = rootNode.putObject("data");
            ObjectNode attributesNode = dataNode.putObject("attributes");

            attributesNode.put("amount", amountInCents);
            attributesNode.put("payment_id", paymentId);
            attributesNode.put("reason", reason);
            attributesNode.put("notes", notes);

            // Encode the secret key for authorization
            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            // Prepare the HTTP request to PayMongo
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/refunds"))
                    .header("accept", "application/json")
                    .header("content-type", "application/json")
                    .header("authorization", "Basic " + auth)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(rootNode)))
                    .build();

            // Send the request
            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // Check if the response is successful
            if (response.statusCode() == 200) {
                JsonNode responseBody = objectMapper.readTree(response.body());
                String refundId = responseBody.at("/data/id").asText();
                return ResponseEntity.ok(Map.of("refundId", refundId, "message", "Refund processed successfully"));
            } else {
                JsonNode errorResponse = objectMapper.readTree(response.body());
                String errorDetail = errorResponse.at("/errors/0/detail").asText();
                return ResponseEntity.status(response.statusCode()).body(Map.of("error", errorDetail));
            }

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public ResponseEntity<?> getPaymentByReference(String referenceNumber) {
        try {
            // Prepare the PayMongo API request
            System.out.println("refnum: "+referenceNumber);
            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/links?reference_number=" + referenceNumber))
                    .header("accept", "application/json")
                    .header("authorization", "Basic " + auth)
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // Parse the response
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode responseBody = objectMapper.readTree(response.body());

            System.out.println("response: "+responseBody);
            // Check if the API returned data successfully
            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText();
                return ResponseEntity.status(response.statusCode()).body(Map.of("error", errorDetail));
            }

            // Extract the payment ID
            JsonNode paymentsData = responseBody.at("/data/0/attributes/payments");
            if (paymentsData.isArray() && paymentsData.size() > 0) {
                String paymentId = paymentsData.get(0).at("/data/id").asText();
                return ResponseEntity.ok(Map.of("payment_id", paymentId));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No payment found for the provided reference number"));
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
