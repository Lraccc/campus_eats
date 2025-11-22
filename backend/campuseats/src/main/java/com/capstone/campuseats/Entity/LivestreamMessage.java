package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Entity representing a chat message in a livestream
 */
@Document(collection = "livestream_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LivestreamMessage {
    
    @Id
    private String id;
    
    private String channelName;  // e.g., "shop_515fb615-37c6-4b21-8037-a91daa8a6a03"
    
    private String userId;       // User who sent the message
    
    private String username;     // Display name
    
    private String message;      // Message content
    
    private LocalDateTime timestamp;
    
    private String profilePictureUrl; // Optional: user profile picture
    
    // Constructor for new messages
    public LivestreamMessage(String channelName, String userId, String username, String message) {
        this.channelName = channelName;
        this.userId = userId;
        this.username = username;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }
}
