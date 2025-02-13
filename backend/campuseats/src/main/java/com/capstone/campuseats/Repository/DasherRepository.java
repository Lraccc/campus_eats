package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.DasherEntity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DasherRepository extends MongoRepository<DasherEntity, String> {
    List<DasherEntity> findByStatus(String status);
    List<DasherEntity> findByStatusNot(String status);
}
