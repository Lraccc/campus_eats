package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.LivestreamMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for livestream chat messages
 */
@Repository
public interface LivestreamMessageRepository extends MongoRepository<LivestreamMessage, String> {
    
    /**
     * Find all messages for a specific channel, ordered by timestamp
     */
    List<LivestreamMessage> findByChannelNameOrderByTimestampAsc(String channelName);
    
    /**
     * Delete all messages for a specific channel (cleanup after stream ends)
     */
    void deleteByChannelName(String channelName);
}
