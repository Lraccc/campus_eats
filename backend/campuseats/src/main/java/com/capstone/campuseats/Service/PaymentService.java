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

    private final RatingRepository ratingRepository;

    @Value("${PAYMONGO_SECRET}")
    private String paymongoSecret;

    public void confirmOrderCompletion(String orderId, String dasherId, String shopId, String userId, String paymentMethod, float deliveryFee, float totalPrice, List<CartItem> items) {
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

        // Determine payment method and update dasher's wallet
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();

            // Fetch ratings for the dasher
            List<RatingEntity> ratings = ratingRepository.findByDasherId(dasherId);
            float averageRating = calculateAverageRating(ratings);

            // Determine the percentage based on average rating
            float feePercentage = determineFeePercentage(averageRating);

            // Adjust delivery fee based on the calculated percentage
            float adjustedDeliveryFee = deliveryFee - (deliveryFee * feePercentage);

            if (paymentMethod.equalsIgnoreCase("gcash")) {
                // Add adjusted delivery fee to dasher's wallet for gcash payments
                dasher.setWallet(dasher.getWallet() + adjustedDeliveryFee);
            } else if (paymentMethod.equalsIgnoreCase("cash")) {
                // Deduct total price + adjusted delivery fee for cash payments (service fee owed)
                double newWalletBalance = dasher.getWallet() - (adjustedDeliveryFee);
                System.out.println(dasher.getWallet() + "-(" + totalPrice + "+" + adjustedDeliveryFee + ") = " + newWalletBalance);
                dasher.setWallet(newWalletBalance);
            }

            // Save the updated dasher wallet
            dasherRepository.save(dasher);
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
        try {

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
            System.out.println("checkoutURL: " +checkoutUrl);
            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText();
                throw new RuntimeException(errorDetail);
            }

            return ResponseEntity.ok(Map.of("checkout_url", checkoutUrl, "id", id));
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
