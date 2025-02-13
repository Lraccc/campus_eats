package com.capstone.campuseats.Repository;

import com.capstone.campuseats.Entity.ItemEntity;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends MongoRepository<ItemEntity, String> {
    List<ItemEntity> findByNameAndShopId(String name, String shopId);
    List<ItemEntity> findByShopIdAndQuantityGreaterThan(String shopId, int quantity);
}
