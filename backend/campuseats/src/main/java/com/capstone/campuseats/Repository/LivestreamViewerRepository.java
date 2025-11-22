package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.LivestreamViewer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for livestream viewers
 */
@Repository
public interface LivestreamViewerRepository extends MongoRepository<LivestreamViewer, String> {
    
    /**
     * Find all active viewers for a specific channel
     */
    List<LivestreamViewer> findByChannelName(String channelName);
    
    /**
     * Find a specific viewer in a channel
     */
    Optional<LivestreamViewer> findByChannelNameAndUserId(String channelName, String userId);
    
    /**
     * Delete all viewers for a specific channel (cleanup after stream ends)
     */
    void deleteByChannelName(String channelName);
    
    /**
     * Delete a specific viewer
     */
    void deleteByChannelNameAndUserId(String channelName, String userId);
    
    /**
     * Count active viewers in a channel
     */
    long countByChannelName(String channelName);
    
    /**
     * Delete stale viewers (no heartbeat for 30 seconds)
     */
    void deleteByLastHeartbeatBefore(LocalDateTime threshold);
}
