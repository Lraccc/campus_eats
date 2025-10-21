package com.capstone.campuseats.Controller;

import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.capstone.campuseats.Entity.OrderLocation;
import com.capstone.campuseats.Repository.OrderLocationRepository;

@RestController
@RequestMapping("/api/orders")
public class OrderLocationController {

    private final OrderLocationRepository repository;

    public OrderLocationController(OrderLocationRepository repository) {
        this.repository = repository;
    }

    // Helper: treat placeholders as invalid
    private boolean isInvalidOrderId(String orderId) {
        if (orderId == null) return true;
        String v = orderId.trim();
        if (v.isEmpty()) return true;
        String lower = v.toLowerCase();
        if (lower.equals("orderid") || lower.equals("{orderid}") || lower.equals("null") || lower.equals("undefined")) return true;
        if (v.startsWith("{") && v.endsWith("}")) return true; // any {placeholder}
        return false;
    }

    private String normalizeUserType(String userType) {
        if (userType == null) return null;
        String t = userType.trim().toLowerCase();
        return ("user".equals(t) || "dasher".equals(t)) ? t : null;
    }

    // Unified POST: /{orderId}/location/{userType}
    @PostMapping("/{orderId}/location/{userType}")
    public ResponseEntity<?> upsertLocation(
            @PathVariable String orderId,
            @PathVariable String userType,
            @RequestBody Map<String, Object> payload
    ) {
        if (isInvalidOrderId(orderId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid orderId"));
        }
        String type = normalizeUserType(userType);
        if (type == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid userType (must be 'user' or 'dasher')"));
        }

        try {
            if (payload == null || !payload.containsKey("latitude") || !payload.containsKey("longitude")) {
                return ResponseEntity.badRequest().body(Map.of("error", "latitude and longitude are required"));
            }
            Double latitude = Double.valueOf(payload.get("latitude").toString());
            Double longitude = Double.valueOf(payload.get("longitude").toString());

            Optional<OrderLocation> existing = repository.findByOrderIdAndUserType(orderId, type);
            OrderLocation loc = existing.orElseGet(() -> new OrderLocation(orderId, latitude, longitude, type));
            loc.setLatitude(latitude);
            loc.setLongitude(longitude);
            loc.setUserType(type);
            repository.save(loc);

            return ResponseEntity.ok(Map.of(
                    "orderId", orderId,
                    "userType", type,
                    "latitude", latitude,
                    "longitude", longitude,
                    "status", "updated"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Unified GET: /{orderId}/location/{userType}
    @GetMapping("/{orderId}/location/{userType}")
    public ResponseEntity<?> getLocationByType(
            @PathVariable String orderId,
            @PathVariable String userType
    ) {
        if (isInvalidOrderId(orderId)) {
            // 204 -> clients treat as "null"
            return ResponseEntity.noContent().build();
        }
        String type = normalizeUserType(userType);
        if (type == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid userType (must be 'user' or 'dasher')"));
        }

        Optional<OrderLocation> locationOpt = repository.findByOrderIdAndUserType(orderId, type);
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
                "message", type + " location not found for orderId=" + orderId
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