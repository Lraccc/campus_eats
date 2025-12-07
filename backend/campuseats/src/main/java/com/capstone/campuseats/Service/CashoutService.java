package com.capstone.campuseats.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import com.capstone.campuseats.config.ApplicationContextProvider;

import jakarta.annotation.PostConstruct;

@Service
public class CashoutService {

    private final CashoutRepository cashoutRepository;
    private final ShopService shopService;
    private final DasherService dasherService;

    @Autowired
    public CashoutService(CashoutRepository cashoutRepository, ShopService shopService, DasherService dasherService) {
        this.cashoutRepository = cashoutRepository;
        this.shopService = shopService;
        this.dasherService = dasherService;
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
            String previousStatus = cashout.getStatus();
            
            // Only process status change if it's different from previous status
            if (!status.equals(previousStatus)) {
                cashout.setStatus(status);
                cashoutRepository.save(cashout);
                
                // If cashout is rejected, refund the amount back to wallet
                if ("rejected".equals(status) && "pending".equals(previousStatus)) {
                    try {
                        String userId = cashout.getUserId();
                        if (userId != null) {
                            // Add the amount back to the wallet (refund)
                            boolean refunded = shopService.updateShopWalletForCashout(userId, -cashout.getAmount());
                            
                            if (!refunded) {
                                refunded = dasherService.updateDasherWalletForCashout(userId, -cashout.getAmount());
                                if (refunded) {
                                    System.out.println("✅ Dasher wallet refunded: ₱" + cashout.getAmount() + " (Cashout rejected)");
                                } else {
                                    System.err.println("⚠️ Failed to refund wallet for rejected cashout: " + cashoutId);
                                }
                            } else {
                                System.out.println("✅ Shop wallet refunded: ₱" + cashout.getAmount() + " (Cashout rejected)");
                            }
                        } else {
                            System.err.println("No userId found for cashout: " + cashoutId);
                        }
                    } catch (Exception e) {
                        System.err.println("Error refunding wallet: " + e.getMessage());
                        e.printStackTrace();
                    }
                }
                // If accepted, wallet was already deducted during creation, so no action needed
                else if ("accepted".equals(status)) {
                    System.out.println("✅ Cashout accepted: " + cashoutId + " (Wallet already deducted during request)");
                }
            }
            return true;
        }
        return false;
    }

    public CashoutEntity updateCashoutReference(String cashoutId, String referenceNumber) {
        Optional<CashoutEntity> cashoutOptional = cashoutRepository.findById(cashoutId);
        if (cashoutOptional.isPresent()) {
            CashoutEntity cashout = cashoutOptional.get();
            cashout.setReferenceNumber(referenceNumber);
            cashout.setPaidAt(Instant.now());
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
            cashout.setCreatedAt(Instant.now());
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.systemDefault());
        String formattedTimestamp = formatter.format(cashout.getCreatedAt());
        
        // Generate a unique ID for each cashout request to maintain transaction history
        // Format: userId_timestamp
        String uniqueCashoutId = userId + "_" + formattedTimestamp;
        String sanitizedCashoutName = "cashout/" + formattedTimestamp + "_" + userId;

        BlobClient blobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedCashoutName);

        blobClient.upload(image.getInputStream(), image.getSize(), true);

        // Set a unique ID for each cashout while preserving the user ID association
        cashout.setId(uniqueCashoutId);
        cashout.setUserId(userId); // Store the shop/user ID in the new field
        String qrURL = blobClient.getBlobUrl();
        cashout.setStatus("pending");
        cashout.setGcashQr(qrURL);
        cashout.setCreatedAt(Instant.now());
        
        // Immediately deduct from wallet when cashout is requested (before admin approval)
        // This ensures wallet reflects real-time balance
        try {
            boolean updated = shopService.updateShopWalletForCashout(userId, cashout.getAmount());
            if (!updated) {
                updated = dasherService.updateDasherWalletForCashout(userId, cashout.getAmount());
                if (updated) {
                    System.out.println("✅ Dasher wallet immediately deducted: ₱" + cashout.getAmount() + " (Status: pending)");
                } else {
                    System.err.println("⚠️ Failed to deduct wallet for cashout request: " + uniqueCashoutId);
                }
            } else {
                System.out.println("✅ Shop wallet immediately deducted: ₱" + cashout.getAmount() + " (Status: pending)");
            }
        } catch (Exception e) {
            System.err.println("❌ Error deducting wallet on cashout request: " + e.getMessage());
            e.printStackTrace();
        }
        
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

    // Get all cashouts by user ID
    public List<CashoutEntity> getCashoutsByUserId(String userId) {
        // Get cashouts using both new and legacy methods for backward compatibility
        List<CashoutEntity> newCashouts = cashoutRepository.findByUserId(userId);
        List<CashoutEntity> legacyCashouts = cashoutRepository.findByIdStartingWith(userId);
        
        // Combine results, avoiding duplicates
        for (CashoutEntity legacyCashout : legacyCashouts) {
            // Skip if this cashout already has a userId set (should be in newCashouts)
            if (legacyCashout.getUserId() == null) {
                newCashouts.add(legacyCashout);
            }
        }
        
        return newCashouts;
    }
    
    // Update cashout
    public CashoutEntity updateCashout(String id, CashoutEntity cashout, MultipartFile image, String userId)
            throws IOException {

        // Find the existing cashout entity by ID
        CashoutEntity existingCashout = cashoutRepository.findById(id)
                .orElseThrow(() -> new CustomException("Cashout not found with ID: " + id));

        // If an image is provided, update the image
        if (image != null && !image.isEmpty()) {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.systemDefault());
            String formattedTimestamp = formatter.format(Instant.now());
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
