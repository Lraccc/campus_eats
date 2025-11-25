package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.CampusEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CampusRepository extends MongoRepository<CampusEntity, String> {
    
    // Find all active campuses
    List<CampusEntity> findByIsActive(boolean isActive);
    
    // Find campus by admin ID
    Optional<CampusEntity> findByAdminId(String adminId);
    
    // Find campus by name
    Optional<CampusEntity> findByName(String name);
}
