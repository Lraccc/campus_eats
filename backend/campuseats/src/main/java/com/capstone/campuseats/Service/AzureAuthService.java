package com.capstone.campuseats.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.config.CustomException;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Logger;

@Service
public class AzureAuthService {
    private static final Logger logger = Logger.getLogger(AzureAuthService.class.getName());

    @Autowired
    private JwtDecoder jwtDecoder;

    @Autowired
    private UserRepository userRepository;

    /**
     * Validate Azure AD token and return user info
     * 
     * @param token Azure AD token
     * @return User info extracted from token
     * @throws CustomException if token is invalid
     */
    public UserEntity validateAzureToken(String token) throws CustomException {
        try {
            // Remove Bearer prefix if present
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            // Log token info for debugging (first 20 chars only for security)
            logger.info("Validating token: " + (token.length() > 20 ? token.substring(0, 20) + "..." : token));
            
            // Decode and validate the token
            Jwt jwt = jwtDecoder.decode(token);
            
            // Log all claims for debugging
            logger.info("Token claims: " + jwt.getClaims().keySet());
            
            // Debug: Print all claim values for debugging
            jwt.getClaims().forEach((key, value) -> {
                logger.info("Claim: " + key + " = " + value);
            });

            // Try multiple possible claims for user identity
            String email = null;
            String name = null;
            String oid = null;
            String sub = null;
            
            // Try email claim names
            for (String emailClaim : new String[]{"email", "upn", "unique_name", "preferred_username"}) {
                if (jwt.hasClaim(emailClaim)) {
                    email = jwt.getClaimAsString(emailClaim);
                    if (email != null && !email.isEmpty()) {
                        logger.info("Found email in claim: " + emailClaim + " = " + email);
                        break;
                    }
                }
            }
            
            // Try name claim names
            for (String nameClaim : new String[]{"name", "given_name", "family_name"}) {
                if (jwt.hasClaim(nameClaim)) {
                    name = jwt.getClaimAsString(nameClaim);
                    if (name != null && !name.isEmpty()) {
                        logger.info("Found name in claim: " + nameClaim + " = " + name);
                        break;
                    }
                }
            }
            
            // Try object ID claim
            if (jwt.hasClaim("oid")) {
                oid = jwt.getClaimAsString("oid");
                logger.info("Found oid claim: " + oid);
            }
            
            // Always get the subject claim as fallback
            if (jwt.hasClaim("sub")) {
                sub = jwt.getClaimAsString("sub");
                logger.info("Found sub claim: " + sub);
            }

            // Use sub claim if no other identifier is available
            if (email == null && oid == null) {
                if (sub != null) {
                    // Use sub as oid
                    oid = sub;
                    logger.info("Using sub claim as user identifier: " + sub);
                } else {
                    throw new CustomException("Could not find any identifier in token (email, oid, or sub)");
                }
            }

            // Check if user exists in our database
            Optional<UserEntity> existingUser = Optional.empty();
            
            if (email != null) {
                try {
                    existingUser = userRepository.findByEmailIgnoreCase(email);
                    logger.info("Looking up user by email: " + email + " - Found: " + existingUser.isPresent());
                } catch (Exception e) {
                    // Handle non-unique result by using the OID instead
                    logger.warning("Multiple users found with email: " + email + ", error: " + e.getMessage());
                    logger.info("Falling back to OID lookup");
                    
                    if (oid != null) {
                        existingUser = userRepository.findByAzureOid(oid);
                        logger.info("Looking up user by azureOid: " + oid + " - Found: " + existingUser.isPresent());
                        
                        if (existingUser.isEmpty()) {
                            existingUser = userRepository.findByProviderId(oid);
                            logger.info("Looking up user by providerId: " + oid + " - Found: " + existingUser.isPresent());
                        }
                    }
                    
                    // If still no user found, we'll attempt to find all users with the email and use the first one
                    if (existingUser.isEmpty()) {
                        try {
                            logger.info("Attempting to find all users with the email and use the first one");
                            List<UserEntity> users = userRepository.findAllByEmailIgnoreCase(email);
                            if (!users.isEmpty()) {
                                existingUser = Optional.of(users.get(0));
                                logger.info("Using first user from multiple matches: " + existingUser.get().getId());
                            }
                        } catch (Exception ex) {
                            logger.severe("Error finding users by email: " + ex.getMessage());
                        }
                    }
                }
            }
            
            if (existingUser.isEmpty() && oid != null) {
                // Try to find by azureOid first
                existingUser = userRepository.findByAzureOid(oid);
                logger.info("Looking up user by azureOid: " + oid + " - Found: " + existingUser.isPresent());
                
                // If not found, try by providerId (for existing users created before this update)
                if (existingUser.isEmpty()) {
                    existingUser = userRepository.findByProviderId(oid);
                    logger.info("Looking up user by providerId: " + oid + " - Found: " + existingUser.isPresent());
                }
            }

            if (existingUser.isPresent()) {
                // User exists, return the user
                UserEntity user = existingUser.get();
                
                // If user was previously not verified, mark as verified since 
                // we now have a validated token from Azure
                if (!user.isVerified()) {
                    user.setVerified(true);
                    userRepository.save(user);
                }
                
                // Update Azure OID and provider fields if missing
                boolean needsUpdate = false;
                
                if (user.getAzureOid() == null && oid != null) {
                    user.setAzureOid(oid);
                    needsUpdate = true;
                }
                
                if (user.getProvider() == null) {
                    user.setProvider("azure");
                    needsUpdate = true;
                }
                
                if (user.getProviderId() == null && oid != null) {
                    user.setProviderId(oid);
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    userRepository.save(user);
                    logger.info("Updated user with Azure information: " + user.getUsername());
                }
                
                return user;
            } else {
                // User doesn't exist, create a new one
                UserEntity newUser = new UserEntity();
                newUser.setId(UUID.randomUUID().toString());
                
                if (email != null) {
                    newUser.setEmail(email);
                    // Use email as username initially if no username is extracted
                    newUser.setUsername(email.split("@")[0]);
                } else {
                    // Generate random email and username if not available
                    String randomUsername = "user_" + UUID.randomUUID().toString().substring(0, 8);
                    newUser.setUsername(randomUsername);
                    newUser.setEmail(randomUsername + "@unknown.com");
                }
                
                // Split name into first and last name if possible
                if (name != null) {
                    String[] nameParts = name.split(" ", 2);
                    if (nameParts.length > 0) {
                        newUser.setFirstname(nameParts[0]);
                        if (nameParts.length > 1) {
                            newUser.setLastname(nameParts[1]);
                        }
                    }
                }
                
                // Set Azure-specific fields
                newUser.setAzureOid(oid);
                
                // Also set legacy provider fields for compatibility
                newUser.setProvider("azure");
                newUser.setProviderId(oid);
                
                newUser.setAccountType("regular"); // Default account type
                newUser.setVerified(true); // Azure users are auto-verified
                newUser.setDateCreated(new Date());
                newUser.setBanned(false);
                
                logger.info("Creating new user from Azure token: " + newUser.getUsername());
                
                // Save the new user
                return userRepository.save(newUser);
            }
        } catch (Exception e) {
            throw new CustomException("Invalid Azure token: " + e.getMessage());
        }
    }
} 