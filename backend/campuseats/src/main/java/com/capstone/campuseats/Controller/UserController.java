package com.capstone.campuseats.Controller;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Service.AzureAuthService;
import com.capstone.campuseats.Service.UserService;
import com.capstone.campuseats.Service.VerificationCodeService;
import com.capstone.campuseats.Service.JwtService;
import com.capstone.campuseats.Service.UnifiedAuthService;
import com.capstone.campuseats.config.CustomException;
import com.capstone.campuseats.Repository.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private VerificationCodeService verificationCodeService;
    
    @Autowired
    private AzureAuthService azureAuthService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UnifiedAuthService unifiedAuthService;

    private String generateVerificationCode() {
        // Generate a random alphanumeric verification code
        String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 6; i++) {
            code.append(characters.charAt(random.nextInt(characters.length())));
        }

        return code.toString();
    }

    @GetMapping("/{id}/offenses")
    public int getOffenses(@PathVariable String id) {
        try {
            return userService.getOffenses(id);
        } catch (CustomException e) {
            // Handle the exception, e.g., return a proper HTTP status code and message
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @PostMapping("/{id}/offenses")
    public int addOffenses(@PathVariable String id) {
        try {
            userService.addOffense(id);
            return userService.getOffenses(id);
        } catch (CustomException e) {
            // Handle the exception, e.g., return a proper HTTP status code and message
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @PostMapping("/sendVerificationCode")
    public ResponseEntity<String> sendVerificationCode(@RequestParam String email) {
        try {
            // You can add additional validation for the email if needed

            // Generate verification code
            String verificationCode = generateVerificationCode();

            // Store the verification code in the cache
            verificationCodeService.storeVerificationCode(email, verificationCode);

            // Send verification code to user's email
            userService.sendVerificationCode(email, verificationCode);

            // Return the verification code to the frontend
            return ResponseEntity.ok(verificationCode);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to send verification code. Please try again.");
        }
    }

    @PostMapping("/verifyCode")
    public ResponseEntity<String> verifyCode(@RequestParam String email, @RequestParam String enteredCode) {
        try {
            // Retrieve the stored verification code from the cache
            String storedCode = verificationCodeService.getVerificationCode(email);

            // Check if the entered code matches the stored code
            if (enteredCode.equals(storedCode)) {
                // Code verification successful
                return ResponseEntity.ok("success");
            } else {
                // Code verification failed
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Incorrect verification code");
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to verify code. Please try again.");
        }
    }

    @GetMapping
    public ResponseEntity<List<UserEntity>> getAllUsers() {
        return new ResponseEntity<List<UserEntity>>(userService.getAllUsers(), HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Optional<UserEntity>> getUserById(@PathVariable String id) {
        return new ResponseEntity<Optional<UserEntity>>(userService.findUserById(id), HttpStatus.OK);
    }

    @GetMapping("/by-email/{email}")
    public ResponseEntity<Optional<UserEntity>> checkUserByEmail(@PathVariable String email) {
        return new ResponseEntity<Optional<UserEntity>>(userService.checkUserExistsByEmail(email), HttpStatus.OK);
    }

    @GetMapping("/{id}/accountType")
    public ResponseEntity<?> getUserAccountType(@PathVariable String id) {
        try {
            String accountType = userService.getUserAccountType(id);
            return new ResponseEntity<>(accountType, HttpStatus.OK);
        } catch (CustomException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody UserEntity user) {
        try {
            UserEntity createdUser = userService.signup(user);
            return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
        } catch (CustomException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verifyToken(@RequestParam("token") String token) {
        Boolean verified = userService.verifyToken(token);
        if (verified) {
            // Redirect to the frontend page upon successful verification
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "http://localhost:3000/verification-success")
                    .build();
        } else {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "http://localhost:3000/verification-failed")
                    .build();
        }
    }

    @PostMapping("/authenticate")
    public ResponseEntity<Map<String, Object>> authenticateUser(@RequestBody Map<String, String> credentials) {
        String usernameOrEmail = credentials.get("usernameOrEmail");
        String password = credentials.get("password");

        try {
            UserEntity user = userService.login(usernameOrEmail, password);
            String token = jwtService.generateToken(user);
            Map<String, Object> response = new HashMap<>();
            response.put("user", user);
            response.put("token", token);
            return ResponseEntity.ok(response);
        } catch (CustomException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/azure-authenticate")
    public ResponseEntity<Map<String, Object>> azureAuthenticate(@RequestHeader("Authorization") String authHeader) {
        try {
            UserEntity user = azureAuthService.validateAzureToken(authHeader);
            String token = jwtService.generateToken(user);
            Map<String, Object> response = new HashMap<>();
            response.put("user", user);
            response.put("token", token);
            return ResponseEntity.ok(response);
        } catch (CustomException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    @PostMapping("/sync-oauth")
    public ResponseEntity<Map<String, Object>> syncOauthUser(@RequestHeader("Authorization") String authHeader) {
        try {
            UserEntity user = azureAuthService.validateAzureToken(authHeader);
            
            Map<String, Object> response = new HashMap<>();
            response.put("user", user);
            response.put("message", "User synchronized with Azure AD successfully");
            return ResponseEntity.ok(response);
        } catch (CustomException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String authHeader) {
        try {
            UserEntity user = unifiedAuthService.validateToken(authHeader);
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid or expired token");
            }
            return ResponseEntity.ok(user);
        } catch (CustomException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Internal server error: " + e.getMessage());
        }
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateUser(@PathVariable String id, @RequestBody UserEntity user) {
        try {
            userService.updateUser(id, user);
            return new ResponseEntity<>("User updated successfully", HttpStatus.OK);
        } catch (CustomException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }


    @PutMapping("/update/{userId}/accountType")
    public ResponseEntity<Boolean> updateAccountType(@PathVariable String userId, @RequestParam String accountType) {
        boolean isUpdated = userService.updateAccountType(userId, accountType);
        if (isUpdated) {
            return new ResponseEntity<>(true, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(false, HttpStatus.NOT_FOUND);
        }
    }

    @PutMapping("/{userId}/updatePassword")
    public ResponseEntity<?> updatePassword(@PathVariable String userId, @RequestBody Map<String, String> passwords) {
        String oldPassword = passwords.get("oldPassword");
        String newPassword = passwords.get("newPassword");

        try {
            userService.updatePassword(userId, oldPassword, newPassword);
            return new ResponseEntity<>("Password updated successfully", HttpStatus.OK);
        } catch (CustomException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @PutMapping("/ban/{id}/{currentUserId}")
    public ResponseEntity<?> banUser(
            @PathVariable String id,
            @PathVariable String currentUserId,
            @RequestBody Map<String, Boolean> banStatus
    ) {
        boolean isBanned = banStatus.getOrDefault("isBanned", false); // Extract isBanned
        return userService.banUser(id, currentUserId, isBanned);
    }


    @DeleteMapping("/delete/{userId}/{currentUserId}")
    public ResponseEntity<?> deleteUser(@PathVariable String userId, @PathVariable String currentUserId) {
        return userService.deleteUser(userId, currentUserId);
    }

    @GetMapping("/admin/cleanup-duplicates")
    public ResponseEntity<?> cleanupDuplicateUsers() {
        try {
            // Get all users
            List<UserEntity> allUsers = userService.getAllUsers();
            
            // Map to track emails and corresponding user IDs
            Map<String, List<String>> emailToIds = new HashMap<>();
            
            // Group users by email (case-insensitive)
            for (UserEntity user : allUsers) {
                String email = user.getEmail().toLowerCase();
                if (!emailToIds.containsKey(email)) {
                    emailToIds.put(email, new ArrayList<>());
                }
                emailToIds.get(email).add(user.getId());
            }
            
            // Find duplicates and merge them
            Map<String, List<String>> duplicates = new HashMap<>();
            int mergedCount = 0;
            
            for (Map.Entry<String, List<String>> entry : emailToIds.entrySet()) {
                if (entry.getValue().size() > 1) {
                    // Found duplicate users with the same email
                    String email = entry.getKey();
                    List<String> userIds = entry.getValue();
                    duplicates.put(email, userIds);
                    
                    // Keep the first user and merge properties into it from others
                    UserEntity primaryUser = userRepository.findById(userIds.get(0)).orElse(null);
                    if (primaryUser != null) {
                        for (int i = 1; i < userIds.size(); i++) {
                            UserEntity duplicateUser = userRepository.findById(userIds.get(i)).orElse(null);
                            if (duplicateUser != null) {
                                // Merge properties from duplicate to primary if the primary doesn't have them
                                if (primaryUser.getAzureOid() == null && duplicateUser.getAzureOid() != null) {
                                    primaryUser.setAzureOid(duplicateUser.getAzureOid());
                                }
                                if (primaryUser.getProviderId() == null && duplicateUser.getProviderId() != null) {
                                    primaryUser.setProviderId(duplicateUser.getProviderId());
                                }
                                if (primaryUser.getProvider() == null && duplicateUser.getProvider() != null) {
                                    primaryUser.setProvider(duplicateUser.getProvider());
                                }
                                
                                // Delete the duplicate
                                userRepository.delete(duplicateUser);
                                mergedCount++;
                            }
                        }
                        // Save the updated primary user
                        userRepository.save(primaryUser);
                    }
                }
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Duplicate user cleanup completed");
            response.put("duplicateEmails", duplicates.size());
            response.put("mergedUsers", mergedCount);
            response.put("details", duplicates);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error cleaning up duplicate users: " + e.getMessage());
        }
    }
}
