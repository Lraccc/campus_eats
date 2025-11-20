package com.capstone.campuseats.Controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * LiveStream Chat Controller
 * Handles real-time chat messages during live streams
 */
@Controller
public class LiveStreamChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Handle chat messages sent to a specific shop's live stream
     * Messages are broadcast to all viewers watching that stream
     */
    @MessageMapping("/stream/{shopId}/chat")
    public void handleChatMessage(
            @DestinationVariable String shopId,
            Map<String, Object> message) {
        
        System.out.println("💬 Chat message received for shop " + shopId + ": " + message);
        
        // Add server timestamp if not provided
        if (!message.containsKey("timestamp")) {
            message.put("timestamp", System.currentTimeMillis());
        }
        
        // Explicitly broadcast to all subscribers
        String destination = "/topic/stream/" + shopId + "/chat";
        System.out.println("📢 Broadcasting to: " + destination);
        messagingTemplate.convertAndSend(destination, message);
        System.out.println("✅ Message broadcast complete");
    }
}
