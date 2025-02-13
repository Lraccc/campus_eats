package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.UserEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<UserEntity, String> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmailIgnoreCase(String email);

    List<UserEntity> findByAccountTypeAndIsBannedAndIsVerified(String accountType, boolean isBanned, boolean isVerified);

}
