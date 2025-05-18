package com.capstone.campuseats.Entity;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "dashers")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DasherEntity {
    @Id
    private String id;
    private LocalTime availableStartTime; // Available time start
    private LocalTime availableEndTime;
    private List<String> daysAvailable;
    private String status;
    private String schoolId;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private double wallet;

    // Getters
    public String getId() {
        return id;
    }

    public LocalTime getAvailableStartTime() {
        return availableStartTime;
    }

    public LocalTime getAvailableEndTime() {
        return availableEndTime;
    }

    public List<String> getDaysAvailable() {
        return daysAvailable;
    }

    public String getStatus() {
        return status;
    }

    public String getSchoolId() {
        return schoolId;
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

    public double getWallet() {
        return wallet;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setAvailableStartTime(LocalTime availableStartTime) {
        this.availableStartTime = availableStartTime;
    }

    public void setAvailableEndTime(LocalTime availableEndTime) {
        this.availableEndTime = availableEndTime;
    }

    public void setDaysAvailable(List<String> daysAvailable) {
        this.daysAvailable = daysAvailable;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setSchoolId(String schoolId) {
        this.schoolId = schoolId;
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

    public void setWallet(double wallet) {
        this.wallet = wallet;
    }
}
