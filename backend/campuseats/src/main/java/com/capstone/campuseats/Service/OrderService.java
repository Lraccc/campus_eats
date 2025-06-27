package com.capstone.campuseats.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import com.capstone.campuseats.Entity.ReimburseEntity;
import com.capstone.campuseats.Repository.ReimburseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;

import jakarta.annotation.PostConstruct;

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
    
    @Autowired
    private ReimburseService reimburseService;

    @Autowired
    private ReimburseRepository reimburseRepository;
    
    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;

    @PostConstruct
    public void init() {
        blobServiceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
    }

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
        // Search for both formats of no-show status (hyphen and underscore)
        List<OrderEntity> noShowOrdersHyphen = orderRepository.findByUidAndStatus(order.getUid(), "no-show");
        List<OrderEntity> noShowOrdersUnderscore = orderRepository.findByUidAndStatus(order.getUid(), "no_show");
        
        // Combine both lists
        List<OrderEntity> noShowOrders = new ArrayList<>();
        noShowOrders.addAll(noShowOrdersHyphen);
        noShowOrders.addAll(noShowOrdersUnderscore);
        
        // Filter out any that might have been resolved but still have the status
        noShowOrders = noShowOrders.stream()
                .filter(noShowOrder -> !"no-show-resolved".equals(noShowOrder.getStatus()) 
                        && !"no_show_resolved".equals(noShowOrder.getStatus()))
                .collect(Collectors.toList());
        float previousNoShowFee = 0.0f;
        float previousNoShowItems = 0.0f;
        
        if (!noShowOrders.isEmpty()) {
            // Get the most recent no-show order
            OrderEntity lastNoShowOrder = noShowOrders.stream()
                    .max(Comparator.comparing(OrderEntity::getCreatedAt))
                    .orElse(null);
            
            if (lastNoShowOrder != null) {
                // Add the delivery fee from the no-show order to the current order
                previousNoShowFee = lastNoShowOrder.getDeliveryFee();
                order.setPreviousNoShowFee(previousNoShowFee);
                
                // Calculate the total cost of items from the no-show order
                if (lastNoShowOrder.getItems() != null && !lastNoShowOrder.getItems().isEmpty()) {
                    previousNoShowItems = (float) lastNoShowOrder.getItems().stream()
                            .mapToDouble(item -> item.getPrice() * item.getQuantity())
                            .sum();
                    order.setPreviousNoShowItems(previousNoShowItems);
                    
                    System.out.println("Adding previous no-show items cost of " + previousNoShowItems + 
                            " to order for user " + order.getUid());
                }
                
                // Update the total price to include both previous no-show fee and items
                order.setTotalPrice(order.getTotalPrice() + previousNoShowFee + previousNoShowItems);
                
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
                
                // Process previous no-show fee and items when order is completed
                if (order.getPreviousNoShowFee() > 0 || order.getPreviousNoShowItems() > 0) {
                    System.out.println("Processing previous no-show charges for user: " + order.getUid());
                    
                    // Get all no-show orders for this user
                    List<OrderEntity> noShowOrders = orderRepository.findByUidAndStatus(order.getUid(), "no-show");
                    
                    if (!noShowOrders.isEmpty()) {
                        // Get the most recent no-show order
                        OrderEntity mostRecentNoShowOrder = noShowOrders.stream()
                                .max(Comparator.comparing(OrderEntity::getCreatedAt))
                                .orElse(null);
                        
                        if (mostRecentNoShowOrder != null && mostRecentNoShowOrder.getDasherId() != null) {
                            // Credit the missed delivery fee and missed items to the original dasher's account
                            DasherEntity originalDasher = dasherRepository.findById(mostRecentNoShowOrder.getDasherId()).orElse(null);
                            if (originalDasher != null) {
                                // Calculate total amount to credit (both fee and items)
                                float totalCreditAmount = order.getPreviousNoShowFee() + order.getPreviousNoShowItems();
                                
                                // Add both the missed delivery fee and missed items to the original dasher's wallet
                                originalDasher.setWallet(originalDasher.getWallet() + totalCreditAmount);
                                dasherRepository.save(originalDasher);
                                
                                System.out.println("Credited missed delivery fee of " + order.getPreviousNoShowFee() +
                                        " and missed items of " + order.getPreviousNoShowItems() +
                                        " (total: " + totalCreditAmount + ") to original dasher " + originalDasher.getId());
                                
                                // If the current order has a different dasher, make sure they don't get credited for these fees
                                if (order.getDasherId() != null && !order.getDasherId().equals(mostRecentNoShowOrder.getDasherId())) {
                                    // Add a note to the order for accounting purposes
                                    String noteAddition = "\n[System: Previous missed delivery fee of ₱" + 
                                            order.getPreviousNoShowFee() + " and missed items of ₱" +
                                            order.getPreviousNoShowItems() + " (total: ₱" + totalCreditAmount +
                                            ") credited to original dasher ID: " + 
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

    // These fields need to be with the other autowired fields at the top of the class
    
    public void updateOrderStatusWithProof(String orderId, String status, MultipartFile proofImage, MultipartFile locationProofImage) throws IOException {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);

        if (orderOptional.isEmpty()) {
            throw new RuntimeException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        
        // Store the user ID for later reference - we'll need to update their record
        String userId = order.getUid();
        
        // Initialize URLs for proof images
        String noShowProofUrl = null;
        String locationProofUrl = null;

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = LocalDateTime.now().format(formatter);
        
        // Upload no-show proof image
        if (proofImage != null && !proofImage.isEmpty()) {
            String sanitizedFileName = "noShowProof/" + formattedTimestamp + "_" + orderId;
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedFileName);
            
            blobClient.upload(proofImage.getInputStream(), proofImage.getSize(), true);
            noShowProofUrl = blobClient.getBlobUrl();
            order.setNoShowProofImage(noShowProofUrl);
        }
        
        // Upload location proof image
        if (locationProofImage != null && !locationProofImage.isEmpty()) {
            String sanitizedFileName = "locationProof/" + formattedTimestamp + "_" + orderId;
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedFileName);
            
            blobClient.upload(locationProofImage.getInputStream(), locationProofImage.getSize(), true);
            locationProofUrl = blobClient.getBlobUrl();
        }
        
        // Standardize the no-show status format to ensure consistency
        // We'll use no-show format with hyphen as the standard
        String standardizedStatus = status;
        if ("no_show".equals(status)) {
            standardizedStatus = "no-show";
        }

        // Update the order status
        order.setStatus(standardizedStatus);
        orderRepository.save(order);
        
        // Check if we need to create a reimbursement request
        if (("no_show".equals(status) || "no-show".equals(status)) && noShowProofUrl != null) {
            // Check if reimbursement already exists for this order
            Optional<ReimburseEntity> existingReimburse = reimburseRepository.findByOrderId(orderId);
            if (!existingReimburse.isPresent()) {
                // Create a new reimbursement entry
                ReimburseEntity reimburse = new ReimburseEntity();
                reimburse.setId(UUID.randomUUID().toString());
                reimburse.setOrderId(orderId);
                reimburse.setDasherId(order.getDasherId());
                reimburse.setAmount(order.getTotalPrice());
                reimburse.setStatus("pending");
                reimburse.setCreatedAt(LocalDateTime.now());
                
                // Set proof URLs
                reimburse.setNoShowProof(noShowProofUrl);
                if (locationProofUrl != null) {
                    reimburse.setLocationProof(locationProofUrl);
                }
                
                // Save the reimbursement entity
                reimburseRepository.save(reimburse);
                
                // System logging
                System.out.println("Created reimbursement entry for order: " + orderId);
            } else {
                System.out.println("Reimbursement already exists for order: " + orderId);
            }
        }
        
        // Send notification when order status is updated to no-show
        notificationController.sendNotification("You did not show up for the delivery. Proof has been uploaded.");
        
        // If this is a no-show order, record the missed delivery in the user's profile
        if ("no_show".equals(status) || "no-show".equals(status)) {
            System.out.println("Recording no-show for user: " + userId + " on order: " + orderId);
            try {
                // Record offense for the user
                Optional<UserEntity> userOptional = userRepository.findById(userId);
                if (userOptional.isPresent()) {
                    UserEntity user = userOptional.get();
                    int offenseCount = user.getOffenses();
                    user.setOffenses(offenseCount + 1);
                    userRepository.save(user);
                    System.out.println("Updated offense count for user " + userId + " to " + (offenseCount + 1));
                }
            } catch (Exception e) {
                System.err.println("Error updating user offense count: " + e.getMessage());
            }
        }
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
