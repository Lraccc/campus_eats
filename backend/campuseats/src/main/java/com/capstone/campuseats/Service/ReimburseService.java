package com.capstone.campuseats.Service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.capstone.campuseats.Entity.DasherEntity;
import com.capstone.campuseats.Entity.ReimburseEntity;
import com.capstone.campuseats.Repository.DasherRepository;
import com.capstone.campuseats.Repository.ReimburseRepository;
import com.capstone.campuseats.config.CustomException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ReimburseService {

    private final ReimburseRepository reimburseRepository;
    private final DasherRepository dasherRepository;

    @Autowired
    public ReimburseService(ReimburseRepository reimburseRepository, DasherRepository dasherRepository) {
        this.reimburseRepository = reimburseRepository;
        this.dasherRepository = dasherRepository;
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

    public List<ReimburseEntity> getAllReimburses(){return reimburseRepository.findAll();}
    public List<ReimburseEntity> getPendingReimburses() {
        return reimburseRepository.findByStatus("pending");
    }
    public List<ReimburseEntity> getNonPendingReimburses() {
        return reimburseRepository.findByStatusNot("pending");
    }

    public Map<String, List<ReimburseEntity>> getReimburses() {
        List<ReimburseEntity> pendingReimburses = getPendingReimburses();
        List<ReimburseEntity> nonPendingReimburses = getNonPendingReimburses();
        Map<String, List<ReimburseEntity>> reimbursesMap = new HashMap<>();
        reimbursesMap.put("pendingReimburses", pendingReimburses);
        reimbursesMap.put("nonPendingReimburses", nonPendingReimburses);
        return reimbursesMap;
    }
    
    public Map<String, List<ReimburseEntity>> getCustomerReports() {
        List<ReimburseEntity> pendingReports = reimburseRepository.findByTypeAndStatus("customer-report", "pending");
        List<ReimburseEntity> processedReports = reimburseRepository.findByTypeAndStatusNot("customer-report", "pending");
        Map<String, List<ReimburseEntity>> reportsMap = new HashMap<>();
        reportsMap.put("pendingReports", pendingReports);
        reportsMap.put("processedReports", processedReports);
        return reportsMap;
    }
    
    public Map<String, List<ReimburseEntity>> getDasherReports() {
        // Get dasher reports (either null type or "dasher-report" type for backward compatibility)
        List<ReimburseEntity> allPending = reimburseRepository.findByStatus("pending");
        List<ReimburseEntity> allProcessed = reimburseRepository.findByStatusNot("pending");
        
        // Filter to exclude customer-report type
        List<ReimburseEntity> pendingDasherReports = allPending.stream()
            .filter(r -> r.getType() == null || !"customer-report".equals(r.getType()))
            .toList();
        List<ReimburseEntity> processedDasherReports = allProcessed.stream()
            .filter(r -> r.getType() == null || !"customer-report".equals(r.getType()))
            .toList();
            
        Map<String, List<ReimburseEntity>> reportsMap = new HashMap<>();
        reportsMap.put("pendingReimburses", pendingDasherReports);
        reportsMap.put("nonPendingReimburses", processedDasherReports);
        return reportsMap;
    }

    public boolean updateReimburseStatus(String reimburseId, String status) {
        Optional<ReimburseEntity> reimburseOptional = reimburseRepository.findById(reimburseId);
        if (reimburseOptional.isPresent()) {
            ReimburseEntity reimburse = reimburseOptional.get();
            reimburse.setStatus(status);
            reimburseRepository.save(reimburse);
            return true;
        }
        return false;
    }

    public ReimburseEntity updateReimburseReference(String reimburseId, String referenceNumber) {
        Optional<ReimburseEntity> reimburseOptional = reimburseRepository.findById(reimburseId);
        if (reimburseOptional.isPresent()) {
            ReimburseEntity reimburse = reimburseOptional.get();
            reimburse.setReferenceNumber(referenceNumber);
            reimburse.setPaidAt(LocalDateTime.now());
            return reimburseRepository.save(reimburse);
        }
        return null; // or throw CustomException if you prefer
    }


    public Optional<ReimburseEntity> getReimburseById(String id) {
        return reimburseRepository.findById(id);
    }
    
    public List<ReimburseEntity> getReimbursesByUserId(String userId) {
        return reimburseRepository.findByUserId(userId);
    }

    public ReimburseEntity createReimburse(ReimburseEntity reimburse, MultipartFile gcashQr, MultipartFile locationProof, MultipartFile noShowProof, String userId) throws IOException {
        // Check for existing reimbursement by orderId
        Optional<ReimburseEntity> existingReimbursement = reimburseRepository.findByOrderId(reimburse.getOrderId());
        if (existingReimbursement.isPresent()) {
            throw new CustomException("A reimbursement with this order ID already exists.");
        }

        if (reimburse.getCreatedAt() == null) {
            reimburse.setCreatedAt(LocalDateTime.now());
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = reimburse.getCreatedAt().format(formatter);
        String sanitizedReimburseName = "reimburse/" + formattedTimestamp + "_" + userId;

        // Upload main image
        BlobClient blobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedReimburseName);
        blobClient.upload(gcashQr.getInputStream(), gcashQr.getSize(), true);

        // Upload location proof image
        String sanitizedLocationProofName = "locationProof/" + formattedTimestamp + "_" + userId;
        BlobClient locationProofBlobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedLocationProofName);
        locationProofBlobClient.upload(locationProof.getInputStream(), locationProof.getSize(), true);

        // Upload no show proof image
        String sanitizedNoShowProofName = "noShowProof/" + formattedTimestamp + "_" + userId;
        BlobClient noShowProofBlobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(sanitizedNoShowProofName);
        noShowProofBlobClient.upload(noShowProof.getInputStream(), noShowProof.getSize(), true);

        // Generate unique ID and set reimburse entity fields
        String stringId = UUID.randomUUID().toString();
        reimburse.setId(stringId);
        String qrURL = blobClient.getBlobUrl();
        reimburse.setStatus("pending");
        reimburse.setGcashQr(qrURL);
        reimburse.setLocationProof(locationProofBlobClient.getBlobUrl());
        reimburse.setNoShowProof(noShowProofBlobClient.getBlobUrl());
        reimburse.setCreatedAt(LocalDateTime.now());

        return reimburseRepository.save(reimburse);
    }
    
    /**
     * Approve dasher no-show compensation and credit dasher wallet
     * @param reimburseId The reimbursement ID
     * @param referenceNumber The GCash reference number for payment tracking
     * @return Updated reimbursement entity or null if not found
     */
    public ReimburseEntity approveDasherCompensation(String reimburseId, String referenceNumber) {
        Optional<ReimburseEntity> reimburseOptional = reimburseRepository.findById(reimburseId);
        
        if (reimburseOptional.isPresent()) {
            ReimburseEntity reimburse = reimburseOptional.get();
            
            // Verify this is a dasher compensation request
            if (reimburse.getDasherId() == null) {
                System.out.println("❌ Cannot approve: No dasher associated with this reimbursement");
                return null;
            }
            
            // Get the dasher
            Optional<DasherEntity> dasherOptional = dasherRepository.findById(reimburse.getDasherId());
            if (!dasherOptional.isPresent()) {
                System.out.println("❌ Cannot approve: Dasher not found with ID: " + reimburse.getDasherId());
                return null;
            }
            
            DasherEntity dasher = dasherOptional.get();
            
            // Credit dasher wallet with the compensation amount
            float compensationAmount = (float) reimburse.getAmount();
            float currentWallet = (float) dasher.getWallet();
            float newBalance = currentWallet + compensationAmount;
            dasher.setWallet(newBalance);
            dasherRepository.save(dasher);
            
            // Update reimbursement status
            reimburse.setStatus("paid");
            reimburse.setReferenceNumber(referenceNumber);
            reimburse.setPaidAt(LocalDateTime.now());
            
            System.out.println("✅ [Admin Approved Dasher No-Show Compensation]");
            System.out.println("   - Reimbursement ID: " + reimburseId);
            System.out.println("   - Dasher ID: " + reimburse.getDasherId());
            System.out.println("   - Compensation Amount: ₱" + compensationAmount);
            System.out.println("   - Dasher New Wallet Balance: ₱" + dasher.getWallet());
            System.out.println("   - Reference Number: " + referenceNumber);
            
            return reimburseRepository.save(reimburse);
        }
        
        System.out.println("❌ Reimbursement not found with ID: " + reimburseId);
        return null;
    }
    
    /**
     * Decline dasher no-show compensation request
     * @param reimburseId The reimbursement ID
     * @return true if successful, false otherwise
     */
    public boolean declineDasherCompensation(String reimburseId) {
        Optional<ReimburseEntity> reimburseOptional = reimburseRepository.findById(reimburseId);
        
        if (reimburseOptional.isPresent()) {
            ReimburseEntity reimburse = reimburseOptional.get();
            reimburse.setStatus("declined");
            reimburseRepository.save(reimburse);
            
            System.out.println("❌ [Admin Declined Dasher No-Show Compensation]");
            System.out.println("   - Reimbursement ID: " + reimburseId);
            System.out.println("   - Dasher ID: " + reimburse.getDasherId());
            System.out.println("   - Amount: ₱" + reimburse.getAmount());
            
            return true;
        }
        
        System.out.println("❌ Reimbursement not found with ID: " + reimburseId);
        return false;
    }

}
