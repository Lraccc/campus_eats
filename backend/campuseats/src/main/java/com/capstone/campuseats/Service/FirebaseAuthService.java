package com.capstone.campuseats.Service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.config.CustomException;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Logger;

@Service
public class FirebaseAuthService {
    private static final Logger logger = Logger.getLogger(FirebaseAuthService.class.getName());

    @Value("${firebase.service-account.path:}")
    private String serviceAccountPath;

    private final UserRepository userRepository;

    public FirebaseAuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Initialize Firebase Admin SDK on application startup
     */
    @PostConstruct
    public void initializeFirebase() {
        try {
            // Check if Firebase is already initialized
            if (FirebaseApp.getApps().isEmpty()) {
                logger.info("🔥 Initializing Firebase Admin SDK...");

                // Load service account credentials
                FileInputStream serviceAccount;
                
                if (serviceAccountPath != null && !serviceAccountPath.isEmpty()) {
                    logger.info("Loading Firebase service account from: " + serviceAccountPath);
                    serviceAccount = new FileInputStream(serviceAccountPath);
                } else {
                    // Try to load from environment variable
                    String envPath = System.getenv("FIREBASE_SERVICE_ACCOUNT_PATH");
                    if (envPath != null && !envPath.isEmpty()) {
                        logger.info("Loading Firebase service account from environment variable");
                        serviceAccount = new FileInputStream(envPath);
                    } else {
                        logger.warning("⚠️ Firebase service account path not configured. Firebase authentication will not work.");
                        logger.warning("Set firebase.service-account.path in application.properties or FIREBASE_SERVICE_ACCOUNT_PATH environment variable");
                        return;
                    }
                }

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                FirebaseApp.initializeApp(options);
                logger.info("✅ Firebase Admin SDK initialized successfully");
            } else {
                logger.info("✅ Firebase Admin SDK already initialized");
            }
        } catch (IOException e) {
            logger.severe("❌ Failed to initialize Firebase Admin SDK: " + e.getMessage());
            logger.severe("Firebase authentication will not work. Please check service account configuration.");
        }
    }

