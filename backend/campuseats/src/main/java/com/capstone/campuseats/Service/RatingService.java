package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.RatingEntity;
import com.capstone.campuseats.Repository.RatingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RatingService {

    private final RatingRepository ratingRepository;

    public List<RatingEntity> getAllRatings() {
        return ratingRepository.findAll();
    }

    // Update this method to fetch ratings based on dasherId
    public List<RatingEntity> getRatingsByDasherId(String dasherId) {
        return ratingRepository.findByDasherId(dasherId);
    }

    public List<RatingEntity> getAllShopRatings() {
        return ratingRepository.findByType("shop");
    }

    public List<RatingEntity> getAllDasherRatings() {
        return ratingRepository.findByType("dasher");
    }

    public ResponseEntity<?> saveDasherRating(RatingEntity ratingEntity) {
        // Check for required fields and validity
        if (ratingEntity.getDasherId() == null || ratingEntity.getRate() < 1 || ratingEntity.getRate() > 5) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Dasher ID and a valid rating (1-5) are required"));
        }

        // Check if a rating for the same order ID and type "dasher" already exists
        List<RatingEntity> existingRatings = ratingRepository.findByOrderIdAndType(ratingEntity.getOrderId(), "dasher");
        if (!existingRatings.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Rating for this order ID and type 'dasher' already exists"));
        }

        // Generate a new ID for the rating and set its type
        String stringId = UUID.randomUUID().toString();
        ratingEntity.setId(stringId);
        ratingEntity.setType("dasher");

        // Save the rating and return the saved entity
        RatingEntity savedRating = ratingRepository.save(ratingEntity);
        return ResponseEntity.ok(savedRating);
    }


    public ResponseEntity<?> saveShopRating(RatingEntity ratingEntity) {
        // Check for required fields and validity
        if (ratingEntity.getShopId() == null || ratingEntity.getRate() < 1 || ratingEntity.getRate() > 5) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Shop ID and a valid rating (1-5) are required"));
        }

        // Check if a rating for the same order ID and type "shop" already exists
        List<RatingEntity> existingRatings = ratingRepository.findByOrderIdAndType(ratingEntity.getOrderId(), "shop");
        if (!existingRatings.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Rating for this order ID and type 'shop' already exists"));
        }

        // Generate a new ID for the rating and set its type
        String stringId = UUID.randomUUID().toString();
        ratingEntity.setId(stringId);
        ratingEntity.setType("shop");

        // Save the rating and return the saved entity
        RatingEntity savedRating = ratingRepository.save(ratingEntity);
        return ResponseEntity.ok(savedRating);
    }

    public List<RatingEntity> getRatingsByShopId(String shopId) {
        return ratingRepository.findByShopId(shopId);
    }


}
