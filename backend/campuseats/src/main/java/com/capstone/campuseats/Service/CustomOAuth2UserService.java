package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository; // Assuming this exists
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor // Lombok annotation for constructor injection
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository; // Inject your user repository
    private static final Logger logger = LoggerFactory.getLogger(CustomOAuth2UserService.class);

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);
        Map<String, Object> attributes = oAuth2User.getAttributes();

        // Extract necessary attributes from the token (adjust claim names if needed for Azure AD v2.0)
        String providerId = oAuth2User.getName(); // Often 'sub' or 'oid' claim, getName() might work
        String email = (String) attributes.get("email");
        // Preferred username might be available
        String username = (String) attributes.get("preferred_username"); 
        String firstName = (String) attributes.get("given_name");
        String lastName = (String) attributes.get("family_name");

        // You might need to explicitly check the 'oid' claim for Azure AD
        if (attributes.containsKey("oid")) {
             providerId = (String) attributes.get("oid");
        }

        logger.info("Processing OAuth2 user. ProviderId (oid/sub): {}, Email: {}", providerId, email);

        if (providerId == null || email == null) {
            logger.error("Missing providerId or email from OAuth2 attributes: {}", attributes);
            // Handle error appropriately - maybe throw specific exception
            // For now, re-throwing original exception might suffice if attributes are missing
             throw new OAuth2AuthenticationException("OAuth2 provider returned insufficient user information.");
        }


        // Try to find user by provider ID
        Optional<UserEntity> userOptional = userRepository.findByProviderAndProviderId("azure", providerId);

        UserEntity user;
        if (userOptional.isPresent()) {
            logger.info("Found existing Azure user: {}", email);
            user = userOptional.get();
            // Optionally update attributes like name if they changed
            user.setFirstname(firstName);
            user.setLastname(lastName);
             user.setUsername(username != null ? username : email); // Update username maybe
            // No need to set isVerified, should already be true
        } else {
             logger.info("Azure user not found by providerId, checking by email: {}", email);
            // Optional: Check if user exists with the same email but different provider (e.g., local)
             Optional<UserEntity> localUserOptional = userRepository.findByEmailAndProvider(email, "local");
             if (localUserOptional.isPresent()) {
                 // Handle account linking or conflict - depends on policy
                 // For now, let's log and prevent login via OAuth if local account exists
                 logger.warn("User with email {} already exists as a local account. OAuth login prevented.", email);
                 // Throwing exception prevents login via OAuth for existing local email
                  throw new OAuth2AuthenticationException("An account with this email already exists using a different login method.");
             }

            // If no user found by providerId or conflicting local email, create a new one
            logger.info("Creating new Azure user: {}", email);
            user = UserEntity.builder()
                    .provider("azure")
                    .providerId(providerId)
                    .email(email)
                    .username(username != null ? username : email.split("@")[0]) // Use preferred_username or derive from email
                    .firstname(firstName)
                    .lastname(lastName)
                    .isVerified(true) // Mark as verified immediately for OAuth users
                    .password(null) // No password for OAuth users
                    .dateCreated(new Date())
                    // Set default account type for Azure AD users
                    .accountType("Regular") // Explicitly set role
                    .offenses(0)
                    .isBanned(false)
                    .build();
        }

        userRepository.save(user); // Save new or updated user
        logger.info("Saved user ({}): {}", user.getProvider(), user.getEmail());

        // Return the original OAuth2User, Spring Security will handle the rest based on the user details
        // Alternatively, you could create a custom Principal object wrapping your UserEntity
        return oAuth2User;
    }
} 