package com.capstone.campuseats.Controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

/**
 * WebRTC Signaling Controller
 * Handles WebRTC signaling messages between broadcasters and viewers
 */
@Controller
public class WebRTCSignalingController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Handle messages from broadcaster to specific viewer
     * Route: /app/webrtc/shop/{shopId}/to-viewer/{viewerId}
     * Sends to: /topic/webrtc/shop/{shopId}/viewer/{viewerId}
     */
    @MessageMapping("/webrtc/shop/{shopId}/to-viewer/{viewerId}")
    public void sendToViewer(
            @DestinationVariable String shopId,
            @DestinationVariable String viewerId,
            Map<String, Object> message) {
        
        System.out.println("📤 Broadcasting message to viewer: " + viewerId + " for shop: " + shopId);
        messagingTemplate.convertAndSend(
            "/topic/webrtc/shop/" + shopId + "/viewer/" + viewerId,
            message
        );
    }

    /**
     * Handle messages from viewer to broadcaster
     * Route: /app/webrtc/shop/{shopId}/to-broadcaster
     * Sends to: /topic/webrtc/shop/{shopId}/broadcaster
     */
    @MessageMapping("/webrtc/shop/{shopId}/to-broadcaster")
    public void sendToBroadcaster(
            @DestinationVariable String shopId,
            Map<String, Object> message) {
        
        System.out.println("📤 Broadcasting message to broadcaster for shop: " + shopId);
        messagingTemplate.convertAndSend(
            "/topic/webrtc/shop/" + shopId + "/broadcaster",
            message
        );
    }

    /**
     * Handle viewer status updates (joined/left)
     * Route: /app/webrtc/shop/{shopId}/viewer-status
     * Sends to: /topic/webrtc/shop/{shopId}/broadcaster
     */
    @MessageMapping("/webrtc/shop/{shopId}/viewer-status")
    public void handleViewerStatus(
            @DestinationVariable String shopId,
            Map<String, Object> message) {
        
        String messageType = (String) message.get("type");
        System.out.println("👤 Viewer status update for shop " + shopId + ": " + messageType);
        
        // Send viewer status to broadcaster
        messagingTemplate.convertAndSend(
            "/topic/webrtc/shop/" + shopId + "/broadcaster",
            message
        );
    }

    /**
     * Handle stream status updates (started/ended)
     * Route: /app/webrtc/shop/{shopId}/stream-status
     * Sends to: /topic/webrtc/shop/{shopId}/broadcast (all participants)
     */
    @MessageMapping("/webrtc/shop/{shopId}/stream-status")
    public void handleStreamStatus(
            @DestinationVariable String shopId,
            Map<String, Object> message) {
        
        String messageType = (String) message.get("type");
        System.out.println("📡 Stream status update for shop " + shopId + ": " + messageType);
        
        // Broadcast stream status to all participants
        messagingTemplate.convertAndSend(
            "/topic/webrtc/shop/" + shopId + "/broadcast",
            message
        );
    }
}
