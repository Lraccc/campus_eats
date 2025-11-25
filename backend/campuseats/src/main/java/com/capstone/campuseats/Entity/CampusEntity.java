package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "campuses")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CampusEntity {

    @Id
    private String id;

    private String name; // Campus/School name

    private String address; // Full address

    private double centerLatitude; // Center point for geofence

    private double centerLongitude; // Center point for geofence

    private double geofenceRadius; // Radius in meters

    private String adminId; // Assigned admin user ID

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private LocalDateTime dateCreated = LocalDateTime.now();

    // Manual getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public double getCenterLatitude() {
        return centerLatitude;
    }

    public void setCenterLatitude(double centerLatitude) {
        this.centerLatitude = centerLatitude;
    }

    public double getCenterLongitude() {
        return centerLongitude;
    }

    public void setCenterLongitude(double centerLongitude) {
        this.centerLongitude = centerLongitude;
    }

    public double getGeofenceRadius() {
        return geofenceRadius;
    }

    public void setGeofenceRadius(double geofenceRadius) {
        this.geofenceRadius = geofenceRadius;
    }

    public String getAdminId() {
        return adminId;
    }

    public void setAdminId(String adminId) {
        this.adminId = adminId;
    }

    public boolean isActive() {
        return isActive;
    }
    
    public boolean getIsActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }
    
    public void setIsActive(boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getDateCreated() {
        return dateCreated;
    }

    public void setDateCreated(LocalDateTime dateCreated) {
        this.dateCreated = dateCreated;
    }
}
