package com.capstone.campuseats.Controller;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.capstone.campuseats.Service.ShopService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/streams")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class StreamController {

    private final ShopService shopService;

    /**
     * Start a new stream session for a shop
     * @param payload Contains shopId and optional streamType
     * @return Stream session information including streamId
     */
    @PostMapping("/start")
    public ResponseEntity<?> startStream(@RequestBody Map<String, String> payload) {
        String shopId = payload.get("shopId");
        String streamType = payload.getOrDefault("streamType", "phone-camera");
        
        System.out.println("Received request to start stream for shop: " + shopId);
        System.out.println("Stream type: " + streamType);
        
        if (shopId == null || shopId.isEmpty()) {
            return new ResponseEntity<>(
                Map.of("success", false, "message", "Shop ID is required"), 
                HttpStatus.BAD_REQUEST
            );
        }
        
        try {
            // Update streaming status to true
            boolean isUpdated = shopService.updateStreamingStatus(shopId, true);
            
            if (isUpdated) {
                // Generate a unique stream ID for this session
                String streamId = UUID.randomUUID().toString();
                
                System.out.println("Stream started successfully for shop " + shopId + " with streamId: " + streamId);
                
                return new ResponseEntity<>(
                    Map.of(
                        "success", true,
                        "streamId", streamId,
                        "shopId", shopId,
                        "streamType", streamType,
                        "startedAt", LocalDateTime.now().toString(),
                        "message", "Stream started successfully"
                    ),
                    HttpStatus.OK
                );
            } else {
                System.out.println("Shop not found when starting stream: " + shopId);
                return new ResponseEntity<>(
                    Map.of("success", false, "message", "Shop not found"), 
                    HttpStatus.NOT_FOUND
                );
            }
        } catch (Exception e) {
            System.out.println("Error starting stream: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>(
                Map.of("success", false, "message", "Error starting stream: " + e.getMessage()), 
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * End an active stream session
     * @param streamId The ID of the stream session to end
     * @return Success/failure response
     */
    @PostMapping("/{streamId}/end")
    public ResponseEntity<?> endStream(@PathVariable String streamId) {
        System.out.println("Received request to end stream with ID: " + streamId);
        
        // For now, we'll just return success since we don't track individual stream sessions
        // In a production system, you'd want to store stream sessions in a database
        
        try {
            System.out.println("Stream ended successfully: " + streamId);
            
            return new ResponseEntity<>(
                Map.of(
                    "success", true,
                    "streamId", streamId,
                    "endedAt", LocalDateTime.now().toString(),
                    "message", "Stream ended successfully"
                ),
                HttpStatus.OK
            );
        } catch (Exception e) {
            System.out.println("Error ending stream: " + e.getMessage());
            return new ResponseEntity<>(
                Map.of("success", false, "message", "Error ending stream: " + e.getMessage()), 
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get information about a specific stream session
     * @param streamId The ID of the stream session
     * @return Stream session information
     */
    @GetMapping("/{streamId}")
    public ResponseEntity<?> getStreamInfo(@PathVariable String streamId) {
        System.out.println("Received request to get stream info for ID: " + streamId);
        
        // This is a placeholder - in production you'd fetch from database
        return new ResponseEntity<>(
            Map.of(
                "streamId", streamId,
                "status", "active",
                "message", "Stream information retrieved"
            ),
            HttpStatus.OK
        );
    }
}
