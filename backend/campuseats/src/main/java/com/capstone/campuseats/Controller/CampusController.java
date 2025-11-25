package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.CampusEntity;
import com.capstone.campuseats.Service.AuthContextService;
import com.capstone.campuseats.Service.CampusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/campuses")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CampusController {

    private final CampusService campusService;
    private final AuthContextService authContextService;

    /**
     * Get all campuses (superadmin only)
     */
    @GetMapping
    public ResponseEntity<?> getAllCampuses(@RequestParam(required = false) String userId) {
        try {
            // Check if user is superadmin
            if (userId != null && !authContextService.isSuperadmin(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can view all campuses");
            }

            List<CampusEntity> campuses = campusService.getAllCampuses();
            return ResponseEntity.ok(campuses);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching campuses: " + e.getMessage());
        }
    }

    /**
     * Get all active campuses (available to all users for campus selection)
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveCampuses() {
        try {
            List<CampusEntity> campuses = campusService.getActiveCampuses();
            return ResponseEntity.ok(campuses);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching active campuses: " + e.getMessage());
        }
    }

    /**
     * Get campus by ID
     */
    @GetMapping("/{campusId}")
    public ResponseEntity<?> getCampusById(@PathVariable String campusId) {
        try {
            return campusService.getCampusById(campusId)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching campus: " + e.getMessage());
        }
    }

    /**
     * Get campus by admin ID
     */
    @GetMapping("/admin/{adminId}")
    public ResponseEntity<?> getCampusByAdminId(@PathVariable String adminId) {
        try {
            return campusService.getCampusByAdminId(adminId)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching campus by admin: " + e.getMessage());
        }
    }

    /**
     * Create a new campus with admin assignment (superadmin only)
     */
    @PostMapping
    public ResponseEntity<?> createCampus(
            @RequestBody CampusEntity campus,
            @RequestParam String adminId,
            @RequestParam String userId) {
        try {
            // Check if user is superadmin
            boolean isSuperadmin = authContextService.isSuperadmin(userId);
            String accountType = authContextService.getUserAccountType(userId);
            String campusId = authContextService.getUserCampusId(userId);
            
            if (!isSuperadmin) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can create campuses. Your account type: " + accountType + ", campusId: " + campusId);
            }

            CampusEntity createdCampus = campusService.createCampus(campus, adminId);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdCampus);
        } catch (Exception e) {
            System.err.println("Error creating campus: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error creating campus: " + e.getMessage());
        }
    }

    /**
     * Update campus details (superadmin only)
     */
    @PutMapping("/{campusId}")
    public ResponseEntity<?> updateCampus(
            @PathVariable String campusId,
            @RequestBody CampusEntity campus,
            @RequestParam String userId) {
        try {
            // Check if user is superadmin
            if (!authContextService.isSuperadmin(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can update campuses");
            }

            CampusEntity updatedCampus = campusService.updateCampus(campusId, campus);
            return ResponseEntity.ok(updatedCampus);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error updating campus: " + e.getMessage());
        }
    }

    /**
     * Assign or reassign admin to campus (superadmin only)
     */
    @PutMapping("/{campusId}/assign-admin")
    public ResponseEntity<?> assignAdmin(
            @PathVariable String campusId,
            @RequestParam String adminId,
            @RequestParam String userId) {
        try {
            // Check if user is superadmin
            if (!authContextService.isSuperadmin(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can assign admins");
            }

            CampusEntity updatedCampus = campusService.assignAdmin(campusId, adminId);
            return ResponseEntity.ok(updatedCampus);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error assigning admin: " + e.getMessage());
        }
    }

    /**
     * Toggle campus active status (superadmin only)
     */
    @PutMapping("/{campusId}/toggle-status")
    public ResponseEntity<?> toggleCampusStatus(
            @PathVariable String campusId,
            @RequestParam String userId) {
        try {
            // Check if user is superadmin
            if (!authContextService.isSuperadmin(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can change campus status");
            }

            CampusEntity updatedCampus = campusService.toggleCampusStatus(campusId);
            return ResponseEntity.ok(updatedCampus);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error toggling campus status: " + e.getMessage());
        }
    }

    /**
     * Delete campus (superadmin only)
     */
    @DeleteMapping("/{campusId}")
    public ResponseEntity<?> deleteCampus(
            @PathVariable String campusId,
            @RequestParam String userId) {
        try {
            // Check if user is superadmin
            if (!authContextService.isSuperadmin(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Only superadmins can delete campuses");
            }

            campusService.deleteCampus(campusId);
            return ResponseEntity.ok("Campus deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error deleting campus: " + e.getMessage());
        }
    }

    /**
     * Get campus statistics (shops, dashers, users count)
     */
    @GetMapping("/{campusId}/stats")
    public ResponseEntity<?> getCampusStatistics(@PathVariable String campusId) {
        try {
            Map<String, Object> stats = campusService.getCampusStatistics(campusId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            System.err.println("Error fetching campus statistics: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching campus statistics: " + e.getMessage());
        }
    }
}
