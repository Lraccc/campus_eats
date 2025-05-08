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

@Document(collection = "reimbursements")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class ReimburseEntity {
    @Id
    private String id;
    private String orderId;
    private String dasherId;
    private String status;
    private String gcashQr;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private String referenceNumber;
    private String locationProof;
    private String noShowProof;
    private double amount;
    private LocalDateTime paidAt;

    // Getters
    public String getId() {
        return id;
    }

    public String getOrderId() {
        return orderId;
    }

    public String getDasherId() {
        return dasherId;
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

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public String getLocationProof() {
        return locationProof;
    }

    public String getNoShowProof() {
        return noShowProof;
    }

    public double getAmount() {
        return amount;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public void setDasherId(String dasherId) {
        this.dasherId = dasherId;
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

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public void setLocationProof(String locationProof) {
        this.locationProof = locationProof;
    }

    public void setNoShowProof(String noShowProof) {
        this.noShowProof = noShowProof;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public void setPaidAt(LocalDateTime paidAt) {
        this.paidAt = paidAt;
    }
}
