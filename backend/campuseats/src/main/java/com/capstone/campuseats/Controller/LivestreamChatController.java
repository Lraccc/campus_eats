package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.LivestreamMessage;
import com.capstone.campuseats.Service.LivestreamChatService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for livestream chat functionality
 * Uses WebSocket for real-time messaging
 */
@Controller
public class LivestreamChatController {

    @Autowired
    private LivestreamChatService chatService;

    /**
     * WebSocket endpoint: Send a chat message
     * 
     * Client sends to: /app/livestream/{channelName}/chat
     * Broadcasts to: /topic/livestream/{channelName}/chat
     */
    @MessageMapping("/livestream/{channelName}/chat")
    @SendTo("/topic/livestream/{channelName}/chat")
    public LivestreamMessage sendMessage(
            @DestinationVariable String channelName,
            ChatMessageRequest request) {
        
        return chatService.sendMessage(
            channelName,
            request.getUserId(),
            request.getUsername(),
            request.getMessage(),
            request.getProfilePictureUrl()
        );
    }

    /**
     * REST endpoint: Get chat history for a channel
     * Used when viewer joins mid-stream
     * 
     * GET /api/livestream/{channelName}/messages
     */
    @GetMapping("/api/livestream/{channelName}/messages")
    @ResponseBody
    public ResponseEntity<List<LivestreamMessage>> getMessages(@PathVariable String channelName) {
        List<LivestreamMessage> messages = chatService.getChannelMessages(channelName);
        return ResponseEntity.ok(messages);
    }

    /**
     * REST endpoint: Clear chat history (called when stream ends)
     * 
     * DELETE /api/livestream/{channelName}/messages
     */
    @DeleteMapping("/api/livestream/{channelName}/messages")
    @ResponseBody
    public ResponseEntity<Void> clearMessages(@PathVariable String channelName) {
        chatService.clearChannelMessages(channelName);
        return ResponseEntity.ok().build();
    }

    /**
     * REST endpoint: Join as viewer (track viewer count)
     * 
     * POST /api/livestream/{channelName}/join
     */
    @PostMapping("/api/livestream/{channelName}/join")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> joinStream(
            @PathVariable String channelName,
            @RequestBody ViewerRequest request) {
        chatService.addViewer(channelName, request.getUserId(), request.getUsername());
        
        Map<String, Object> response = new HashMap<>();
        response.put("viewerCount", chatService.getViewerCount(channelName));
        response.put("success", true);
        
        return ResponseEntity.ok(response);
    }

    /**
     * REST endpoint: Leave stream (update viewer count)
     * 
     * POST /api/livestream/{channelName}/leave
     */
    @PostMapping("/api/livestream/{channelName}/leave")
    @ResponseBody
    public ResponseEntity<Void> leaveStream(
            @PathVariable String channelName,
            @RequestBody ViewerRequest request) {
        chatService.removeViewer(channelName, request.getUserId());
        return ResponseEntity.ok().build();
    }

    /**
     * REST endpoint: Heartbeat to keep viewer active
     * 
     * POST /api/livestream/{channelName}/heartbeat
     */
    @PostMapping("/api/livestream/{channelName}/heartbeat")
    @ResponseBody
    public ResponseEntity<Void> heartbeat(
            @PathVariable String channelName,
            @RequestBody ViewerRequest request) {
        chatService.updateViewerHeartbeat(channelName, request.getUserId());
        return ResponseEntity.ok().build();
    }

    /**
     * REST endpoint: Get current viewer count
     * 
     * GET /api/livestream/{channelName}/viewers/count
     */
    @GetMapping("/api/livestream/{channelName}/viewers/count")
    @ResponseBody
    public ResponseEntity<Map<String, Long>> getViewerCount(@PathVariable String channelName) {
        long count = chatService.getViewerCount(channelName);
        
        Map<String, Long> response = new HashMap<>();
        response.put("viewerCount", count);
        
        return ResponseEntity.ok(response);
    }

    // Request DTOs
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessageRequest {
        private String userId;
        private String username;
        private String message;
        private String profilePictureUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViewerRequest {
        private String userId;
        private String username;
    }
}
