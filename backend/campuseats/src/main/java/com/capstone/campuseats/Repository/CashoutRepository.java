package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.CashoutEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CashoutRepository extends MongoRepository<CashoutEntity, String> {
    Optional<CashoutEntity> findById(String uid);
    List<CashoutEntity> findByStatus(String status);
    List<CashoutEntity> findByStatusNot(String status);
    // Legacy method to handle older records
    List<CashoutEntity> findByIdStartingWith(String userId);
    // New method to query by userId field
    List<CashoutEntity> findByUserId(String userId);
}
