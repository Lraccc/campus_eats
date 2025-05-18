package com.capstone.campuseats.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Document(collection = "ratings")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class RatingEntity {
    @Id
    private String id;
    private String dasherId;
    private String shopId;
    private String orderId;
    private int rate;
    private String comment;
    private String type;

    // Getters
    public String getId() {
        return id;
    }

    public String getDasherId() {
        return dasherId;
    }

    public String getShopId() {
        return shopId;
    }

    public String getOrderId() {
        return orderId;
    }

    public int getRate() {
        return rate;
    }

    public String getComment() {
        return comment;
    }

    public String getType() {
        return type;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setDasherId(String dasherId) {
        this.dasherId = dasherId;
    }

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public void setRate(int rate) {
        this.rate = rate;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public void setType(String type) {
        this.type = type;
    }
}
