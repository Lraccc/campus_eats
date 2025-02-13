package com.capstone.campuseats.Controller;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Service.UserService;
import com.capstone.campuseats.Service.VerificationCodeService;
import com.capstone.campuseats.config.CustomException;

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
                    .header("Location", "https://citu-campuseats.vercel.app/verification-success")
                    .build();
        } else {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "https://citu-campuseats.vercel.app/verification-failed")
                    .build();
        }
    }

    @PostMapping("/authenticate")
    public ResponseEntity<Map<String, Object>> authenticateUser(@RequestBody Map<String, String> credentials) {
        String usernameOrEmail = credentials.get("usernameOrEmail");
        String password = credentials.get("password");

        try {
            UserEntity user = userService.login(usernameOrEmail, password);
            Map<String, Object> response = new HashMap<>();
            response.put("user", user);
            return ResponseEntity.ok(response);
        } catch (CustomException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/filter")
    public List<UserEntity> filterUsers(
            @RequestParam String accountType,
            @RequestParam boolean isBanned,
            @RequestParam boolean isVerified
    ) {
        return userService.getUsersByAccountTypeBannedAndVerifiedStatus(accountType, isBanned, isVerified);
    }
    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateUser(@PathVariable String id, @RequestBody UserEntity user) {
        try {
            System.out.println("id:" + id);
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
}
