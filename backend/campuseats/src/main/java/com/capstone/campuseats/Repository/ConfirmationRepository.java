package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.ConfirmationEntity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ConfirmationRepository extends MongoRepository<ConfirmationEntity, String> {
    ConfirmationEntity findByToken(String token);
    Optional<ConfirmationEntity> findById(String id);
}
