package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.LivestreamMessage;
import com.capstone.campuseats.Entity.LivestreamViewer;
import com.capstone.campuseats.Repository.LivestreamMessageRepository;
import com.capstone.campuseats.Repository.LivestreamViewerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for managing livestream chat messages and viewer tracking
 */
@Service
public class LivestreamChatService {

    @Autowired
    private LivestreamMessageRepository messageRepository;

    @Autowired
    private LivestreamViewerRepository viewerRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Send a chat message and broadcast to all viewers
     * 
     * @param channelName The livestream channel
     * @param userId User ID of sender
     * @param username Display name of sender
     * @param message Message content
     * @param profilePictureUrl Optional profile picture URL
     * @return Saved message
     */
    public LivestreamMessage sendMessage(String channelName, String userId, String username, 
                                         String message, String profilePictureUrl) {
        // Create and save message
        LivestreamMessage chatMessage = new LivestreamMessage(channelName, userId, username, message);
        chatMessage.setProfilePictureUrl(profilePictureUrl);
        
        LivestreamMessage saved = messageRepository.save(chatMessage);
        
        // Broadcast to all subscribers of this channel
        messagingTemplate.convertAndSend(
            "/topic/livestream/" + channelName + "/chat",
            saved
        );
        
        return saved;
    }

    /**
     * Get all messages for a channel (for when viewer joins mid-stream)
     * 
     * @param channelName The livestream channel
     * @return List of messages
     */
    public List<LivestreamMessage> getChannelMessages(String channelName) {
        return messageRepository.findByChannelNameOrderByTimestampAsc(channelName);
    }

    /**
     * Clear all messages for a channel (when stream ends)
     * 
     * @param channelName The livestream channel
     */
    public void clearChannelMessages(String channelName) {
        messageRepository.deleteByChannelName(channelName);
    }

    /**
     * Add a viewer to the channel
     * 
     * @param channelName The livestream channel
     * @param userId User ID
     * @param username Display name
     */
    public void addViewer(String channelName, String userId, String username) {
        Optional<LivestreamViewer> existing = viewerRepository.findByChannelNameAndUserId(channelName, userId);
        
        LivestreamViewer viewer;
        if (existing.isPresent()) {
            // Update heartbeat if viewer already exists
            viewer = existing.get();
            viewer.updateHeartbeat();
        } else {
            // Create new viewer
            viewer = new LivestreamViewer(channelName, userId, username);
        }
        
        viewerRepository.save(viewer);
        
        // Broadcast updated viewer count
        broadcastViewerCount(channelName);
    }

    /**
     * Remove a viewer from the channel
     * 
     * @param channelName The livestream channel
     * @param userId User ID
     */
    public void removeViewer(String channelName, String userId) {
        viewerRepository.deleteByChannelNameAndUserId(channelName, userId);
        
        // Broadcast updated viewer count
        broadcastViewerCount(channelName);
    }

    /**
     * Update viewer heartbeat (called periodically to show viewer is still active)
     * 
     * @param channelName The livestream channel
     * @param userId User ID
     */
    public void updateViewerHeartbeat(String channelName, String userId) {
        Optional<LivestreamViewer> viewer = viewerRepository.findByChannelNameAndUserId(channelName, userId);
        
        if (viewer.isPresent()) {
            LivestreamViewer v = viewer.get();
            v.updateHeartbeat();
            viewerRepository.save(v);
        }
    }

    /**
     * Get viewer count for a channel
     * 
     * @param channelName The livestream channel
     * @return Number of active viewers
     */
    public long getViewerCount(String channelName) {
        // Clean up stale viewers (no heartbeat for 30 seconds)
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(30);
        viewerRepository.deleteByLastHeartbeatBefore(threshold);
        
        return viewerRepository.countByChannelName(channelName);
    }

    /**
     * Broadcast viewer count update to all subscribers
     * 
     * @param channelName The livestream channel
     */
    private void broadcastViewerCount(String channelName) {
        long count = getViewerCount(channelName);
        
        Map<String, Object> update = new HashMap<>();
        update.put("viewerCount", count);
        update.put("timestamp", LocalDateTime.now().toString());
        
        messagingTemplate.convertAndSend(
            "/topic/livestream/" + channelName + "/viewers",
            update
        );
    }

    /**
     * Clear all viewers for a channel (when stream ends)
     * 
     * @param channelName The livestream channel
     */
    public void clearChannelViewers(String channelName) {
        viewerRepository.deleteByChannelName(channelName);
        broadcastViewerCount(channelName);
    }
}
