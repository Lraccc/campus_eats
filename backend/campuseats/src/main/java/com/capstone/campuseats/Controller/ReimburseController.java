package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.ReimburseEntity;
import com.capstone.campuseats.Service.ReimburseService;
import com.capstone.campuseats.config.CustomException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/reimburses")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class ReimburseController {

    private final ReimburseService reimburseService;

    @GetMapping
    public ResponseEntity<List<ReimburseEntity>> getAllReimburses() {
        return new ResponseEntity<>(reimburseService.getAllReimburses(), HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Optional<ReimburseEntity>> getReimburseById(@PathVariable String id) {
        return new ResponseEntity<>(reimburseService.getReimburseById(id), HttpStatus.OK);
    }

    @GetMapping("/pending-lists")
    public ResponseEntity<Map<String, List<ReimburseEntity>>> getReimburses() {
        Map<String, List<ReimburseEntity>> reimbursesMap = reimburseService.getReimburses();
        return new ResponseEntity<>(reimbursesMap, HttpStatus.OK);
    }

    @PostMapping("/create")
    public ResponseEntity<?> createReimburse(
            @RequestPart("reimburse") String reimburseStr,
            @RequestPart("gcashQr") MultipartFile gcashQr,
            @RequestPart("locationProof") MultipartFile locationProof,
            @RequestPart("noShowProof") MultipartFile noShowProof,
            @RequestPart("userId") String userId) throws IOException {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            ReimburseEntity reimburse = mapper.readValue(reimburseStr, ReimburseEntity.class);
            System.out.println("Parsed ReimburseEntity: " + reimburse);

            // Call the service method with the new parameters
            ReimburseEntity createdReimburse = reimburseService.createReimburse(reimburse, gcashQr, locationProof, noShowProof, userId);
            return new ResponseEntity<>(createdReimburse, HttpStatus.CREATED);
        } catch (CustomException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }



    @PutMapping("/update/{reimburseId}/status")
    public ResponseEntity<Boolean> updateReimburseStatus(@PathVariable String reimburseId, @RequestParam String status) {
        boolean isUpdated = reimburseService.updateReimburseStatus(reimburseId, status);
        if (isUpdated) {
            return new ResponseEntity<>(true, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(false, HttpStatus.NOT_FOUND);
        }
    }

    @PutMapping("/update/{reimburseId}/reference")
    public ResponseEntity<ReimburseEntity> updateReimburseReference(
            @PathVariable String reimburseId,
            @RequestParam String referenceNumber) {
        ReimburseEntity updatedReimburse = reimburseService.updateReimburseReference(reimburseId, referenceNumber);
        if (updatedReimburse != null) {
            return new ResponseEntity<>(updatedReimburse, HttpStatus.OK);
        } else {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

}