    /**
     * Validate Firebase ID token and return user info
     * 
     * @param idToken Firebase ID token from client
     * @return UserEntity from database or newly created user
     * @throws CustomException if token is invalid or user is banned
     */
    public UserEntity validateFirebaseToken(String idToken) throws CustomException {
        try {
            // Remove Bearer prefix if present
            if (idToken.startsWith("Bearer ")) {
                idToken = idToken.substring(7);
            }

            logger.info("🔍 Validating Firebase ID token...");

            // Verify the Firebase ID token
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            logger.info("✅ Firebase token verified successfully");

            // Extract user information from token
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();
            String name = decodedToken.getName();
            String providerId = getProviderId(decodedToken);

            logger.info("Firebase user info - UID: " + uid + ", Email: " + email + ", Provider: " + providerId);

            // Check if user exists in database
            Optional<UserEntity> existingUser = Optional.empty();

            // Try to find user by email first
            if (email != null && !email.isEmpty()) {
                try {
                    existingUser = userRepository.findByEmailIgnoreCase(email);
                    logger.info("Lookup by email '" + email + "': " + (existingUser.isPresent() ? "Found" : "Not found"));
                } catch (Exception e) {
                    logger.warning("Multiple users found with email: " + email + ", will try by Firebase UID");
                }
            }

            // Try to find by Firebase UID
            if (existingUser.isEmpty()) {
                existingUser = userRepository.findByFirebaseUid(uid);
                logger.info("Lookup by Firebase UID '" + uid + "': " + (existingUser.isPresent() ? "Found" : "Not found"));
            }

            // Try to find by provider ID (for backward compatibility)
            if (existingUser.isEmpty() && providerId != null) {
                existingUser = userRepository.findByProviderId(uid);
                logger.info("Lookup by provider ID '" + uid + "': " + (existingUser.isPresent() ? "Found" : "Not found"));
            }

            if (existingUser.isPresent()) {
                // User exists, return the user
                UserEntity user = existingUser.get();

                // Check if user is banned
                if (user.isBanned()) {
                    logger.warning("🚫 Banned user attempted to log in via Firebase: " + user.getUsername());
                    throw new CustomException(
                            "Your account has been banned. Please contact the administrator for more information.");
                }

                // Update Firebase UID if missing
                if (user.getFirebaseUid() == null || user.getFirebaseUid().isEmpty()) {
                    user.setFirebaseUid(uid);
                    userRepository.save(user);
                    logger.info("✅ Updated user with Firebase UID: " + uid);
                }

                // Mark as verified if from OAuth provider
                if (!user.isVerified()) {
                    user.setVerified(true);
                    userRepository.save(user);
                    logger.info("✅ Marked user as verified (OAuth authentication)");
                }

                logger.info("✅ Returning existing user: " + user.getUsername());
                return user;
            } else {
                // User doesn't exist, create a new one
                logger.info("📝 Creating new user from Firebase token");

                UserEntity newUser = new UserEntity();
                newUser.setId(UUID.randomUUID().toString());
                newUser.setFirebaseUid(uid);

                // Set email
                if (email != null && !email.isEmpty()) {
                    newUser.setEmail(email);
                    newUser.setUsername(email.split("@")[0]);
                } else {
                    // Generate random credentials if email not available
                    String randomUsername = "user_" + UUID.randomUUID().toString().substring(0, 8);
                    newUser.setUsername(randomUsername);
                    newUser.setEmail(randomUsername + "@firebase.local");
                }

                // Parse name into first and last name
                if (name != null && !name.isEmpty()) {
                    String[] nameParts = name.split(" ", 2);
                    newUser.setFirstname(nameParts[0]);
                    if (nameParts.length > 1) {
                        newUser.setLastname(nameParts[1]);
                    }
                }

                // Set provider information
                newUser.setProvider(providerId != null ? providerId : "firebase");
                newUser.setProviderId(uid);

                // Set default values
                newUser.setAccountType("regular");
                newUser.setVerified(true); // Firebase OAuth users are auto-verified
                newUser.setDateCreated(new Date());
                newUser.setBanned(false);

                // Save the new user
                UserEntity savedUser = userRepository.save(newUser);
                logger.info("✅ Successfully created new user: " + savedUser.getUsername() + " (ID: " + savedUser.getId() + ")");

                return savedUser;
            }
        } catch (FirebaseAuthException e) {
            logger.severe("❌ Firebase token validation failed: " + e.getMessage());
            throw new CustomException("Invalid Firebase token: " + e.getMessage());
        } catch (CustomException e) {
            // Re-throw custom exceptions (like banned user)
            throw e;
        } catch (Exception e) {
            logger.severe("❌ Unexpected error during Firebase authentication: " + e.getMessage());
            e.printStackTrace();
            throw new CustomException("Firebase authentication error: " + e.getMessage());
        }
    }

    /**
     * Extract provider ID from Firebase token
     * 
     * @param token Decoded Firebase token
     * @return Provider ID (e.g., "google.com")
     */
    private String getProviderId(FirebaseToken token) {
        try {
            // Firebase tokens contain sign_in_provider claim
            Object signInProvider = token.getClaims().get("firebase");
            
            if (signInProvider instanceof java.util.Map) {
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> firebaseInfo = (java.util.Map<String, Object>) signInProvider;
                Object provider = firebaseInfo.get("sign_in_provider");
                
                if (provider != null) {
                    String providerStr = provider.toString();
                    logger.info("Firebase sign-in provider: " + providerStr);
                    
                    // Map provider IDs to our internal format
                    if (providerStr.contains("google")) {
                        return "google";
                    } else {
                        return providerStr;
                    }
                }
            }
        } catch (Exception e) {
            logger.warning("Could not extract provider ID from token: " + e.getMessage());
        }
        
        return null;
    }
}
