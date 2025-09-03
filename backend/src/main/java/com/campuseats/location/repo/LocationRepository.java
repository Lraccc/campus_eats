package com.campuseats.location.repo;

import com.campuseats.location.model.LocationRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface LocationRepository extends MongoRepository<LocationRecord, String> {
  List<LocationRecord> findBySessionId(String sessionId);
}