package com.capstone.campuseats.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.capstone.campuseats.Controller.NotificationController;
import com.capstone.campuseats.Entity.ConfirmationEntity;
import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.ConfirmationRepository;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.config.CustomException;

@Service
public class UserService {
    @Autowired
    private BCryptPasswordEncoder passwordEncoder;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ConfirmationRepository confirmationRepository;
    @Autowired
    private EmailService emailService;

    @Autowired
    private NotificationController notificationController;

    @Autowired
    private JavaMailSender javaMailSender;

    public String sendVerificationCode(String to, String verificationCode) {
        try {
            // Send verification code to user's email
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("xiannandreicabana@gmail.com"); // replace with your email
            message.setTo(to);
            message.setSubject("Verification Code");
            message.setText("Your verification code is: " + verificationCode);

            javaMailSender.send(message);

            // Return the verification code
            return verificationCode;
        } catch (Exception e) {
            // Handle exceptions, log errors, etc.
            throw new RuntimeException("Failed to send verification code. Please try again.", e);
        }
    }

    public List<UserEntity> getUsersByAccountTypeBannedAndVerifiedStatus(String accountType, boolean isBanned, boolean isVerified) {
        return userRepository.findByAccountTypeAndIsBannedAndIsVerified(accountType, isBanned, isVerified);
    }


    public List<UserEntity> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<UserEntity> findUserById(String id) {
        return userRepository.findById(id);
    }

