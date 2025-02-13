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
import com.capstone.campuseats.Entity.CashoutEntity;
import com.capstone.campuseats.Repository.CashoutRepository;
import com.capstone.campuseats.config.CustomException;

import jakarta.annotation.PostConstruct;

@Service
public class CashoutService {

    private final CashoutRepository cashoutRepository;

    @Autowired
    public CashoutService(CashoutRepository cashoutRepository) {
        this.cashoutRepository = cashoutRepository;
    }

    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;

    @PostConstruct
    public void init() {
        blobServiceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
    }

    public List<CashoutEntity> getAllCashouts() {
        return cashoutRepository.findAll();
    }

    public List<CashoutEntity> getPendingCashouts() {
        return cashoutRepository.findByStatus("pending");
    }

    public List<CashoutEntity> getNonPendingCashouts() {
        return cashoutRepository.findByStatusNot("pending");
    }

    public Map<String, List<CashoutEntity>> getCashouts() {
        List<CashoutEntity> pendingCashouts = getPendingCashouts();
        List<CashoutEntity> nonPendingCashouts = getNonPendingCashouts();
        Map<String, List<CashoutEntity>> cashoutsMap = new HashMap<>();
        cashoutsMap.put("pendingCashouts", pendingCashouts);
        cashoutsMap.put("nonPendingCashouts", nonPendingCashouts);
        return cashoutsMap;
    }

    public boolean updateCashoutStatus(String cashoutId, String status) {
        Optional<CashoutEntity> cashoutOptional = cashoutRepository.findById(cashoutId);
        if (cashoutOptional.isPresent()) {
            CashoutEntity cashout = cashoutOptional.get();
            cashout.setStatus(status);
            cashoutRepository.save(cashout);
            return true;
        }
        return false;
    }

    public CashoutEntity updateCashoutReference(String cashoutId, String referenceNumber) {
        Optional<CashoutEntity> cashoutOptional = cashoutRepository.findById(cashoutId);
        if (cashoutOptional.isPresent()) {
            CashoutEntity cashout = cashoutOptional.get();
            cashout.setReferenceNumber(referenceNumber);
            cashout.setPaidAt(LocalDateTime.now());
            return cashoutRepository.save(cashout);
        }
        return null; // or throw CustomException if you prefer
    }

    public Optional<CashoutEntity> getCashoutById(String id) {
        Optional<CashoutEntity> cashout = cashoutRepository.findById(id);
        System.out.println("Retrieved cashout: " + cashout);
        return cashout;
    }

    public CashoutEntity createCashout(CashoutEntity cashout, MultipartFile image, String userId) throws IOException {
        if (cashout.getCreatedAt() == null) {
            cashout.setCreatedAt(LocalDateTime.now());
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = cashout.getCreatedAt().format(formatter);
        String sanitizedCashoutName = "cashout/" + formattedTimestamp + "_" + userId;

        BlobClient blobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedCashoutName);

        blobClient.upload(image.getInputStream(), image.getSize(), true);

        cashout.setId(userId);
        String qrURL = blobClient.getBlobUrl();
        cashout.setStatus("pending");
        cashout.setGcashQr(qrURL);
        cashout.setCreatedAt(LocalDateTime.now());
        return cashoutRepository.save(cashout);
    }

    public boolean deleteCashout(String cashoutId) {
        Optional<CashoutEntity> cashoutOptional = cashoutRepository.findById(cashoutId);
        if (cashoutOptional.isPresent()) {
            cashoutRepository.deleteById(cashoutId);
            return true;
        }
        return false;
    }

    // Update cashout
    public CashoutEntity updateCashout(String id, CashoutEntity cashout, MultipartFile image, String userId)
            throws IOException {

        // Find the existing cashout entity by ID
        CashoutEntity existingCashout = cashoutRepository.findById(id)
                .orElseThrow(() -> new CustomException("Cashout not found with ID: " + id));

        // If an image is provided, update the image
        if (image != null && !image.isEmpty()) {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = LocalDateTime.now().format(formatter);
            String sanitizedCashoutName = "cashout/" + formattedTimestamp + "_" + userId;

            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(sanitizedCashoutName);

            // Upload new image
            blobClient.upload(image.getInputStream(), image.getSize(), true);

            // Update QR URL with the new image's URL
            String qrURL = blobClient.getBlobUrl();
            existingCashout.setGcashQr(qrURL); // Set the new image URL
        } else {
            // No new image provided, keep the existing image URL
            System.out.println("No new image provided. Retaining the existing image.");
        }

        // Update other fields (e.g., status, userId) if needed
        existingCashout.setStatus(cashout.getStatus());
        existingCashout.setAmount(cashout.getAmount()); // Example of other field updates

        // Save and return the updated cashout entity
        return cashoutRepository.save(existingCashout);
    }

}
