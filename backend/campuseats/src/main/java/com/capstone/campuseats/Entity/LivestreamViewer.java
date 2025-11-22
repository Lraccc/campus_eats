package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Entity representing active viewers in a livestream
 */
@Document(collection = "livestream_viewers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LivestreamViewer {
    
    @Id
    private String id;
    
    private String channelName;  // e.g., "shop_515fb615-37c6-4b21-8037-a91daa8a6a03"
    
    private String userId;       // User ID of viewer
    
    private String username;     // Display name
    
    private LocalDateTime joinedAt;
    
    private LocalDateTime lastHeartbeat; // For timeout detection
    
    // Constructor for new viewer
    public LivestreamViewer(String channelName, String userId, String username) {
        this.channelName = channelName;
        this.userId = userId;
        this.username = username;
        this.joinedAt = LocalDateTime.now();
        this.lastHeartbeat = LocalDateTime.now();
    }
    
    public void updateHeartbeat() {
        this.lastHeartbeat = LocalDateTime.now();
    }
}
