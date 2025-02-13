package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.ReimburseEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReimburseRepository extends MongoRepository<ReimburseEntity, String> {
    Optional<ReimburseEntity> findById(String uid);
    List<ReimburseEntity> findByStatus(String status);
    List<ReimburseEntity> findByStatusNot(String status);
    Optional<ReimburseEntity> findByOrderId(String orderId);
}