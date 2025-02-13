package com.capstone.campuseats.Repository;


import com.capstone.campuseats.Entity.VerificationCode;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface VerificationCodeRepository extends MongoRepository<VerificationCode, String> {

}
