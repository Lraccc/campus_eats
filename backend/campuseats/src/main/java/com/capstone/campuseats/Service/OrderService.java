package com.capstone.campuseats.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.capstone.campuseats.Controller.NotificationController;
import com.capstone.campuseats.Entity.DasherEntity;
import com.capstone.campuseats.Entity.OrderEntity;
import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.DasherRepository;
import com.capstone.campuseats.Repository.OrderRepository;
import com.capstone.campuseats.Repository.UserRepository;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private DasherRepository dasherRepository;

    @Autowired
    private NotificationController notificationController;

    @Autowired
    private EmailService emailService;

    @Autowired
    private UserRepository userRepository;

    public Optional<OrderEntity> getOrderById(String id) {
        return orderRepository.findById(id);
    }

    public OrderEntity placeOrder(OrderEntity order) {
        List<OrderEntity> existingOrders = orderRepository.findByUid(order.getUid());

        // Check if the user has an active order
        boolean activeOrderExists = existingOrders.stream()
                .anyMatch(existingOrder -> existingOrder.getStatus().startsWith("active"));

        if (activeOrderExists) {
            throw new RuntimeException("An active order already exists for this user");
        }
        
        // Check if the user has any unresolved no-show orders
        List<OrderEntity> noShowOrders = orderRepository.findByUidAndStatus(order.getUid(), "no-show");
        
        // Filter out any that might have been resolved but still have the status
        noShowOrders = noShowOrders.stream()
                .filter(noShowOrder -> !"no-show-resolved".equals(noShowOrder.getStatus()))
                .collect(Collectors.toList());
        float previousNoShowFee = 0.0f;
        
        if (!noShowOrders.isEmpty()) {
            // Get the most recent no-show order
            OrderEntity lastNoShowOrder = noShowOrders.stream()
                    .max(Comparator.comparing(OrderEntity::getCreatedAt))
                    .orElse(null);
            
            if (lastNoShowOrder != null) {
                // Add the delivery fee from the no-show order to the current order
                previousNoShowFee = lastNoShowOrder.getDeliveryFee();
                order.setPreviousNoShowFee(previousNoShowFee);
                
                // Update the total price to include the previous no-show fee
                order.setTotalPrice(order.getTotalPrice() + previousNoShowFee);
                
                System.out.println("Adding previous no-show fee of " + previousNoShowFee + 
                        " to order for user " + order.getUid());
            }
        }

        // Fetch active dashers
        List<DasherEntity> activeDashers = dasherRepository.findByStatus("active");
        System.out.println("activeDashers: " + activeDashers);
        
        // Set the order status to waiting for shop
        // Orders will only be visible to dashers after shop approval
        order.setStatus("active_waiting_for_shop");
        order.setCreatedAt(LocalDateTime.now());

        return orderRepository.save(order);
    }

    public void updateOrderStatus(String orderId, String status) {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);

        if (orderOptional.isEmpty()) {
            throw new RuntimeException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        System.out.println("order: " + order);

        // Handle shop approval flow - when web frontend says "active_shop_confirmed", we change it to active_waiting_for_dasher
        if (status.equals("active_shop_confirmed") && order.getStatus().equals("active_waiting_for_shop")) {
            // Shop is approving the order - change status to active_waiting_for_dasher first
            order.setStatus("active_waiting_for_dasher");
        } else {
            // Handle normal status updates
            order.setStatus(status);
        }
        
        order.setDasherId(order.getDasherId());
        orderRepository.save(order);

        // Constructing the message based on order status
        String notificationMessage;
        switch (status) {
            case "active_toShop":
                notificationMessage = "Dasher is on the way to the shop.";
                break;
            case "active_waiting_for_shop":
                notificationMessage = "Dasher is waiting for the shop to confirm the order.";
                break;
            case "cancelled_by_dasher":
                notificationMessage = "Order has been cancelled by the Dasher.";
                break;
            case "cancelled_by_shop":
                notificationMessage = "Order has been cancelled by the Shop.";
                break;
            case "active_shop_confirmed":
                notificationMessage = "Order has been confirmed by the shop.";
                break;
            case "active_preparing":
                notificationMessage = "Order is being prepared.";
                break;
            case "active_waiting_for_dasher":
                notificationMessage = "Looking for a Dasher to be assigned.";
                break;
            case "no-show":
                notificationMessage = "You did not show up for the delivery.";
                break;
            case "active_onTheWay":
                notificationMessage = "Dasher is on the way to deliver your order.";
                break;
            case "active_delivered":
                notificationMessage = "Order has been delivered.";
                break;
            case "active_pickedUp":
                notificationMessage = "Order has been picked up.";
                break;
            case "active_waiting_for_confirmation":
                notificationMessage = "Order is waiting for confirmation.";
                break;
            case "cancelled_by_customer":
                notificationMessage = "Order has been cancelled.";
                break;
            case "active_waiting_for_cancel_confirmation.":
                notificationMessage = "Order is waiting for cancellation confirmation.";
                break;
            case "completed":
                notificationMessage = "Order has been completed.";
                System.out.println("hello! order: " + order);
                sendOrderReceipt(order);
                
                // Process previous no-show fee when order is completed
                if (order.getPreviousNoShowFee() > 0) {
                    System.out.println("Processing previous no-show fee for user: " + order.getUid());
                    
                    // Get all no-show orders for this user
                    List<OrderEntity> noShowOrders = orderRepository.findByUidAndStatus(order.getUid(), "no-show");
                    
                    if (!noShowOrders.isEmpty()) {
                        // Get the most recent no-show order
                        OrderEntity mostRecentNoShowOrder = noShowOrders.stream()
                                .max(Comparator.comparing(OrderEntity::getCreatedAt))
                                .orElse(null);
                        
                        if (mostRecentNoShowOrder != null && mostRecentNoShowOrder.getDasherId() != null) {
                            // Credit the missed delivery fee to the original dasher's account
                            DasherEntity originalDasher = dasherRepository.findById(mostRecentNoShowOrder.getDasherId()).orElse(null);
                            if (originalDasher != null) {
                                // Add the missed delivery fee to the original dasher's wallet
                                originalDasher.setWallet(originalDasher.getWallet() + order.getPreviousNoShowFee());
                                dasherRepository.save(originalDasher);
                                
                                System.out.println("Credited missed delivery fee of " + order.getPreviousNoShowFee() +
                                        " to original dasher " + originalDasher.getId());
                                
                                // If the current order has a different dasher, make sure they don't get credited for this fee
                                if (order.getDasherId() != null && !order.getDasherId().equals(mostRecentNoShowOrder.getDasherId())) {
                                    // Add a note to the order for accounting purposes
                                    String noteAddition = "\n[System: Previous missed delivery fee of ₱" + 
                                            order.getPreviousNoShowFee() + " credited to original dasher ID: " + 
                                            originalDasher.getId() + "]";
                                            
                                    String currentNote = order.getNote();
                                    order.setNote(currentNote != null ? currentNote + noteAddition : noteAddition);
                                }
                            }
                        }
                        
                        // Mark all no-show orders as resolved
                        for (OrderEntity noShowOrder : noShowOrders) {
                            noShowOrder.setStatus("no-show-resolved");
                            orderRepository.save(noShowOrder);
                            System.out.println("Marked no-show order " + noShowOrder.getId() + " as resolved");
                        }
                    }
                }
                break;
            case "active_waiting_for_shop_cancel_confirmation":
                notificationMessage = "Your order is being cancelled by the shop. Please hold on for confirmation.";
                break;
            default:
                notificationMessage = "Order status updated to " + status + ".";
                break;
        }
        // Send notification when order status is updated
        notificationController.sendNotification(notificationMessage);
    }

    private void sendOrderReceipt(OrderEntity order) {
        UserEntity user = userRepository.findById(order.getUid())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String recipientEmail = user.getEmail();

        if (recipientEmail != null && !recipientEmail.isEmpty()) {
            emailService.sendOrderReceipt(order, recipientEmail);
        } else {
            System.out.println("Recipient email is not available for order ID: " + order.getId());
        }
    }

    public ResponseEntity<Map<String, Object>> assignDasher(String orderId, String dasherId) {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);
        if (orderOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Order not found", "success", false));
        }

        OrderEntity order = orderOptional.get();
        if (order.getDasherId() != null && !order.getDasherId().equals(dasherId)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Order is already assigned to another dasher", "success", false));
        }
        
        // Verify the order has been approved by the shop before allowing assignment
        if (!order.getStatus().equals("active_waiting_for_dasher")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Order must be approved by the shop before assignment", "success", false));
        }

        List<OrderEntity> dasherOrders = orderRepository.findByDasherId(dasherId);
        boolean ongoingOrderExists = dasherOrders.stream()
                .anyMatch(dasherOrder -> dasherOrder.getStatus().startsWith("active"));

        if (ongoingOrderExists) {
            return ResponseEntity.badRequest().body(Map.of("message", "Dasher has an ongoing order", "success", false));
        }

        // Fetch dasher details
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        String dasherName = dasherOptional.map(DasherEntity::getGcashName).orElse("Unknown Dasher");

        order.setDasherId(dasherId);
        order.setStatus("active_toShop");
        orderRepository.save(order);

        // Send notification when a dasher is assigned
        notificationController.sendNotification("Your order has been assigned to " + dasherName + ".");
        return ResponseEntity.ok(Map.of("message", "Dasher assigned successfully", "success", true));
    }

    public List<OrderEntity> getOrdersByUserId(String uid) {
        return orderRepository.findByUid(uid);
    }

    public List<OrderEntity> getActiveOrders() {
        return orderRepository.findByStatusStartingWith("active_waiting_for_dasher");
    }

    public List<OrderEntity> getOrdersByDasherId(String dasherId) {
        return orderRepository.findByDasherId(dasherId);
    }

    public List<OrderEntity> getOrdersWaitingForDasher() {
        // Return only orders with active_waiting_for_dasher status
        // These are orders approved by shops and waiting for dasher assignment
        return orderRepository.findByStatusStartingWith("active_waiting_for_dasher");
    }

    public List<OrderEntity> getActiveOrdersForDasher(String uid) {
        return orderRepository.findByDasherIdAndStatusStartingWith(new String(uid), "active");
    }

    public List<OrderEntity> getNoShowOrdersForDasher(String dasherId) {
        System.out.println("dasherId:" + dasherId);
        return orderRepository.findByDasherIdAndStatus(dasherId, "no-show");
    }

    public List<OrderEntity> getAllOrders() {
        return orderRepository.findAll();
    }

    public ResponseEntity<?> removeDasherFromOrder(String orderId) {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);
        if (orderOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Order not found", "success", false));
        }
        OrderEntity order = orderOptional.get();
        // Set dasherId to null
        order.setDasherId(null);
        // Optionally, update the order status if necessary
        // For example, set the status back to 'active_waiting_for_dasher' if needed
        if (order.getStatus().startsWith("active")) {
            order.setStatus("active_waiting_for_dasher");
        }
        orderRepository.save(order);
        return ResponseEntity.ok(Map.of("message", "Dasher removed successfully", "success", true));
    }

    public List<OrderEntity> getOrdersByStatus(String status) {
        return orderRepository.findByStatus(status);
    }

    public List<OrderEntity> getPastOrders(String status) {
        List<OrderEntity> allOrders = orderRepository.findAll();
        return allOrders.stream()
                .filter(order -> !order.getStatus().startsWith(status))
                .collect(Collectors.toList());
    }

    public List<OrderEntity> getOngoingOrders() {
        return orderRepository.findByStatusStartingWith("active")
                .stream()
                .filter(order -> order.getDasherId() != null && !order.getStatus().equals("active_waiting_for_shop"))
                .collect(Collectors.toList());
    }

    public List<String> getShopIdsSortedByOrderCount() {
        // Get all orders
        List<OrderEntity> orders = orderRepository.findAll();

        // Group orders by shopId and count them
        Map<String, Long> orderCountByShopId = orders.stream()
                .collect(Collectors.groupingBy(OrderEntity::getShopId, Collectors.counting()));

        // Sort the shopIds by the order count in descending order
        return orderCountByShopId.entrySet().stream()
                .sorted((entry1, entry2) -> entry2.getValue().compareTo(entry1.getValue()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    public boolean updateOrderMobileNum(String orderId, String mobileNum) {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);
        if (orderOptional.isPresent()) {
            OrderEntity order = orderOptional.get();
            order.setMobileNum(mobileNum);
            orderRepository.save(order);
            return true;
        }
        return false;
    }
    
    public List<OrderEntity> getOrdersByUidAndStatus(String uid, String status) {
        return orderRepository.findByUidAndStatus(uid, status);
    }

    public boolean deleteOrder(String orderId) {
    try {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);
        if (orderOptional.isPresent()) {
            orderRepository.deleteById(orderId);
            System.out.println("Order with ID " + orderId + " deleted from database");
            return true;
        } else {
            System.out.println("Order with ID " + orderId + " not found in database");
            return false;
        }
    } catch (Exception e) {
        System.err.println("Error deleting order from database: " + e);
        return false;
    }
}
}
