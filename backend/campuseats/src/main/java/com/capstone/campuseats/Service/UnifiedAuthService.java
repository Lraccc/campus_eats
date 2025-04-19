package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.config.CustomException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class UnifiedAuthService {
    @Autowired
    private AzureAuthService azureAuthService;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserRepository userRepository;

    public UserEntity validateToken(String token) throws CustomException {
        if (token == null || token.isEmpty()) {
            throw new CustomException("No token provided");
        }
        String rawToken = token.startsWith("Bearer ") ? token.substring(7) : token;
        try {
            String[] parts = rawToken.split("\\.");
            if (parts.length != 3) throw new Exception("Invalid JWT format");
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]));
            Map<String, Object> header = new ObjectMapper().readValue(headerJson, Map.class);
            String alg = (String) header.get("alg");
            // Optionally, parse payload for 'iss' if you want to distinguish further
            if ("RS256".equals(alg)) {
                // Azure token
                return azureAuthService.validateAzureToken(token);
            } else if ("HS256".equals(alg)) {
                // Internal token
                Map<String, Object> claims = jwtService.parseClaims(rawToken); // implement parseClaims if needed
                String userId = (String) claims.get("sub");
                return userRepository.findById(userId).orElseThrow(() -> new CustomException("User not found from token"));
            } else {
                throw new CustomException("Unsupported JWT algorithm: " + alg);
            }
        } catch (CustomException ce) {
            throw ce;
        } catch (Exception e) {
            throw new CustomException("Token parse/validation error: " + e.getMessage());
        }
    }
}
