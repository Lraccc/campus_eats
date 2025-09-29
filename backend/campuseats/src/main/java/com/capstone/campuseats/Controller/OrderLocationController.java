package com.capstone.campuseats.Controller;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.capstone.campuseats.Entity.OrderLocationEntity;
import com.capstone.campuseats.Repository.OrderLocationRepository;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
public class OrderLocationController {

    private final OrderLocationRepository repository;

    public OrderLocationController(OrderLocationRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/ping")
    public Map<String, String> ping() {
        return Map.of("ok", "true");
    }

    @PostMapping("/{orderId}/location/{userType}")
    public ResponseEntity<?> upsertLocation(
            @PathVariable String orderId,
            @PathVariable String userType,
            @RequestBody Map<String, String> payload
    ) {
        if (!"user".equals(userType) && !"dasher".equals(userType)) {
            return ResponseEntity.badRequest().body(Map.of("error", "userType must be 'user' or 'dasher'"));
        }

        OrderLocationEntity entity = repository
                .findByOrderIdAndUserType(orderId, userType)
                .orElseGet(() -> OrderLocationEntity.newDoc(orderId, userType));

        entity.setLatitude(payload.getOrDefault("latitude", null));
        entity.setLongitude(payload.getOrDefault("longitude", null));
        entity.setHeading(payload.getOrDefault("heading", null));
        entity.setSpeed(payload.getOrDefault("speed", null));
        entity.setAccuracy(payload.getOrDefault("accuracy", null));
        entity.setTimestamp(payload.getOrDefault("timestamp", String.valueOf(System.currentTimeMillis())));
        entity.setUpdatedAt(LocalDateTime.now());

        repository.save(entity);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "orderId", entity.getOrderId(),
                "userType", entity.getUserType()
        ));
    }

    @GetMapping("/{orderId}/location/{userType}")
    public ResponseEntity<?> getLocation(
            @PathVariable String orderId,
            @PathVariable String userType
    ) {
        return repository.findByOrderIdAndUserType(orderId, userType)
                .map(e -> ResponseEntity.ok(Map.of(
                        "orderId", e.getOrderId(),
                        "userType", e.getUserType(),
                        "latitude", e.getLatitude(),
                        "longitude", e.getLongitude(),
                        "heading", e.getHeading(),
                        "speed", e.getSpeed(),
                        "accuracy", e.getAccuracy(),
                        "timestamp", e.getTimestamp()
                )))
                .orElse(ResponseEntity.notFound().build());
    }
}