    public int getOffenses(String id) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findById(id);
        if (optionalUser.isPresent()) {
            return optionalUser.get().getOffenses();
        } else {
            throw new CustomException("User not found.");
        }
    }

    public void addOffense(String id) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findById(id);
        if (optionalUser.isPresent()) {
            UserEntity user = optionalUser.get();
            user.setOffenses(user.getOffenses() + 1);
            String notificationMessage = "";
            int currentOffenses = user.getOffenses();
            if (currentOffenses == 1) {
                notificationMessage += " Warning: You have canceled 1 order.";
            } else if (currentOffenses == 2) {
                notificationMessage += " Warning: You have canceled 2 orders. One more cancellation will result in a ban.";
            } else if (currentOffenses >= 3) {
                notificationMessage += " You have been banned due to excessive cancellations.";
                user.setBanned(true); // Ban the user after 3 cancellations
            }

            notificationController.sendNotification(notificationMessage);
            userRepository.save(user);
        } else {
            throw new CustomException("User not found.");
        }
    }

    public Optional<UserEntity> checkUserExistsByEmail(String email) {
        System.out.println("email: " + email);
        System.out.println("response: " + userRepository.findByEmailIgnoreCase(email));
        return userRepository.findByEmailIgnoreCase(email);
    }

    public String getUserAccountType(String id) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findById(id);
        if (optionalUser.isPresent()) {
            return optionalUser.get().getAccountType();
        } else {
            throw new CustomException("User not found.");
        }
    }

    public Boolean verifyToken(String token) {
        ConfirmationEntity confirmation = confirmationRepository.findByToken(token);
        if (confirmation == null) {
            return Boolean.FALSE; // Token not found
        }

        Optional<UserEntity> optionalUser = userRepository.findByEmailIgnoreCase(confirmation.getUser().getEmail());
        if (optionalUser.isPresent()) {
            UserEntity user = optionalUser.get();
            user.setVerified(true);
            confirmation.getUser().setVerified(true);
            confirmationRepository.save(confirmation);
            userRepository.save(user);
            return Boolean.TRUE;
        } else {
            return Boolean.FALSE;
        }
    }

    private void resendVerificationLink(UserEntity user) {
        Optional<ConfirmationEntity> confirmation = confirmationRepository.findById(user.getId());
        System.out.println("user = " + user.getId());
        System.out.println("confirmation = " + confirmation);
        confirmation.ifPresent(confirmationEntity -> emailService.sendEmail(user.getUsername(), user.getEmail(),
                confirmationEntity.getToken()));
    }

    public UserEntity signup(UserEntity user) throws CustomException {

        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new CustomException("The username is already in use by another account.");
        }

        if (userRepository.findByEmailIgnoreCase(user.getEmail()).isPresent()) {
            throw new CustomException("The email address is already in use by another account.");
        }

        String encodedPassword = passwordEncoder.encode(user.getPassword());

        user.setPassword(encodedPassword);
        user.setAccountType("regular");
        user.setDateCreated(new Date());
        user.setVerified(false);
        user.setPhone(null);
        user.setDob(null);
        user.setCourseYear(null);
        user.setBanned(false);

        String stringId = UUID.randomUUID().toString();
        user.setId(stringId);

        UserEntity savedUser = userRepository.save(user);

        ConfirmationEntity confirmation = new ConfirmationEntity(user);
        confirmation.setId(savedUser.getId());
        confirmationRepository.save(confirmation);

        // TODO send email to user with token
        emailService.sendEmail(user.getUsername(), user.getEmail(), confirmation.getToken());
        return savedUser;
    }

    public UserEntity login(String usernameOrEmail, String password) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findByUsername(usernameOrEmail);
        if (optionalUser.isEmpty()) {
            optionalUser = userRepository.findByEmailIgnoreCase(usernameOrEmail);
        }

        if (optionalUser.isPresent()) {
            UserEntity user = optionalUser.get();

            if (user.isBanned()) {
                throw new CustomException(
                        "Your account has been banned. Please contact the administrator for more information.");
            }
            // Verify password
            if (passwordEncoder.matches(password, user.getPassword())) {
                if (!user.isVerified()) {
                    resendVerificationLink(user);
                    throw new CustomException(
                            "Your account is not verified. Please check your email for the verification link.");
                }
                return user;
            } else {
                throw new CustomException("Invalid username/email or password.");
            }
        } else {
            throw new CustomException("User not found.");
        }
    }

    public void updateUser(String id, UserEntity user) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findById(id);
        if (optionalUser.isPresent()) {
            UserEntity existingUser = optionalUser.get();

            // Update only the fields that are not null
            if (user.getFirstname() != null) {
                existingUser.setFirstname(user.getFirstname());
            }
            if (user.getLastname() != null) {
                existingUser.setLastname(user.getLastname());
            }
            if (user.getPhone() != null) {
                existingUser.setPhone(user.getPhone());
            }
            if (user.getUsername() != null) {
                existingUser.setUsername(user.getUsername());
            }

            existingUser.setDateCreated(existingUser.getDateCreated());

            existingUser.setAccountType(existingUser.getAccountType());

            existingUser.setVerified(existingUser.isVerified());

            if (user.getDob() != null) {
                existingUser.setDob(user.getDob());
            }
            if (user.getCourseYear() != null) {
                existingUser.setCourseYear(user.getCourseYear());
            }
            if (user.getSchoolIdNum() != null) {
                existingUser.setSchoolIdNum(user.getSchoolIdNum());
            }
            System.out.println("password new: " + user.getPassword());
            if (user.getPassword() != null) {
                String encodedPassword = passwordEncoder.encode(user.getPassword());
                existingUser.setPassword(encodedPassword); // Ensure that the password is updated securely
            }


            // Save the updated user
            userRepository.save(existingUser);
        } else {
            throw new CustomException("User not found.");
        }
    }


    public boolean updateAccountType(String userId, String accountType) {
        Optional<UserEntity> userOptional = userRepository.findById(userId);
        if (userOptional.isPresent()) {
            UserEntity user = userOptional.get();
            user.setAccountType(accountType);
            userRepository.save(user);
            return true;
        }
        return false;
    }

    public void updatePassword(String userId, String oldPassword, String newPassword) throws CustomException {
        Optional<UserEntity> optionalUser = userRepository.findById(userId);
        if (optionalUser.isPresent()) {
            UserEntity user = optionalUser.get();
            // Check if the old password matches
            if (passwordEncoder.matches(oldPassword, user.getPassword())) {
                // Encode and update the new password
                user.setPassword(passwordEncoder.encode(newPassword));
                userRepository.save(user);
            } else {
                throw new CustomException("Old password is incorrect.");
            }
        } else {
            throw new CustomException("User not found.");
        }
    }

    public ResponseEntity<String> banUser(String id, String currentUserId, boolean isBanned) throws CustomException {
        Optional<UserEntity> optionalCurrentUser = userRepository.findById(currentUserId);

        if (!optionalCurrentUser.isPresent()) {
            return new ResponseEntity<>("Current user not found.", HttpStatus.BAD_REQUEST);
        }

        Optional<UserEntity> optionalUser = userRepository.findById(id);

        if (!optionalUser.isPresent()) {
            return new ResponseEntity<>("User not found.", HttpStatus.BAD_REQUEST);
        }

        UserEntity existingUser = optionalUser.get();

        existingUser.setBanned(isBanned);

        userRepository.save(existingUser);
        return new ResponseEntity<>("User banned successfully.", HttpStatus.OK);


}
    public ResponseEntity<String> deleteUser(String userId, String currentUserId) {
        // Retrieve the current user by currentUserId (the one making the request)
        Optional<UserEntity> optionalCurrentUser = userRepository.findById(currentUserId);

        if (!optionalCurrentUser.isPresent()) {
            return new ResponseEntity<>("Current user not found.", HttpStatus.BAD_REQUEST);
        }

        UserEntity currentUser = optionalCurrentUser.get();

        // Check if the current user's accountType is 'admin'
        if (!"admin".equals(currentUser.getAccountType())) {
            return new ResponseEntity<>("You are not authorized to delete users.", HttpStatus.FORBIDDEN);
        }

        // Retrieve the user to be deleted by userId
        Optional<UserEntity> optionalUserToDelete = userRepository.findById(userId);

        if (!optionalUserToDelete.isPresent()) {
            return new ResponseEntity<>("User not found.", HttpStatus.BAD_REQUEST);
        }

        // Delete the user
        userRepository.deleteById(userId);

        return new ResponseEntity<>("User deleted successfully.", HttpStatus.OK);
    }
}
