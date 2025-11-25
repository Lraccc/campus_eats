package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Service.AgoraService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for Agora RTC token generation
 * Handles secure token generation for livestream authentication
 */
@RestController
@RequestMapping("/api/agora")
@CrossOrigin(origins = "*")
public class AgoraController {

    @Autowired
    private AgoraService agoraService;

    /**
     * Generate Agora RTC token for broadcaster (shop starting livestream)
     * 
     * POST /api/agora/token/broadcaster
     * Request body: { "channelName": "shop_<shopId>", "uid": 0 }
     * Response: { "token": "...", "channelName": "...", "uid": 0, "expiresIn": 86400 }
     */
    @PostMapping("/token/broadcaster")
    public ResponseEntity<?> generateBroadcasterToken(@RequestBody TokenRequest request) {
        try {
            String token = agoraService.generateBroadcasterToken(
                request.getChannelName(), 
                request.getUid() != null ? request.getUid() : 0
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("channelName", request.getChannelName());
            response.put("uid", request.getUid() != null ? request.getUid() : 0);
            response.put("expiresIn", 86400); // 24 hours in seconds
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate token");
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    /**
     * Generate Agora RTC token for viewer (customer watching livestream)
     * 
     * POST /api/agora/token/viewer
     * Request body: { "channelName": "shop_<shopId>", "uid": 0 }
     * Response: { "token": "...", "channelName": "...", "uid": 0, "expiresIn": 86400 }
     */
    @PostMapping("/token/viewer")
    public ResponseEntity<?> generateViewerToken(@RequestBody TokenRequest request) {
        try {
            String token = agoraService.generateViewerToken(
                request.getChannelName(), 
                request.getUid() != null ? request.getUid() : 0
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("channelName", request.getChannelName());
            response.put("uid", request.getUid() != null ? request.getUid() : 0);
            response.put("expiresIn", 86400);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate token");
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    /**
     * Simplified endpoint - auto-detects role based on request type
     * 
     * POST /api/agora/token
     * Request body: { "channelName": "shop_<shopId>", "isBroadcaster": true }
     * Response: { "token": "...", "channelName": "...", "expiresIn": 86400 }
     */
    @PostMapping("/token")
    public ResponseEntity<?> generateToken(@RequestBody SimpleTokenRequest request) {
        try {
            String token = agoraService.generateToken(
                request.getChannelName(), 
                request.isBroadcaster()
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("channelName", request.getChannelName());
            response.put("role", request.isBroadcaster() ? "broadcaster" : "viewer");
            response.put("expiresIn", 86400);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate token");
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // Request DTOs
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class TokenRequest {
        private String channelName;
        private Integer uid;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class SimpleTokenRequest {
        private String channelName;
        private boolean isBroadcaster;
    }
}
