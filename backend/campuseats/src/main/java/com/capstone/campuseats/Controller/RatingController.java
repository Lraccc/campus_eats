package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.OrderEntity;
import com.capstone.campuseats.Entity.RatingEntity;
import com.capstone.campuseats.Repository.RatingRepository;
import com.capstone.campuseats.Service.RatingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/ratings")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class RatingController {
    @Autowired
    private RatingService ratingService;

    private RatingRepository ratingRepository;

    @GetMapping
    public ResponseEntity<List<RatingEntity>> getAllRatings() {
        return new ResponseEntity<List<RatingEntity>>(ratingService.getAllRatings(), HttpStatus.OK);
    }

    @GetMapping("/dasher/{dasherId}")
    public ResponseEntity<List<RatingEntity>> getRatingsByDasherId(@PathVariable String dasherId) {
        List<RatingEntity> ratings = ratingService.getRatingsByDasherId(dasherId);
        return ResponseEntity.ok(ratings);
    }

    @GetMapping("/all-shop-ratings")
    public ResponseEntity<?> getAllShopRatings() {
        try {
            List<RatingEntity> activeRatings = ratingService.getAllShopRatings();

            if (activeRatings.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No ratings found"));
            }

            return ResponseEntity.ok(activeRatings);
        } catch (Exception e) {
            System.err.println("Error fetching ratings: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/all-dasher-ratings")
    public ResponseEntity<?> getAllDasherRatings() {
        try {
            List<RatingEntity> activeRatings = ratingService.getAllDasherRatings();

            if (activeRatings.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No ratings found"));
            }

            return ResponseEntity.ok(activeRatings);
        } catch (Exception e) {
            System.err.println("Error fetching ratings: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Internal Server Error"));
        }
    }

    @PostMapping("/dasher-create")
    public ResponseEntity<?> createDasherRating(@RequestBody RatingEntity ratingEntity) {
        try {
            // Delegate the logic to the service
            return ratingService.saveDasherRating(ratingEntity);
        } catch (Exception e) {
            System.err.println("Error creating dasher rating: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @PostMapping("/shop-create")
    public ResponseEntity<?> createShopRating(@RequestBody RatingEntity ratingEntity) {
        try {
            // Attempt to save the rating and capture the response
            ResponseEntity<?> response = ratingService.saveShopRating(ratingEntity);

            // Return the response directly if it's not null
            if (response != null) {
                return response;
            }

            // If there are no errors, return a created response
            return ResponseEntity.status(HttpStatus.CREATED).body(ratingEntity);
        } catch (Exception e) {
            System.err.println("Error creating shop rating: " + e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal Server Error"));
        }
    }

    @GetMapping("/shop/{shopId}")
    public List<RatingEntity> getRatingsByShopId(@PathVariable String shopId) {
        return ratingService.getRatingsByShopId(shopId);
    }


}
