package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthContextService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Get the campusId for a given userId
     * Returns null if user not found or if user has no campusId (e.g., superadmin)
     */
    public String getUserCampusId(String userId) {
        if (userId == null || userId.isEmpty()) {
            return null;
        }
        
        Optional<UserEntity> userOptional = userRepository.findById(userId);
        if (userOptional.isPresent()) {
            return userOptional.get().getCampusId();
        }
        
        return null;
    }

    /**
     * Check if a user is a superadmin (no campusId and accountType is superadmin)
     */
    public boolean isSuperadmin(String userId) {
        if (userId == null || userId.isEmpty()) {
            return false;
        }
        
        Optional<UserEntity> userOptional = userRepository.findById(userId);
        if (userOptional.isPresent()) {
            UserEntity user = userOptional.get();
            String campusId = user.getCampusId();
            String accountType = user.getAccountType();
            
            // Check if accountType is superadmin AND campusId is null, empty, or the string "null"
            boolean isSuperadmin = "superadmin".equalsIgnoreCase(accountType) 
                    && (campusId == null || campusId.isEmpty() || campusId.isBlank() || "null".equalsIgnoreCase(campusId));
            
            return isSuperadmin;
        }
        
        return false;
    }

    /**
     * Get user's accountType
     */
    public String getUserAccountType(String userId) {
        if (userId == null || userId.isEmpty()) {
            return null;
        }
        
        Optional<UserEntity> userOptional = userRepository.findById(userId);
        if (userOptional.isPresent()) {
            return userOptional.get().getAccountType();
        }
        
        return null;
    }
}
