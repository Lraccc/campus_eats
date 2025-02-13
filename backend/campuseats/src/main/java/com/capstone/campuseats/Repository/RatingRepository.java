package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.RatingEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends MongoRepository<RatingEntity, String> {
    Optional<RatingEntity> findById(String id); // Renamed from uid to id
    List<RatingEntity> findByDasherId(String dasherId); // Method to find by dasherId
    List<RatingEntity> findByType(String type);
    List<RatingEntity> findByOrderId(String orderId);

    List<RatingEntity> findByShopId(String shopId);

    List<RatingEntity> findByOrderIdAndType(String orderId, String type);

}
