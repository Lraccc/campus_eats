package com.capstone.campuseats.Entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "order_locations")
@CompoundIndexes({
    @CompoundIndex(name = "order_user_unique", def = "{'orderId': 1, 'userType': 1}", unique = true)
})
public class OrderLocationEntity {
    @Id
    private String id;

    private String orderId;
    private String userType;

    private String latitude;
    private String longitude;
    private String heading;
    private String speed;
    private String accuracy;
    private String timestamp;

    private LocalDateTime updatedAt;

    public OrderLocationEntity() {
        this.id = UUID.randomUUID().toString();
        this.updatedAt = LocalDateTime.now();
    }

    public static OrderLocationEntity newDoc(String orderId, String userType) {
        OrderLocationEntity e = new OrderLocationEntity();
        e.setId(UUID.randomUUID().toString());
        e.setOrderId(orderId);
        e.setUserType(userType);
        e.setUpdatedAt(LocalDateTime.now());
        return e;
    }

    // getters/setters...
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getUserType() { return userType; }
    public void setUserType(String userType) { this.userType = userType; }
    public String getLatitude() { return latitude; }
    public void setLatitude(String latitude) { this.latitude = latitude; }
    public String getLongitude() { return longitude; }
    public void setLongitude(String longitude) { this.longitude = longitude; }
    public String getHeading() { return heading; }
    public void setHeading(String heading) { this.heading = heading; }
    public String getSpeed() { return speed; }
    public void setSpeed(String speed) { this.speed = speed; }
    public String getAccuracy() { return accuracy; }
    public void setAccuracy(String accuracy) { this.accuracy = accuracy; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}