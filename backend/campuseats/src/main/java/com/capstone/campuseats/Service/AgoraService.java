package com.capstone.campuseats.Service;

import io.agora.media.RtcTokenBuilder2;
import io.agora.media.RtcTokenBuilder2.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Service for generating Agora RTC tokens for secure livestream authentication
 */
@Service
public class AgoraService {

    @Value("${agora.app.id}")
    private String appId;

    @Value("${agora.app.certificate}")
    private String appCertificate;

    // Token expiration time (24 hours in seconds)
    private static final int TOKEN_EXPIRATION_TIME = 86400;

    // Privilege expiration time (24 hours in seconds)
    private static final int PRIVILEGE_EXPIRATION_TIME = 86400;

    /**
     * Generate RTC token for broadcaster (shop owner starting livestream)
     * 
     * @param channelName The channel name (e.g., "shop_<shopId>")
     * @param uid User ID (0 for auto-assignment)
     * @return Agora RTC token
     */
    public String generateBroadcasterToken(String channelName, int uid) {
        try {
            int timestamp = (int) (System.currentTimeMillis() / 1000 + TOKEN_EXPIRATION_TIME);
            
            RtcTokenBuilder2 tokenBuilder = new RtcTokenBuilder2();
            String token = tokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                channelName,
                uid,
                Role.ROLE_PUBLISHER, // Broadcaster can publish audio/video
                timestamp,
                timestamp
            );
            
            return token;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate broadcaster token: " + e.getMessage(), e);
        }
    }

    /**
     * Generate RTC token for viewer (customer watching livestream)
     * 
     * @param channelName The channel name (e.g., "shop_<shopId>")
     * @param uid User ID (0 for auto-assignment)
     * @return Agora RTC token
     */
    public String generateViewerToken(String channelName, int uid) {
        try {
            int timestamp = (int) (System.currentTimeMillis() / 1000 + TOKEN_EXPIRATION_TIME);
            
            RtcTokenBuilder2 tokenBuilder = new RtcTokenBuilder2();
            String token = tokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                channelName,
                uid,
                Role.ROLE_SUBSCRIBER, // Viewer can only subscribe (watch)
                timestamp,
                timestamp
            );
            
            return token;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate viewer token: " + e.getMessage(), e);
        }
    }

    /**
     * Generate RTC token with auto-assigned UID
     * 
     * @param channelName The channel name
     * @param isBroadcaster Whether the user is a broadcaster (true) or viewer (false)
     * @return Agora RTC token
     */
    public String generateToken(String channelName, boolean isBroadcaster) {
        return isBroadcaster ? 
            generateBroadcasterToken(channelName, 0) : 
            generateViewerToken(channelName, 0);
    }
}
