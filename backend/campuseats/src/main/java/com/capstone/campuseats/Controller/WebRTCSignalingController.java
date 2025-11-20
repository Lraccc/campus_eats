package com.capstone.campuseats.Controller;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;

/**
 * WebRTC Signaling Controller
 * Handles WebRTC signaling messages (offer, answer, ICE candidates) between broadcaster and viewers
 */
@RestController
@RequestMapping("/api/webrtc")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class WebRTCSignalingController {

    private final SimpMessagingTemplate messagingTemplate;
    
    // Store active stream sessions: shopId -> { offer, streamId, etc. }
    private final Map<String, Map<String, Object>> activeStreams = new ConcurrentHashMap<>();

    /**
     * Broadcaster sends their WebRTC offer to start streaming
     * This will be stored and sent to viewers when they join
     */
    @PostMapping("/offer")
    public ResponseEntity<?> handleOffer(@RequestBody Map<String, Object> payload) {
        String shopId = (String) payload.get("shopId");
        String streamId = (String) payload.get("streamId");
        Map<String, Object> offer = (Map<String, Object>) payload.get("offer");
        
        System.out.println("📡 Received WebRTC offer from shop: " + shopId);
        
        if (shopId == null || offer == null) {
            return new ResponseEntity<>(
                Map.of("success", false, "message", "shopId and offer are required"),
                HttpStatus.BAD_REQUEST
            );
        }
        
        // Store the offer for this shop
        Map<String, Object> streamData = new ConcurrentHashMap<>();
        streamData.put("offer", offer);
        streamData.put("streamId", streamId);
        streamData.put("shopId", shopId);
        activeStreams.put(shopId, streamData);
        
        // Broadcast to all viewers that a new stream is available
        messagingTemplate.convertAndSend("/topic/webrtc/" + shopId + "/offer", payload);
        
        System.out.println("✅ Stored and broadcast WebRTC offer for shop: " + shopId);
        
        return new ResponseEntity<>(
            Map.of("success", true, "message", "Offer received and broadcast"),
            HttpStatus.OK
        );
    }

    /**
     * Viewer sends their WebRTC answer back to the broadcaster
     */
    @PostMapping("/answer")
    public ResponseEntity<?> handleAnswer(@RequestBody Map<String, Object> payload) {
        String shopId = (String) payload.get("shopId");
        String viewerId = (String) payload.get("viewerId");
        Map<String, Object> answer = (Map<String, Object>) payload.get("answer");
        
        System.out.println("📡 Received WebRTC answer from viewer: " + viewerId + " for shop: " + shopId);
        
        if (shopId == null || answer == null) {
            return new ResponseEntity<>(
                Map.of("success", false, "message", "shopId and answer are required"),
                HttpStatus.BAD_REQUEST
            );
        }
        
        // Send answer to the broadcaster
        messagingTemplate.convertAndSend("/topic/webrtc/" + shopId + "/answer", payload);
        
        System.out.println("✅ Forwarded WebRTC answer to broadcaster for shop: " + shopId);
        
        return new ResponseEntity<>(
            Map.of("success", true, "message", "Answer forwarded to broadcaster"),
            HttpStatus.OK
        );
    }

    /**
     * Handle ICE candidates from broadcaster
     */
    @PostMapping("/ice-candidate/broadcaster")
    public ResponseEntity<?> handleBroadcasterIceCandidate(@RequestBody Map<String, Object> payload) {
        String shopId = (String) payload.get("shopId");
        Map<String, Object> candidate = (Map<String, Object>) payload.get("candidate");
        
        System.out.println("🧊 Received ICE candidate from broadcaster for shop: " + shopId);
        
        if (shopId == null || candidate == null) {
            return new ResponseEntity<>(
                Map.of("success", false, "message", "shopId and candidate are required"),
                HttpStatus.BAD_REQUEST
            );
        }
        
        // Broadcast to all viewers
        messagingTemplate.convertAndSend("/topic/webrtc/" + shopId + "/ice-broadcaster", payload);
        
        return new ResponseEntity<>(
            Map.of("success", true, "message", "ICE candidate broadcast to viewers"),
            HttpStatus.OK
        );
    }

    /**
     * Handle ICE candidates from viewers
     */
    @PostMapping("/ice-candidate/viewer")
    public ResponseEntity<?> handleViewerIceCandidate(@RequestBody Map<String, Object> payload) {
        String shopId = (String) payload.get("shopId");
        String viewerId = (String) payload.get("viewerId");
        Map<String, Object> candidate = (Map<String, Object>) payload.get("candidate");
        
        System.out.println("🧊 Received ICE candidate from viewer: " + viewerId + " for shop: " + shopId);
        
        if (shopId == null || candidate == null) {
            return new ResponseEntity<>(
                Map.of("success", false, "message", "shopId and candidate are required"),
                HttpStatus.BAD_REQUEST
            );
        }
        
        // Send to broadcaster
        messagingTemplate.convertAndSend("/topic/webrtc/" + shopId + "/ice-viewer", payload);
        
        return new ResponseEntity<>(
            Map.of("success", true, "message", "ICE candidate forwarded to broadcaster"),
            HttpStatus.OK
        );
    }

    /**
     * Get the current WebRTC offer for a shop (for viewers joining)
     */
    @GetMapping("/offer/{shopId}")
    public ResponseEntity<?> getOffer(@PathVariable String shopId) {
        System.out.println("🔍 Viewer requesting WebRTC offer for shop: " + shopId);
        
        Map<String, Object> streamData = activeStreams.get(shopId);
        
        if (streamData != null && streamData.containsKey("offer")) {
            System.out.println("✅ Returning stored offer for shop: " + shopId);
            return new ResponseEntity<>(
                Map.of(
                    "success", true,
                    "offer", streamData.get("offer"),
                    "streamId", streamData.get("streamId")
                ),
                HttpStatus.OK
            );
        } else {
            System.out.println("❌ No active stream found for shop: " + shopId);
            return new ResponseEntity<>(
                Map.of("success", false, "message", "No active stream for this shop"),
                HttpStatus.NOT_FOUND
            );
        }
    }

    /**
     * Remove stream offer when broadcaster ends stream
     */
    @DeleteMapping("/offer/{shopId}")
    public ResponseEntity<?> removeOffer(@PathVariable String shopId) {
        System.out.println("🗑️ Removing WebRTC offer for shop: " + shopId);
        
        activeStreams.remove(shopId);
        
        // Notify all viewers that stream ended
        messagingTemplate.convertAndSend("/topic/webrtc/" + shopId + "/end", 
            Map.of("shopId", shopId, "message", "Stream ended"));
        
        return new ResponseEntity<>(
            Map.of("success", true, "message", "Stream offer removed"),
            HttpStatus.OK
        );
    }
}
