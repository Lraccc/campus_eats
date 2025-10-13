package com.capstone.campuseats.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.Map;

@Service
public class PaymentVerificationService {

    @Value("${PAYMONGO_SECRET}")
    private String paymongoSecret;

    /**
     * Verifies if a payment link has been paid by checking its status
     * @param linkId The PayMongo link ID
     * @return ResponseEntity containing payment status information
     */
    public ResponseEntity<?> verifyPaymentStatus(String linkId) {
        try {
            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/links/" + linkId))
                    .header("accept", "application/json")
                    .header("authorization", "Basic " + auth)
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode responseBody = objectMapper.readTree(response.body());

            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText("Unknown error");
                return ResponseEntity.status(response.statusCode())
                        .body(Map.of("error", errorDetail, "paid", false));
            }

            // Extract payment status from the response
            String status = responseBody.at("/data/attributes/status").asText();
            JsonNode paymentsArray = responseBody.at("/data/attributes/payments");
            
            boolean isPaid = "paid".equalsIgnoreCase(status);
            String paymentId = null;
            
            // If there are payments, get the first payment ID
            if (paymentsArray.isArray() && paymentsArray.size() > 0) {
                paymentId = paymentsArray.get(0).at("/data/id").asText();
            }

            return ResponseEntity.ok(Map.of(
                "paid", isPaid,
                "status", status,
                "payment_id", paymentId != null ? paymentId : "",
                "link_id", linkId
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "paid", false));
        }
    }

    /**
     * Verifies payment status using reference number
     * @param referenceNumber The PayMongo reference number
     * @return ResponseEntity containing payment status information
     */
    public ResponseEntity<?> verifyPaymentByReference(String referenceNumber) {
        try {
            String auth = Base64.getEncoder().encodeToString((paymongoSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.paymongo.com/v1/links?reference_number=" + referenceNumber))
                    .header("accept", "application/json")
                    .header("authorization", "Basic " + auth)
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode responseBody = objectMapper.readTree(response.body());

            if (response.statusCode() != 200) {
                String errorDetail = responseBody.at("/errors/0/detail").asText("Unknown error");
                return ResponseEntity.status(response.statusCode())
                        .body(Map.of("error", errorDetail, "paid", false));
            }

            // Check if we have data
            JsonNode dataArray = responseBody.at("/data");
            if (!dataArray.isArray() || dataArray.size() == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No payment link found for the provided reference number", "paid", false));
            }

            // Get the first (and should be only) link
            JsonNode linkData = dataArray.get(0);
            String status = linkData.at("/attributes/status").asText();
            String linkId = linkData.at("/id").asText();
            JsonNode paymentsArray = linkData.at("/attributes/payments");
            
            boolean isPaid = "paid".equalsIgnoreCase(status);
            String paymentId = null;
            
            // If there are payments, get the first payment ID
            if (paymentsArray.isArray() && paymentsArray.size() > 0) {
                paymentId = paymentsArray.get(0).at("/data/id").asText();
            }

            return ResponseEntity.ok(Map.of(
                "paid", isPaid,
                "status", status,
                "payment_id", paymentId != null ? paymentId : "",
                "link_id", linkId,
                "reference_number", referenceNumber
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "paid", false));
        }
    }
}