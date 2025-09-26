package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.OrderEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class WebSocketNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketNotificationService.class);
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Send order status update to specific order subscribers
     */
    public void sendOrderUpdate(OrderEntity order) {
        try {
            Map<String, Object> orderUpdate = new HashMap<>();
            orderUpdate.put("orderId", order.getId());
            orderUpdate.put("status", order.getStatus());
            orderUpdate.put("dasherId", order.getDasherId());
            orderUpdate.put("timestamp", System.currentTimeMillis());
            
            String destination = "/topic/orders/" + order.getId();
            
            logger.info("Sending order update to {}: {}", destination, orderUpdate);
            messagingTemplate.convertAndSend(destination, orderUpdate);
            
        } catch (Exception e) {
            logger.error("Error sending order update via WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Send dasher information update for a specific order
     */
    public void sendDasherUpdate(String orderId, String dasherId, String dasherName, String dasherPhone) {
        try {
            Map<String, Object> dasherUpdate = new HashMap<>();
            dasherUpdate.put("orderId", orderId);
            dasherUpdate.put("dasherId", dasherId);
            dasherUpdate.put("name", dasherName);
            dasherUpdate.put("phone", dasherPhone);
            dasherUpdate.put("timestamp", System.currentTimeMillis());
            
            String destination = "/topic/orders/" + orderId + "/dasher";
            
            logger.info("Sending dasher update to {}: {}", destination, dasherUpdate);
            messagingTemplate.convertAndSend(destination, dasherUpdate);
            
        } catch (Exception e) {
            logger.error("Error sending dasher update via WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Send general notification to all connected clients
     */
    public void sendGlobalNotification(String message) {
        try {
            Map<String, Object> notification = new HashMap<>();
            notification.put("message", message);
            notification.put("timestamp", System.currentTimeMillis());
            
            logger.info("Sending global notification: {}", message);
            messagingTemplate.convertAndSend("/topic/notifications", notification);
            
        } catch (Exception e) {
            logger.error("Error sending global notification via WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Send notification to specific user
     */
    public void sendUserNotification(String userId, String message) {
        try {
            Map<String, Object> notification = new HashMap<>();
            notification.put("message", message);
            notification.put("userId", userId);
            notification.put("timestamp", System.currentTimeMillis());
            
            String destination = "/topic/users/" + userId;
            
            logger.info("Sending user notification to {}: {}", destination, message);
            messagingTemplate.convertAndSend(destination, notification);
            
        } catch (Exception e) {
            logger.error("Error sending user notification via WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Send new order notification to all active dashers
     */
    public void sendNewOrderToDashers(OrderEntity order) {
        try {
            Map<String, Object> orderNotification = new HashMap<>();
            orderNotification.put("orderId", order.getId());
            orderNotification.put("status", order.getStatus());
            orderNotification.put("shopId", order.getShopId());
            orderNotification.put("totalPrice", order.getTotalPrice());
            orderNotification.put("deliveryFee", order.getDeliveryFee());
            orderNotification.put("paymentMethod", order.getPaymentMethod());
            orderNotification.put("deliverTo", order.getDeliverTo());
            orderNotification.put("timestamp", System.currentTimeMillis());
            
            // Send to general dashers topic - all active dashers will receive this
            String destination = "/topic/dashers/new-orders";
            
            logger.info("Sending new order notification to all dashers at {}: Order {} is now available", destination, order.getId());
            messagingTemplate.convertAndSend(destination, orderNotification);
            
        } catch (Exception e) {
            logger.error("Error sending new order notification to dashers via WebSocket: {}", e.getMessage(), e);
        }
    }

    /**
     * Send new order notification to a specific dasher
     */
    public void sendNewOrderToSpecificDasher(String dasherId, OrderEntity order) {
        try {
            Map<String, Object> orderNotification = new HashMap<>();
            orderNotification.put("orderId", order.getId());
            orderNotification.put("status", order.getStatus());
            orderNotification.put("shopId", order.getShopId());
            orderNotification.put("totalPrice", order.getTotalPrice());
            orderNotification.put("deliveryFee", order.getDeliveryFee());
            orderNotification.put("paymentMethod", order.getPaymentMethod());
            orderNotification.put("deliverTo", order.getDeliverTo());
            orderNotification.put("timestamp", System.currentTimeMillis());
            
            String destination = "/topic/dasher/" + dasherId + "/new-orders";
            
            logger.info("Sending new order notification to specific dasher {} at {}: Order {}", dasherId, destination, order.getId());
            messagingTemplate.convertAndSend(destination, orderNotification);
            
        } catch (Exception e) {
            logger.error("Error sending new order notification to specific dasher via WebSocket: {}", e.getMessage(), e);
        }
    }
}