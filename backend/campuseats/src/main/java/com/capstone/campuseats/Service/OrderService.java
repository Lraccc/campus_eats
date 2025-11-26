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
import com.capstone.campuseats.Service.WebSocketNotificationService;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private DasherRepository dasherRepository;

    @Autowired
    private NotificationController notificationController;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

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
        // Exclude orders that are waiting for no-show confirmation or are dasher no-shows
        // as these are essentially completed/disputed orders, not active deliveries
        boolean activeOrderExists = existingOrders.stream()
                .anyMatch(existingOrder -> {
                    String status = existingOrder.getStatus();
                    return status.startsWith("active") 
                        && !status.equals("active_waiting_for_no_show_confirmation")
                        && !status.equals("dasher-no-show");
                });

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

        // Capture the previous status before updating
        String previousStatus = order.getStatus();

        // Handle shop approval flow - when web frontend says "active_shop_confirmed", we change it to active_waiting_for_dasher
        if (status.equals("active_shop_confirmed") && order.getStatus().equals("active_waiting_for_shop")) {
            // Shop is approving the order - change status to active_waiting_for_dasher first
            order.setStatus("active_waiting_for_dasher");
        } else {
            // Handle normal status updates
            order.setStatus(status);
        }
        
        order.setDasherId(order.getDasherId());
        OrderEntity savedOrder = orderRepository.save(order);
        
        // Send WebSocket notification for order update
        webSocketNotificationService.sendOrderUpdate(savedOrder);
        
        // If order is now waiting for dasher, notify all active dashers about new available order
        if (savedOrder.getStatus().equals("active_waiting_for_dasher")) {
            webSocketNotificationService.sendNewOrderToDashers(savedOrder);
        }

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
                
                // Check if the order was already confirmed by the shop before customer cancellation
                // and send notification to the shop owner
                if (previousStatus != null && 
                    (previousStatus.equals("active_shop_confirmed") || 
                     previousStatus.equals("active_waiting_for_dasher") ||
                     previousStatus.equals("active_preparing") ||
                     previousStatus.startsWith("active_"))) {
                    
                    // Send notification to the shop owner (shopId is the shop owner's userId)
                    String shopOwnerId = order.getShopId();
                    if (shopOwnerId != null) {
                        String shopNotificationMessage = "A customer has cancelled order #" + order.getId() + 
                                " that was already confirmed. Please check your orders.";
                        webSocketNotificationService.sendUserNotification(shopOwnerId, shopNotificationMessage);
                        System.out.println("Sent cancellation notification to shop owner: " + shopOwnerId + 
                                " for order: " + order.getId());
                    }
                }
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
        
        // Allow dasher assignment for orders in various active states
        // This supports shops preparing orders proactively before dasher assignment
        String currentStatus = order.getStatus();
        boolean isValidForAssignment = currentStatus.equals("active_waiting_for_dasher") ||
                                      currentStatus.equals("active_shop_confirmed") ||
                                      currentStatus.equals("active_preparing") ||
                                      currentStatus.equals("active_ready_for_pickup");
        
        if (!isValidForAssignment) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Order status '" + currentStatus + "' is not valid for dasher assignment", "success", false));
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
        
        // Only update status if shop hasn't already progressed the order
        // If shop already preparing or ready, keep their status
        if (currentStatus.equals("active_preparing") || currentStatus.equals("active_ready_for_pickup")) {
            // Keep shop's status - they've already progressed
            System.out.println("✅ Keeping shop's status: " + currentStatus + " for order: " + orderId);
        } else {
            // Normal flow - set to toShop
            order.setStatus("active_toShop");
            System.out.println("✅ Setting status to active_toShop for order: " + orderId);
        }
        
        OrderEntity savedOrder = orderRepository.save(order);

        // Send WebSocket notifications for order and dasher updates
        webSocketNotificationService.sendOrderUpdate(savedOrder);
        
        // Send dasher information to the order subscribers
        Optional<UserEntity> dasherUserOptional = userRepository.findById(dasherId);
        String dasherPhoneNumber = dasherUserOptional.map(UserEntity::getPhone).orElse("");
        String dasherFullName = dasherUserOptional.map(user -> 
            (user.getFirstname() != null ? user.getFirstname() : "") + " " + 
            (user.getLastname() != null ? user.getLastname() : "")).orElse(dasherName);
        
        webSocketNotificationService.sendDasherUpdate(orderId, dasherId, dasherFullName.trim(), dasherPhoneNumber);

        // Send notification when a dasher is assigned (fallback)
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
        // Return ALL active orders without a dasher assigned, regardless of status
        // This allows shops to prepare orders proactively before dasher assignment
        // Filter by: status starts with "active" AND dasherId is null
        // EXCLUDE orders still waiting for shop approval (active_waiting_for_shop)
        List<OrderEntity> allActiveOrders = orderRepository.findByStatusStartingWith("active");
        
        // Filter to only include orders without a dasher assigned
        // AND exclude orders waiting for shop approval
        return allActiveOrders.stream()
                .filter(order -> {
                    boolean hasNoDasher = order.getDasherId() == null || order.getDasherId().isEmpty();
                    boolean notWaitingForShop = !order.getStatus().equals("active_waiting_for_shop");
                    return hasNoDasher && notWaitingForShop;
                })
                .collect(Collectors.toList());
    }

    public List<OrderEntity> getActiveOrdersForDasher(String uid) {
        List<OrderEntity> activeOrders = orderRepository.findByDasherIdAndStatusStartingWith(new String(uid), "active");
        // Filter out orders waiting for no-show confirmation as these are under admin review
        return activeOrders.stream()
                .filter(order -> !order.getStatus().equals("active_waiting_for_no_show_confirmation"))
                .collect(Collectors.toList());
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

    public void reportCustomerNoShow(String orderId, MultipartFile proofImage, MultipartFile gcashQr) throws IOException {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);

        if (orderOptional.isEmpty()) {
            throw new RuntimeException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        
        // Store the dasher ID for later reference
        String dasherId = order.getDasherId();
        
        if (dasherId == null || dasherId.isEmpty()) {
            throw new RuntimeException("No dasher assigned to this order");
        }
        
        // Initialize URLs for proof images
        String customerNoShowProofUrl = null;
        String customerGcashQrUrl = null;

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = LocalDateTime.now().format(formatter);
        
        // Upload customer no-show proof image
        if (proofImage != null && !proofImage.isEmpty()) {
            String sanitizedFileName = "customerNoShowProof/" + formattedTimestamp + "_" + orderId;
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedFileName);
            
            blobClient.upload(proofImage.getInputStream(), proofImage.getSize(), true);
            customerNoShowProofUrl = blobClient.getBlobUrl();
            order.setCustomerNoShowProofImage(customerNoShowProofUrl);
            System.out.println("✅ Customer no-show proof uploaded successfully: " + customerNoShowProofUrl);
        } else {
            System.out.println("⚠️ No customer proof image received or it's empty");
        }
        
        // Upload customer GCash QR code
        if (gcashQr != null && !gcashQr.isEmpty()) {
            String sanitizedGcashFileName = "customerGcashQr/" + formattedTimestamp + "_" + orderId;
            BlobClient gcashBlobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedGcashFileName);
            
            gcashBlobClient.upload(gcashQr.getInputStream(), gcashQr.getSize(), true);
            customerGcashQrUrl = gcashBlobClient.getBlobUrl();
            order.setCustomerNoShowGcashQr(customerGcashQrUrl);
            System.out.println("✅ Customer GCash QR uploaded successfully: " + customerGcashQrUrl);
        } else {
            System.out.println("⚠️ No GCash QR image received or it's empty");
        }

        // Log the final order state before saving
        System.out.println("📝 Order before save - customerNoShowProofImage: " + order.getCustomerNoShowProofImage());
        System.out.println("📝 Order before save - customerNoShowGcashQr: " + order.getCustomerNoShowGcashQr());

        // Update the order status to waiting for no-show confirmation (pending admin review)
        order.setStatus("active_waiting_for_no_show_confirmation");
        
        // Keep the dasherId in the order for admin tracking purposes
        // The dasher is released through status update below, not by removing dasherId
        OrderEntity savedOrder = orderRepository.save(order);
        
        // Verify the order was saved correctly
        System.out.println("💾 Order after save - customerNoShowProofImage: " + savedOrder.getCustomerNoShowProofImage());
        System.out.println("💾 Order after save - customerNoShowGcashQr: " + savedOrder.getCustomerNoShowGcashQr());
        
        // Update dasher status back to 'active' so they can accept new orders
        try {
            Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
            if (dasherOptional.isPresent()) {
                DasherEntity dasher = dasherOptional.get();
                
                // Only update status if they were in 'ongoing order' state
                if ("ongoing order".equals(dasher.getStatus())) {
                    dasher.setStatus("active");
                    dasherRepository.save(dasher);
                    System.out.println("Dasher status updated to 'active' after customer no-show report: " + dasherId);
                }
                
                // Notify the dasher about the customer's report
                String notificationMessage = "A customer has reported that you did not deliver their order #" + 
                    orderId.substring(0, Math.min(8, orderId.length())) + 
                    ". Please provide your proof of delivery. This report is under review.";
                
                webSocketNotificationService.sendUserNotification(dasherId, notificationMessage);
                System.out.println("Notification sent to dasher: " + dasherId);
            }
        } catch (Exception e) {
            System.err.println("Failed to notify dasher or update status: " + e.getMessage());
        }
        
        // Check if reimbursement already exists for this order
        Optional<ReimburseEntity> existingReimburse = reimburseRepository.findByOrderId(orderId);
        if (!existingReimburse.isPresent()) {
            // Create a new reimbursement entry for the customer
            ReimburseEntity reimburse = new ReimburseEntity();
            reimburse.setId(UUID.randomUUID().toString());
            reimburse.setOrderId(orderId);
            reimburse.setDasherId(dasherId);
            reimburse.setUserId(order.getUid()); // Set the customer's user ID
            reimburse.setAmount(order.getTotalPrice());
            reimburse.setStatus("pending");
            reimburse.setCreatedAt(LocalDateTime.now());
            reimburse.setType("customer-report"); // Mark as customer-reported no-show
            
            // Set proof URLs
            if (customerNoShowProofUrl != null) {
                reimburse.setNoShowProof(customerNoShowProofUrl);
            }
            if (customerGcashQrUrl != null) {
                reimburse.setGcashQr(customerGcashQrUrl);
            }
            
            // Save the reimbursement entity
            reimburseRepository.save(reimburse);
            
            System.out.println("Created reimbursement entry for customer-reported no-show on order: " + orderId);
        } else {
            System.out.println("Reimbursement already exists for order: " + orderId);
        }
        
        // Record offense for the dasher
        try {
            Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
            if (dasherOptional.isPresent()) {
                DasherEntity dasher = dasherOptional.get();
                // Assuming DasherEntity has an offenses field (you may need to add this)
                System.out.println("Recording no-show offense for dasher: " + dasherId);
                // Note: If DasherEntity doesn't have an offenses field, you may need to add it
                // dasher.setOffenses(dasher.getOffenses() + 1);
                // dasherRepository.save(dasher);
            }
        } catch (Exception e) {
            System.err.println("Error updating dasher offense count: " + e.getMessage());
        }
        
        // Send notification to customer
        notificationController.sendNotification("Your no-show report has been submitted. Our team will review it shortly.");
    }
    
    public void uploadDeliveryProof(String orderId, MultipartFile proofImage) throws IOException {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);

        if (orderOptional.isEmpty()) {
            throw new RuntimeException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        
        // Initialize URL for proof image
        String deliveryProofUrl = null;

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = LocalDateTime.now().format(formatter);
        
        // Upload delivery proof image
        if (proofImage != null && !proofImage.isEmpty()) {
            String sanitizedFileName = "deliveryProof/" + formattedTimestamp + "_" + orderId;
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedFileName);
            
            blobClient.upload(proofImage.getInputStream(), proofImage.getSize(), true);
            deliveryProofUrl = blobClient.getBlobUrl();
            order.setDeliveryProofImage(deliveryProofUrl);
            
            // Save the order with the delivery proof
            orderRepository.save(order);
            
            System.out.println("Uploaded delivery proof for order: " + orderId);
        } else {
            throw new RuntimeException("Proof image is required");
        }
    }
    
    // Method for dasher to submit counter-evidence (proof of delivery) when customer reports no-show
    public void submitDasherCounterProof(String orderId, String dasherId, MultipartFile counterProofImage) throws IOException {
        Optional<OrderEntity> orderOptional = orderRepository.findById(orderId);

        if (orderOptional.isEmpty()) {
            throw new RuntimeException("Order not found");
        }

        OrderEntity order = orderOptional.get();
        
        // Verify this is the assigned dasher
        if (!dasherId.equals(order.getDasherId())) {
            throw new RuntimeException("You are not authorized to submit proof for this order");
        }
        
        // Verify order is in disputed state
        if (!"active_waiting_for_no_show_confirmation".equals(order.getStatus())) {
            throw new RuntimeException("This order is not under dispute review");
        }
        
        // Upload dasher's counter-proof
        if (counterProofImage != null && !counterProofImage.isEmpty()) {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = LocalDateTime.now().format(formatter);
            
            String sanitizedFileName = "dasherCounterProof/" + formattedTimestamp + "_" + orderId;
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedFileName);
            
            blobClient.upload(counterProofImage.getInputStream(), counterProofImage.getSize(), true);
            String counterProofUrl = blobClient.getBlobUrl();
            
            // If delivery proof already exists, keep it; otherwise set it
            if (order.getDeliveryProofImage() == null || order.getDeliveryProofImage().isEmpty()) {
                order.setDeliveryProofImage(counterProofUrl);
            }
            orderRepository.save(order);
            
            System.out.println("Dasher counter-proof uploaded for order: " + orderId);
            
            // Notify customer that dasher has responded
            try {
                String customerId = order.getUid();
                String notificationMessage = "The dasher has submitted proof of delivery for your no-show report on order #" + 
                    orderId.substring(0, Math.min(8, orderId.length())) + 
                    ". Our team is reviewing both submissions.";
                
                webSocketNotificationService.sendUserNotification(customerId, notificationMessage);
            } catch (Exception e) {
                System.err.println("Failed to send notification to customer: " + e.getMessage());
            }
        } else {
            throw new RuntimeException("Counter-proof image is required");
        }
    }
}
