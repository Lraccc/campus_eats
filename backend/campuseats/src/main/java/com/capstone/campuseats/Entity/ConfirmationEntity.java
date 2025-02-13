package com.capstone.campuseats.Entity;


import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

@NoArgsConstructor
@Setter
@Getter
@Document(collection = "confirmations")
@Data
public class ConfirmationEntity {

    @Id
    private String id;
    private String token;

    @CreatedDate
    private LocalDateTime createdDate;
    private UserEntity user;

    public ConfirmationEntity(UserEntity user) {
        this.user = user;
        this.createdDate = LocalDateTime.now();
        this.token = UUID.randomUUID().toString();
    }
}
