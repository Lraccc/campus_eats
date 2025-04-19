package com.capstone.campuseats.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.capstone.campuseats.Entity.UserEntity;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {
    private static final Logger logger = Logger.getLogger(JwtService.class.getName());
    
    @Value("${jwt.secret:defaultSecretKey12345678901234567890}")
    private String secretKey;
    
    @Value("${jwt.expiration:86400}") // Default: 24 hours in seconds
    private long expirationTime;
    
    /**
     * Generate JWT token for traditional login
     * 
     * @param user UserEntity
     * @return JWT token
     */
    public String generateToken(UserEntity user) {
        try {
            Instant now = Instant.now();
            Instant expiration = now.plus(expirationTime, ChronoUnit.SECONDS);
            
            // Create claims
            Map<String, Object> claims = new HashMap<>();
            claims.put("sub", user.getId());
            claims.put("username", user.getUsername());
            claims.put("email", user.getEmail());
            claims.put("name", user.getFirstname() + " " + user.getLastname());
            claims.put("jti", UUID.randomUUID().toString());
            
            // Generate JWT
            String token = Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expiration))
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes()), SignatureAlgorithm.HS256)
                .compact();
            
            logger.info("Generated JWT token for user: " + user.getUsername());
            return token;
        } catch (Exception e) {
            logger.severe("Error generating JWT token: " + e.getMessage());
            return null;
        }
    }

    /**
     * Parse and validate claims from a JWT token (HS256)
     * @param token JWT string
     * @return Claims map
     */
    public Map<String, Object> parseClaims(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(Keys.hmacShaKeyFor(secretKey.getBytes()))
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            logger.severe("Invalid JWT token: " + e.getMessage());
            throw new RuntimeException("Invalid JWT token");
        }
    }
}