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
import com.capstone.campuseats.Repository.DasherRepository;
import com.capstone.campuseats.config.CustomException;

import jakarta.annotation.PostConstruct;

@Service
public class DasherService {

    private final DasherRepository dasherRepository;

    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;

    @Autowired
    public DasherService(DasherRepository dasherRepository) {
        this.dasherRepository = dasherRepository;
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

    public List<DasherEntity> getNonPendingDashers() {
        return dasherRepository.findByStatusNot("pending");
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
            dasher.setWallet(dasher.getWallet() - amountPaid);
            dasherRepository.save(dasher);
            return true;
        }
        return false;
    }

    public DasherEntity createDasher(DasherEntity dasher, MultipartFile image, String userId) throws IOException {
        if (dasherRepository.existsById(userId)) {
            throw new CustomException("Dasher already exists.");
        }

        dasher.setId(userId);

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

}
