package com.capstone.campuseats.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.capstone.campuseats.Entity.ShopEntity;
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

        // Fetch active dashers
        List<DasherEntity> activeDashers = dasherRepository.findByStatus("active");
        System.out.println("activeDashers: " + activeDashers);
        
        // Set the order status to waiting for dasher
        order.setStatus("active_waiting_for_dasher");
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
        order.setStatus(status);
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
        return orderRepository.findByStatusStartingWith("active_waiting_for_dasher"); // this was admin changed it to
                                                                                      // dasher
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
}
