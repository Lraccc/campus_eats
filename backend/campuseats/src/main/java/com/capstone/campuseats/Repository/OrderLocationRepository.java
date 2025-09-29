package com.capstone.campuseats.Repository;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.capstone.campuseats.Entity.OrderLocationEntity;

@Repository
public interface OrderLocationRepository extends MongoRepository<OrderLocationEntity, String> {
    Optional<OrderLocationEntity> findByOrderIdAndUserType(String orderId, String userType);
}