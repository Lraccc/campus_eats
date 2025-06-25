package com.capstone.campuseats.Entity;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Document(collection = "cashouts")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class CashoutEntity {
    @Id
    private String id;
    private String userId;  // ID of the shop/user who made this cashout request
    private String status;
    private String gcashQr;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private double amount;
    private String referenceNumber;
    private LocalDateTime paidAt;

    // Getters
    public String getId() {
        return id;
    }
    
    public String getUserId() {
        return userId;
    }

    public String getStatus() {
        return status;
    }

    public String getGcashQr() {
        return gcashQr;
    }

    public String getGcashName() {
        return gcashName;
    }

    public String getGcashNumber() {
        return gcashNumber;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public double getAmount() {
        return amount;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }
    
    public void setUserId(String userId) {
        this.userId = userId;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setGcashQr(String gcashQr) {
        this.gcashQr = gcashQr;
    }

    public void setGcashName(String gcashName) {
        this.gcashName = gcashName;
    }

    public void setGcashNumber(String gcashNumber) {
        this.gcashNumber = gcashNumber;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public void setPaidAt(LocalDateTime paidAt) {
        this.paidAt = paidAt;
    }
}
