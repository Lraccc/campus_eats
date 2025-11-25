package com.capstone.campuseats.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.capstone.campuseats.Entity.DasherEntity;
import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.DasherRepository;
import com.capstone.campuseats.Repository.UserRepository;
import com.capstone.campuseats.config.CustomException;
import com.capstone.campuseats.Service.WebSocketNotificationService;

import jakarta.annotation.PostConstruct;

@Service
public class DasherService {

    private final DasherRepository dasherRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final UserRepository userRepository;

    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;

    @Autowired
    public DasherService(DasherRepository dasherRepository, WebSocketNotificationService webSocketNotificationService, UserRepository userRepository) {
        this.dasherRepository = dasherRepository;
        this.webSocketNotificationService = webSocketNotificationService;
        this.userRepository = userRepository;
    }

    @PostConstruct
    public void init() {
        blobServiceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
    }

    public List<DasherEntity> getAllDashers() {
        return dasherRepository.findAll();
    }

    public List<DasherEntity> getPendingDashers() {
        return dasherRepository.findByStatus("pending");
    }

    public List<DasherEntity> getPendingDashersByCampus(String campusId) {
        if (campusId == null || campusId.isEmpty()) {
            return dasherRepository.findByStatus("pending");
        }
        return dasherRepository.findByStatusAndCampusId("pending", campusId);
    }

    public List<DasherEntity> getNonPendingDashers() {
        return dasherRepository.findByStatusNot("pending");
    }

    public List<DasherEntity> getNonPendingDashersByCampus(String campusId) {
        if (campusId == null || campusId.isEmpty()) {
            return dasherRepository.findByStatusNot("pending");
        }
        return dasherRepository.findByStatusNotAndCampusId("pending", campusId);
    }

    public Map<String, List<DasherEntity>> getDashers() {
        List<DasherEntity> pendingDashers = getPendingDashers();
        List<DasherEntity> nonPendingDashers = getNonPendingDashers();
        Map<String, List<DasherEntity>> dashersMap = new HashMap<>();
        dashersMap.put("pendingDashers", pendingDashers);
        dashersMap.put("nonPendingDashers", nonPendingDashers);
        return dashersMap;
    }

    public Optional<DasherEntity> getDasherById(String id) {
        return dasherRepository.findById(id);
    }

    public List<DasherEntity> getActiveDashers() {
        return dasherRepository.findByStatus("active");
    }

    public List<DasherEntity> getActiveDashersByCampus(String campusId) {
        if (campusId == null || campusId.isEmpty()) {
            return dasherRepository.findByStatus("active");
        }
        return dasherRepository.findByStatusAndCampusId("active", campusId);
    }

    public boolean updateDasherStatus(String dasherId, String status) {
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();
            dasher.setStatus(status);
            dasherRepository.save(dasher);
            return true;
        }
        return false;
    }

    public boolean updateDasherWallet(String dasherId, double amountPaid) {
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();
            double oldWallet = dasher.getWallet();
            dasher.setWallet(oldWallet + amountPaid); // Add the amount for topups
            dasherRepository.save(dasher);
            
            // Send real-time wallet update notification
            webSocketNotificationService.sendWalletUpdate(dasherId, "dasher", dasher.getWallet());
            
            return true;
        }
        return false;
    }

    /**
     * Updates the dasher's wallet balance after a cashout is approved by admin
     * This method is called from CashoutService when a cashout status is changed to 'accepted'
     * 
     * @param dasherId The ID of the dasher to update
     * @param amount The cashout amount to deduct from the dasher's wallet
     * @return true if the wallet was updated successfully, false otherwise
     */
    public boolean updateDasherWalletForCashout(String dasherId, double amount) {
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();
            // Ensure wallet doesn't go negative
            double newBalance = Math.max(0.0, dasher.getWallet() - amount);
            dasher.setWallet(newBalance);
            dasherRepository.save(dasher);
            
            // Send real-time wallet update notification
            webSocketNotificationService.sendWalletUpdate(dasherId, "dasher", newBalance);
            
            return true;
        }
        return false;
    }

    public DasherEntity createDasher(DasherEntity dasher, MultipartFile image, String userId) throws IOException {
        if (dasherRepository.existsById(userId)) {
            throw new CustomException("Dasher already exists.");
        }

        dasher.setId(userId);

        // Get user's campusId and assign it to dasher
        Optional<UserEntity> userOptional = userRepository.findById(userId);
        if (userOptional.isPresent()) {
            UserEntity user = userOptional.get();
            dasher.setCampusId(user.getCampusId());
        }

        if (dasher.getCreatedAt() == null) {
            dasher.setCreatedAt(LocalDateTime.now());
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = dasher.getCreatedAt().format(formatter);
        String sanitizedDasherName = "dasher/" + formattedTimestamp + "_" + userId;

        BlobClient blobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedDasherName);

        blobClient.upload(image.getInputStream(), image.getSize(), true);

        String schoolId = blobClient.getBlobUrl();
        dasher.setStatus("pending");
        dasher.setSchoolId(schoolId);
        dasher.setWallet(0);
        dasher.setCreatedAt(LocalDateTime.now());
        return dasherRepository.save(dasher);
    }

    public DasherEntity updateDasher(String dasherId, DasherEntity dasher, MultipartFile image) throws IOException {
        Optional<DasherEntity> optionalDasher = dasherRepository.findById(dasherId);
        if (optionalDasher.isEmpty()) {
            throw new CustomException("Dasher not found.");
        }

        DasherEntity existingDasher = optionalDasher.get();

        if (image != null) {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = LocalDateTime.now().format(formatter);
            String sanitizedDasherName = "dasher/" + formattedTimestamp + "_" + dasherId;

            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedDasherName);

            blobClient.upload(image.getInputStream(), image.getSize(), true);

            String schoolId = blobClient.getBlobUrl();
            System.out.println("schoolId URL: " + schoolId);
            existingDasher.setSchoolId(schoolId);
            System.out.println("schoolId URL after set: " + existingDasher.getSchoolId());
        }

        existingDasher.setAvailableStartTime(dasher.getAvailableStartTime());
        existingDasher.setAvailableEndTime(dasher.getAvailableEndTime());
        existingDasher.setDaysAvailable(dasher.getDaysAvailable());
        existingDasher.setGcashName(dasher.getGcashName());
        existingDasher.setStatus(existingDasher.getStatus());
        existingDasher.setGcashNumber(dasher.getGcashNumber());

        System.out.println("user: " + existingDasher);
        System.out.println("test df: " + existingDasher.getGcashNumber());
        return dasherRepository.save(existingDasher);
    }

    /**
     * Assign campus to dasher
     * 
     * @param dasherId The ID of the dasher
     * @param campusId The ID of the campus to assign
     * @return true if assignment was successful, false otherwise
     */
    public boolean assignCampus(String dasherId, String campusId) {
        Optional<DasherEntity> dasherOptional = dasherRepository.findById(dasherId);
        if (dasherOptional.isPresent()) {
            DasherEntity dasher = dasherOptional.get();
            dasher.setCampusId(campusId);
            dasherRepository.save(dasher);
            return true;
        }
        return false;
    }

}
