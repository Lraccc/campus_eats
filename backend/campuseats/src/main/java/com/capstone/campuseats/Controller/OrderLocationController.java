package com.capstone.campuseats.Controller;

import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.capstone.campuseats.Entity.OrderLocation;
import com.capstone.campuseats.Repository.OrderLocationRepository;

@RestController
@RequestMapping("/api/orders")
public class OrderLocationController {

    private final OrderLocationRepository repository;

    public OrderLocationController(OrderLocationRepository repository) {
        this.repository = repository;
    }

    // Unified POST: /{orderId}/location/{userType}
    // @PostMapping("/{orderId}/location/{userType}")
    // public ResponseEntity<?> upsertLocation(
    //         @PathVariable String orderId,
    //         @PathVariable String userType,
    //         @RequestBody Map<String, Object> payload
    // ) {
    //     try {
    //         Double latitude = Double.valueOf(payload.get("latitude").toString());
    //         Double longitude = Double.valueOf(payload.get("longitude").toString());

    //         Optional<OrderLocation> existing = repository.findByOrderIdAndUserType(orderId, userType);
    //         OrderLocation loc = existing.orElseGet(() -> new OrderLocation(orderId, latitude, longitude, userType));
    //         loc.setLatitude(latitude);
    //         loc.setLongitude(longitude);
    //         loc.setUserType(userType);
    //         repository.save(loc);

    //         return ResponseEntity.ok(Map.of(
    //                 "orderId", orderId,
    //                 "userType", userType,
    //                 "latitude", latitude,
    //                 "longitude", longitude,
    //                 "status", "updated"
    //         ));
    //     } catch (Exception e) {
    //         return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    //     }
    // }

    // Unified GET: /{orderId}/location/{userType}
    @GetMapping("/{orderId}/location/{userType}")
    public ResponseEntity<?> getLocationByType(
            @PathVariable String orderId,
            @PathVariable String userType
    ) {
        Optional<OrderLocation> locationOpt = repository.findByOrderIdAndUserType(orderId, userType);
        if (locationOpt.isPresent()) {
            OrderLocation loc = locationOpt.get();
            return ResponseEntity.ok(Map.of(
                    "orderId", loc.getOrderId(),
                    "userType", loc.getUserType(),
                    "latitude", loc.getLatitude(),
                    "longitude", loc.getLongitude()
            ));
        }
        return ResponseEntity.status(404).body(Map.of(
                "message", userType + " location not found for orderId=" + orderId
        ));
    }

    // Back-compat routes delegate to unified ones
    @PostMapping("/{orderId}/location/user")
    public ResponseEntity<?> updateUserLocation(@PathVariable String orderId, @RequestBody Map<String, Object> payload) {
        return upsertLocation(orderId, "user", payload);
    }

    @PostMapping("/{orderId}/location/dasher")
    public ResponseEntity<?> updateDasherLocation(@PathVariable String orderId, @RequestBody Map<String, Object> payload) {
        return upsertLocation(orderId, "dasher", payload);
    }

    @GetMapping("/{orderId}/location/user")
    public ResponseEntity<?> getUserLocation(@PathVariable String orderId) {
        return getLocationByType(orderId, "user");
    }

    @GetMapping("/{orderId}/location/dasher")
    public ResponseEntity<?> getDasherLocation(@PathVariable String orderId) {
        return getLocationByType(orderId, "dasher");
    }
}