package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.CampusEntity;
import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.CampusRepository;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.Repository.ShopRepository;
import com.capstone.campuseats.Repository.DasherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CampusService {

    private final CampusRepository campusRepository;
    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final DasherRepository dasherRepository;

    /**
     * Get all campuses
     */
    public List<CampusEntity> getAllCampuses() {
        return campusRepository.findAll();
    }

    /**
     * Get all active campuses
     */
    public List<CampusEntity> getActiveCampuses() {
        return campusRepository.findByIsActive(true);
    }

    /**
     * Get campus by ID
     */
    public Optional<CampusEntity> getCampusById(String campusId) {
        return campusRepository.findById(campusId);
    }

    /**
     * Get campus by admin ID
     */
    public Optional<CampusEntity> getCampusByAdminId(String adminId) {
        return campusRepository.findByAdminId(adminId);
    }

    /**
     * Create a new campus with admin assignment
     * Only superadmins can create campuses
     */
    public CampusEntity createCampus(CampusEntity campus, String adminId) {
        // Validate admin exists and has admin account type
        UserEntity admin = userRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin user not found"));

        if (!"admin".equalsIgnoreCase(admin.getAccountType())) {
            throw new RuntimeException("User must have admin account type");
        }

        // Check if admin is already assigned to another campus
        Optional<CampusEntity> existingAssignment = campusRepository.findByAdminId(adminId);
        if (existingAssignment.isPresent()) {
            throw new RuntimeException("Admin is already assigned to campus: " + existingAssignment.get().getName());
        }

        // Set admin and save campus
        campus.setAdminId(adminId);
        campus.setDateCreated(LocalDateTime.now());
        campus.setActive(true);
        CampusEntity savedCampus = campusRepository.save(campus);

        // Update admin's campusId
        admin.setCampusId(savedCampus.getId());
        userRepository.save(admin);

        return savedCampus;
    }

    /**
     * Update campus details
     * Only superadmins can update campuses
     */
    public CampusEntity updateCampus(String campusId, CampusEntity updatedCampus) {
        CampusEntity campus = campusRepository.findById(campusId)
                .orElseThrow(() -> new RuntimeException("Campus not found"));

        System.out.println("📝 Updating campus: " + campusId);
        System.out.println("   - Received name: " + updatedCampus.getName());
        System.out.println("   - Received address: " + updatedCampus.getAddress());
        System.out.println("   - Received centerLatitude: " + updatedCampus.getCenterLatitude());
        System.out.println("   - Received centerLongitude: " + updatedCampus.getCenterLongitude());
        System.out.println("   - Received geofenceRadius: " + updatedCampus.getGeofenceRadius());

        // Update fields
        if (updatedCampus.getName() != null && !updatedCampus.getName().isEmpty()) {
            campus.setName(updatedCampus.getName());
            System.out.println("   ✅ Updated name to: " + updatedCampus.getName());
        }
        if (updatedCampus.getAddress() != null && !updatedCampus.getAddress().isEmpty()) {
            campus.setAddress(updatedCampus.getAddress());
            System.out.println("   ✅ Updated address to: " + updatedCampus.getAddress());
        }
        if (updatedCampus.getCenterLatitude() != 0) {
            campus.setCenterLatitude(updatedCampus.getCenterLatitude());
            System.out.println("   ✅ Updated centerLatitude to: " + updatedCampus.getCenterLatitude());
        }
        if (updatedCampus.getCenterLongitude() != 0) {
            campus.setCenterLongitude(updatedCampus.getCenterLongitude());
            System.out.println("   ✅ Updated centerLongitude to: " + updatedCampus.getCenterLongitude());
        }
        if (updatedCampus.getGeofenceRadius() != 0) {
            campus.setGeofenceRadius(updatedCampus.getGeofenceRadius());
            System.out.println("   ✅ Updated geofenceRadius to: " + updatedCampus.getGeofenceRadius());
        }

        CampusEntity saved = campusRepository.save(campus);
        System.out.println("💾 Campus saved with geofenceRadius: " + saved.getGeofenceRadius());
        return saved;
    }

    /**
     * Assign or reassign admin to campus
     * Only superadmins can assign admins
     */
    public CampusEntity assignAdmin(String campusId, String newAdminId) {
        CampusEntity campus = campusRepository.findById(campusId)
                .orElseThrow(() -> new RuntimeException("Campus not found"));

        UserEntity newAdmin = userRepository.findById(newAdminId)
                .orElseThrow(() -> new RuntimeException("Admin user not found"));

        if (!"admin".equalsIgnoreCase(newAdmin.getAccountType())) {
            throw new RuntimeException("User must have admin account type");
        }

        // Check if new admin is already assigned to another campus
        Optional<CampusEntity> existingAssignment = campusRepository.findByAdminId(newAdminId);
        if (existingAssignment.isPresent() && !existingAssignment.get().getId().equals(campusId)) {
            throw new RuntimeException("Admin is already assigned to campus: " + existingAssignment.get().getName());
        }

        // Remove old admin's campus assignment if exists
        if (campus.getAdminId() != null) {
            userRepository.findById(campus.getAdminId()).ifPresent(oldAdmin -> {
                oldAdmin.setCampusId(null);
                userRepository.save(oldAdmin);
            });
        }

        // Assign new admin
        campus.setAdminId(newAdminId);
        campusRepository.save(campus);

        // Update new admin's campusId
        newAdmin.setCampusId(campusId);
        userRepository.save(newAdmin);

        return campus;
    }

    /**
     * Toggle campus active status
     * Only superadmins can disable/enable campuses
     */
    public CampusEntity toggleCampusStatus(String campusId) {
        CampusEntity campus = campusRepository.findById(campusId)
                .orElseThrow(() -> new RuntimeException("Campus not found"));

        campus.setActive(!campus.isActive());
        return campusRepository.save(campus);
    }

    /**
     * Delete campus
     * Only superadmins can delete campuses
     */
    public void deleteCampus(String campusId) {
        CampusEntity campus = campusRepository.findById(campusId)
                .orElseThrow(() -> new RuntimeException("Campus not found"));

        // Remove admin's campus assignment
        if (campus.getAdminId() != null) {
            userRepository.findById(campus.getAdminId()).ifPresent(admin -> {
                admin.setCampusId(null);
                userRepository.save(admin);
            });
        }

        campusRepository.deleteById(campusId);
    }

    /**
     * Get campus statistics - count of shops, dashers, and users
     */
    public Map<String, Object> getCampusStatistics(String campusId) {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // Count shops in this campus
            long shopCount = shopRepository.findByCampusId(campusId).size();
            
            // Count dashers in this campus
            long dasherCount = dasherRepository.findByCampusId(campusId).size();
            
            // Count regular users in this campus (exclude admins and superadmins)
            long userCount = userRepository.findAll().stream()
                    .filter(user -> campusId.equals(user.getCampusId()))
                    .filter(user -> {
                        String accountType = user.getAccountType();
                        return accountType == null || 
                               (!accountType.equalsIgnoreCase("admin") && 
                                !accountType.equalsIgnoreCase("superadmin"));
                    })
                    .count();
            
            stats.put("campusId", campusId);
            stats.put("shopCount", shopCount);
            stats.put("dasherCount", dasherCount);
            stats.put("userCount", userCount);
        } catch (Exception e) {
            System.err.println("Error calculating campus statistics: " + e.getMessage());
            stats.put("campusId", campusId);
            stats.put("shopCount", 0);
            stats.put("dasherCount", 0);
            stats.put("userCount", 0);
        }
        
        return stats;
    }
}
