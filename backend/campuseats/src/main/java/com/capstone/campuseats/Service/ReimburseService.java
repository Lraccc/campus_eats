package com.capstone.campuseats.Service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.capstone.campuseats.Entity.ReimburseEntity;
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

    @Autowired
    public ReimburseService(ReimburseRepository reimburseRepository) {
        this.reimburseRepository = reimburseRepository;
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

}
