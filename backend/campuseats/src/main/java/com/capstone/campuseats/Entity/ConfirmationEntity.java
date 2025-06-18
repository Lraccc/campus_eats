package com.capstone.campuseats.Entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
        // Ensure we generate a full UUID string without any modifications
        this.token = UUID.randomUUID().toString();
        // Log the generated token for debugging
        System.out.println("Generated verification token: " + this.token);
    }

    // Getters
    public String getId() {
        return id;
    }

    public String getToken() {
        return token;
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    public UserEntity getUser() {
        return user;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    public void setUser(UserEntity user) {
        this.user = user;
    }
}