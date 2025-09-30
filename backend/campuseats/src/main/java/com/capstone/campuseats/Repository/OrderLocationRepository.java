package com.capstone.campuseats.Repository;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.capstone.campuseats.Entity.OrderLocation;

@Repository
public interface OrderLocationRepository extends MongoRepository<OrderLocation, String> {
    Optional<OrderLocation> findByOrderIdAndDasherId(String orderId, String dasherId);
    Optional<OrderLocation> findByOrderIdAndUserId(String orderId, String userId);
    Optional<OrderLocation> findByOrderId(String orderId);
    Optional<OrderLocation> findByOrderIdAndUserType(String orderId, String userType);
}