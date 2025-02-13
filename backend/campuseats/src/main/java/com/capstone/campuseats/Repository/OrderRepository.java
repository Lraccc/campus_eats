package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.OrderEntity;
import com.capstone.campuseats.Entity.ShopEntity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends MongoRepository<OrderEntity, String> {
    List<OrderEntity> findByUid(String uid);
    List<OrderEntity> findByDasherId(String dasherId);
    List<OrderEntity> findByStatusStartingWith(String status);
    List<OrderEntity> findByDasherIdAndStatusStartingWith(String dasherId, String status);
    List<OrderEntity> findByDasherIdAndStatus(String dasherId, String status);

    List<OrderEntity> findByStatus(String status);

}
