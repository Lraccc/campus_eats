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

    @Value("${XENDIT_SECRET}")
    private String xenditSecret;

    /**
     * Verifies if a payment charge has been paid by checking its status
     * @param chargeId The Xendit charge ID
     * @return ResponseEntity containing payment status information
     */
    public ResponseEntity<?> verifyPaymentStatus(String chargeId) {
        try {
            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.xendit.co/ewallets/charges/" + chargeId))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode responseBody = objectMapper.readTree(response.body());

            if (response.statusCode() != 200) {
                String errorMessage = responseBody.has("message") ? 
                    responseBody.get("message").asText() : "Unknown error";
                return ResponseEntity.status(response.statusCode())
                        .body(Map.of("error", errorMessage, "paid", false));
            }

            // Extract payment status from the response
            String status = responseBody.get("status").asText();
            String referenceId = responseBody.get("reference_id").asText();
            
            boolean isPaid = "SUCCEEDED".equalsIgnoreCase(status);

            return ResponseEntity.ok(Map.of(
                "paid", isPaid,
                "status", status,
                "charge_id", chargeId,
                "reference_id", referenceId
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "paid", false));
        }
    }

    /**
     * Verifies payment status using reference number
     * @param referenceNumber The Xendit reference number
     * @return ResponseEntity containing payment status information
     */
    public ResponseEntity<?> verifyPaymentByReference(String referenceNumber) {
        try {
            System.out.println("=== Verifying Payment by Reference ===");
            System.out.println("Reference Number: " + referenceNumber);
            
            String auth = Base64.getEncoder().encodeToString((xenditSecret + ":").getBytes());

            // Xendit's e-wallet charge GET endpoint expects charge ID, not reference_id
            // We need to use the charge ID directly if available, or search differently
            // For now, we'll extract the charge ID from the reference if it was stored
            
            // If referenceNumber is actually a charge ID (starts with "ewc_")
            if (referenceNumber.startsWith("ewc_")) {
                System.out.println("Reference is a charge ID, verifying directly");
                return verifyPaymentStatus(referenceNumber);
            }
            
            // Otherwise, we can't query by reference_id in e-wallets API
            // The app should store and use the charge ID instead
            System.err.println("Cannot verify payment: reference_id query not supported for e-wallets");
            System.err.println("Please use the charge ID (starts with 'ewc_') instead");
            
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                        "error", "Please provide the Xendit charge ID (ewc_...) instead of reference number",
                        "paid", false,
                        "hint", "The charge ID is returned in the 'id' field when creating a payment"
                    ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "paid", false));
        }
    }
}