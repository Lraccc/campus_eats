package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.CartItem;
import com.capstone.campuseats.Service.OrderService;
import com.capstone.campuseats.Service.PaymentService;
import com.capstone.campuseats.config.CustomException;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// test this endpoint in postman then do the last undone na endpoint (about online payment)
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/confirm-order-completion")
    public ResponseEntity<?> confirmOrderCompletion(@RequestBody Map<String, Object> payload) {
        try {
            String orderId = new String((String) payload.get("orderId"));
            String dasherId = new String((String) payload.get("dasherId"));
            String shopId = new String((String) payload.get("shopId"));
            String userId = new String((String) payload.get("userId"));
            String paymentMethod = (String) payload.get("paymentMethod");
            float deliveryFee = Float.parseFloat(payload.get("deliveryFee").toString());
            float totalPrice = Float.parseFloat(payload.get("totalPrice").toString());
            List<Map<String, Object>> itemsPayload = (List<Map<String, Object>>) payload.get("items");

            List<CartItem> items = itemsPayload.stream().map(itemMap ->
                    CartItem.builder()
                            .itemId(new String((String) itemMap.get("itemId")))
                            .name((String) itemMap.get("name"))
                            .unitPrice(Float.parseFloat(itemMap.get("unitPrice").toString()))
                            .price(Float.parseFloat(itemMap.get("price").toString()))
                            .quantity(Integer.parseInt(itemMap.get("quantity").toString()))
                            .itemQuantity(Integer.parseInt(itemMap.get("itemQuantity").toString()))
                            .build()
            ).collect(Collectors.toList());

            // Call the service method with the necessary parameters
            paymentService.confirmOrderCompletion(orderId, dasherId, shopId, userId, paymentMethod, deliveryFee, totalPrice, items);

            return ResponseEntity.ok(Map.of("message", "Order completion confirmed successfully"));
        } catch (CustomException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal Server Error"));
        }
    }

    @PostMapping("/create-gcash-payment")
    public ResponseEntity<?> createGcashPayment(@RequestBody Map<String, Object> payload) {
        try {
            float amount = Float.parseFloat(payload.get("amount").toString());
            String description = payload.get("description").toString();
            String orderId = new String((String) payload.get("orderId"));

            return paymentService.createGcashPayment(amount, description, orderId);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-gcash-payment/topup")
    public ResponseEntity<?> createTopupGcashPayment(@RequestBody Map<String, Object> payload) {
        try {
            float amount = Float.parseFloat(payload.get("amount").toString());
            String description = payload.get("description").toString();

            return paymentService.createTopupGcashPayment(amount, description);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/process-refund")
    public ResponseEntity<?> processRefund(@RequestBody Map<String, Object> payload) {
        try {
            String paymentId = (String) payload.get("paymentId");
            float amount = Float.parseFloat(payload.get("amount").toString()); // Amount in PHP
            String reason = (String) payload.get("reason");
            String notes = (String) payload.get("notes");

            System.out.println("paymentId: "+paymentId);

            System.out.println("amount: "+amount);
            System.out.println("reason: "+reason);
            System.out.println("notes: "+notes);
            // Call the service to process the refund
            return paymentService.processRefund(paymentId, amount, reason, notes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/get-payment-by-reference/{referenceNumber}")
    public ResponseEntity<?> getPaymentByReference(@PathVariable String referenceNumber) {
        return paymentService.getPaymentByReference(referenceNumber);
    }
}
