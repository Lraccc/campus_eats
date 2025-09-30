package com.capstone.campuseats.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "order_locations")
public class OrderLocation {
    @Id
    private String id; // unique doc id

    @Indexed
    private String orderId;

    @Indexed
    private String userType; // "user" or "dasher"

    private Double latitude;
    private Double longitude;

    // optional identifiers if you need them
    private String userId;
    private String dasherId;

    public OrderLocation() {}

    public OrderLocation(String orderId, Double latitude, Double longitude, String userType) {
        this.orderId = orderId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.userType = userType;
    }

    // getters/setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getDasherId() { return dasherId; }
    public void setDasherId(String dasherId) { this.dasherId = dasherId; }
}