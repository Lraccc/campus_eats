package com.capstone.campuseats.Controller;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.capstone.campuseats.Entity.CartItem;
import com.capstone.campuseats.Entity.OrderEntity;
import com.capstone.campuseats.Service.OrderService;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @GetMapping
    public ResponseEntity<List<OrderEntity>> getAllOrders() {
        return new ResponseEntity<List<OrderEntity>>(orderService.getAllOrders(), HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Optional<OrderEntity>> getOrderById(@PathVariable String id) {
        Optional<OrderEntity> order = orderService.getOrderById(id);

        if (order.isPresent()) {
            return new ResponseEntity<>(order, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @GetMapping("/active-lists")
    public ResponseEntity<?> getAllActiveOrders() {
        try {
            List<OrderEntity> activeOrders = orderService.getActiveOrders();

            if (activeOrders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No orders found"));
            }

            return ResponseEntity.ok(activeOrders);
        } catch (Exception e) {
            System.err.println("Error fetching orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }
    public class ReferenceNumberGenerator {
        private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        private static final int LENGTH = 8; // Length of the reference number
        private static final SecureRandom RANDOM = new SecureRandom();

        public static String generateReferenceNumber() {
            StringBuilder sb = new StringBuilder(LENGTH);
            for (int i = 0; i < LENGTH; i++) {
                int index = RANDOM.nextInt(CHARACTERS.length());
                sb.append(CHARACTERS.charAt(index));
            }
            return sb.toString();
        }
    }
    @PostMapping("/place-order")
    public ResponseEntity<?> placeOrder(@RequestBody Map<String, Object> payload) {
        System.out.println("place order received: " + payload);
        try {
            String uid = (String) payload.get("uid");

            // Check for refNum and generate one if it's missing
            String refNum = (String) payload.get("refNum");
            if (refNum == null || refNum.isEmpty()) {
                refNum = ReferenceNumberGenerator.generateReferenceNumber();
                System.out.println("Generated reference number: " + refNum);
            }

            OrderEntity order = OrderEntity.builder()
                    .uid(uid)
                    .id(refNum) // Use the generated or provided refNum
                    .status("active_waiting_for_shop")
                    .createdAt(LocalDateTime.now())
                    .dasherId(null)
                    .shopId((String) payload.get("shopId"))
                    .deliverTo((String) payload.get("deliverTo"))
                    .firstname((String) payload.get("firstname"))
                    .lastname((String) payload.get("lastname"))
                    .items((List<CartItem>) payload.get("items"))
                    .mobileNum((String) payload.get("mobileNum"))
                    .note((String) payload.get("note"))
                    .deliveryFee(Float.parseFloat(payload.getOrDefault("deliveryFee", "0").toString()))
                    .paymentMethod((String) payload.get("paymentMethod"))
                    .totalPrice(Float.parseFloat(payload.get("totalPrice").toString()))
                    .build();

            if (payload.get("changeFor") != null && !((String) payload.get("changeFor")).isEmpty()) {
                order.setChangeFor(Float.parseFloat(payload.get("changeFor").toString()));
            }

            System.out.println("order: " + order.getId());

            OrderEntity placedOrder = orderService.placeOrder(order);

            return new ResponseEntity<>(Map.of("message", "Order placed successfully", "data", placedOrder),
                    HttpStatus.OK);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    @PostMapping("/update-order-status")
    public ResponseEntity<?> updateOrderStatus(@RequestBody Map<String, Object> payload) {
        try {
            String orderIdStr = (String) payload.get("orderId");
            String status = (String) payload.get("status");

            if (orderIdStr == null || orderIdStr.isEmpty() || status == null || status.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "Order ID and status are required"),
                        HttpStatus.BAD_REQUEST);
            }

            String orderId = new String(orderIdStr);
            orderService.updateOrderStatus(orderId, status);

            return new ResponseEntity<>(Map.of("message", "Order status updated successfully"), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    
    @PostMapping(value = "/update-order-status-with-proof", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateOrderStatusWithProof(
            @RequestPart("orderId") String orderId,
            @RequestPart("status") String status,
            @RequestPart("proofImage") MultipartFile proofImage,
            @RequestPart(value = "locationProofImage", required = false) MultipartFile locationProofImage) {
        try {
            // Validate required fields
            if (orderId == null || orderId.isEmpty() || status == null || status.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "Order ID and status are required"),
                        HttpStatus.BAD_REQUEST);
            }

            // No-show proof image is still required
            if (proofImage == null || proofImage.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "No-show proof image is required"),
                        HttpStatus.BAD_REQUEST);
            }
            
            // Log the received data for debugging
            System.out.println("Received order update with proof - OrderID: " + orderId);
            System.out.println("Has location proof: " + (locationProofImage != null && !locationProofImage.isEmpty()));

            // Pass image files to service
            orderService.updateOrderStatusWithProof(orderId, status, proofImage, locationProofImage);

            return new ResponseEntity<>(Map.of(
                "message", "Order status updated successfully with proof images",
                "success", true,
                "orderId", orderId
            ), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/assign-dasher")
    public ResponseEntity<?> assignDasher(@RequestBody Map<String, Object> payload) {
        try {
            String orderIdStr = (String) payload.get("orderId");
            String dasherIdStr = (String) payload.get("dasherId");

            if (orderIdStr == null || orderIdStr.isEmpty() || dasherIdStr == null || dasherIdStr.isEmpty()) {
                return ResponseEntity.badRequest().body("Order ID and Dasher ID are required");
            }

            String orderId = new String(orderIdStr);
            String dasherId = new String(dasherIdStr);

            ResponseEntity<?> response = orderService.assignDasher(orderId, dasherId);
            return response;

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @GetMapping("/user/{uid}")
    public ResponseEntity<?> getOrdersByUserId(@PathVariable String uid) {
        try {
            List<OrderEntity> orders = orderService.getOrdersByUserId(new String(uid));

            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No orders found for this user"));
            }

            List<OrderEntity> activeOrders = orders.stream()
                    .filter(order -> order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            List<OrderEntity> nonActiveOrders = orders.stream()
                    .filter(order -> !order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            Map<String, Object> response = Map.of(
                    "orders", nonActiveOrders,
                    "activeOrders", activeOrders);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error fetching orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/dasher/active-orders/{uid}")
    public ResponseEntity<?> getActiveOrdersForDasher(@PathVariable String uid) {
        try {
            List<OrderEntity> activeOrders = orderService.getActiveOrdersForDasher(uid);

            if (activeOrders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No active orders found for this dasher"));
            }

            return ResponseEntity.ok(activeOrders);
        } catch (Exception e) {
            System.err.println("Error fetching active orders for dasher: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/dasher/all-orders-list/{uid}")
    public ResponseEntity<?> getOrdersForDasher(@PathVariable String uid) {
        try {
            List<OrderEntity> orders = orderService.getOrdersByDasherId(uid);

            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No orders found for this user"));
            }

            List<OrderEntity> activeOrders = orders.stream()
                    .filter(order -> order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            List<OrderEntity> nonActiveOrders = orders.stream()
                    .filter(order -> !order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            Map<String, Object> response = Map.of(
                    "orders", nonActiveOrders,
                    "activeOrders", activeOrders);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error fetching orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/dasher/no-show-orders/{uid}")
    public ResponseEntity<?> getNoShowOrdersForDasher(@PathVariable String uid) {
        try {
            List<OrderEntity> noShowOrders = orderService.getNoShowOrdersForDasher(uid);

            if (noShowOrders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No 'no-show' orders found for this dasher"));
            }

            return ResponseEntity.ok(noShowOrders);
        } catch (Exception e) {
            System.err.println("Error fetching 'no-show' orders for dasher: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/incoming-orders/dasher")
    public ResponseEntity<?> getIncomingOrdersForDasher() {
        try {
            List<OrderEntity> activeOrders = orderService.getOrdersWaitingForDasher();

            if (activeOrders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No orders found"));
            }

            return ResponseEntity.ok(activeOrders);
        } catch (Exception e) {
            System.err.println("Error fetching orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/completed-orders")
    public ResponseEntity<?> getCompletedOrders() {
        try {
            List<OrderEntity> orders = orderService.getAllOrders();

            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No orders found"));
            }

            List<OrderEntity> completedOrders = orders.stream()
                    .filter(order -> !order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            List<OrderEntity> activeOrders = orders.stream()
                    .filter(order -> order.getStatus().startsWith("active"))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("completedOrders", completedOrders, "activeOrders", activeOrders));
        } catch (Exception e) {
            System.err.println("Error fetching completed orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @PostMapping("/remove-dasher")
    public ResponseEntity<?> removeDasherFromOrder(@RequestBody Map<String, Object> payload) {
        try {
            String orderIdStr = (String) payload.get("orderId");
            if (orderIdStr == null || orderIdStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Order ID is required"));
            }
            String orderId = new String(orderIdStr);
            return orderService.removeDasherFromOrder(orderId);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/active-waiting-for-shop")
    public ResponseEntity<?> getActiveWaitingForShopOrders() {
        try {
            List<OrderEntity> orders = orderService.getOrdersByStatus("active_waiting_for_shop");
            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(List.of());
            }
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            System.err.println("Error fetching active waiting for shop orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/past-orders")
    public ResponseEntity<?> getPastOrders() {
        try {
            List<OrderEntity> orders = orderService.getPastOrders("active");

            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(List.of());
            }
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            System.err.println("Error fetching past orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/ongoing-orders")
    public ResponseEntity<?> getOngoingOrders() {
        try {
            List<OrderEntity> orders = orderService.getOngoingOrders();
            if (orders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(List.of());
            }
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            System.err.println("Error fetching ongoing orders: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }


    @PutMapping("/update/{orderId}/mobileNum")
    public ResponseEntity<Boolean> updateOrderMobileNum(@PathVariable String orderId, @RequestParam String mobileNum) {
        boolean isUpdated = orderService.updateOrderMobileNum(orderId, mobileNum);
        if (isUpdated) {
            return new ResponseEntity<>(true, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(false, HttpStatus.NOT_FOUND);
        }
    }

    @GetMapping("/user/no-show-orders/{uid}")
    public ResponseEntity<?> getNoShowOrdersForUser(@PathVariable String uid) {
        try {
            // Get no-show orders
            List<OrderEntity> noShowOrders = orderService.getOrdersByUidAndStatus(uid, "no-show");
            
            // Filter out orders that have been marked as resolved
            List<OrderEntity> activeNoShowOrders = noShowOrders.stream()
                .filter(order -> !"no-show-resolved".equals(order.getStatus()))
                .collect(Collectors.toList());
                
            if (activeNoShowOrders.isEmpty()) {
                return ResponseEntity.status(HttpStatus.OK).body(List.of());
            }
            return ResponseEntity.ok(activeNoShowOrders);
        } catch (Exception e) {
            System.err.println("Error fetching no-show orders for user: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteOrder(@PathVariable String id) {
        System.out.println("DELETE request received for order ID: " + id);
        try {
            boolean deleted = orderService.deleteOrder(id);
            if (deleted) {
                return ResponseEntity.ok(Map.of("message", "Order deleted successfully"));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Order not found"));
            }
        } catch (Exception e) {
            System.err.println("Error deleting order: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete order"));
        }
    }

    @PostMapping("/{id}/delete")
    public ResponseEntity<?> deleteOrderViaPost(@PathVariable String id) {
        System.out.println("POST delete request received for order ID: " + id);
        try {
            boolean deleted = orderService.deleteOrder(id);
            if (deleted) {
                return ResponseEntity.ok(Map.of("message", "Order deleted successfully"));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Order not found"));
            }
        } catch (Exception e) {
            System.err.println("Error deleting order via POST: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete order"));
        }
    }
}
