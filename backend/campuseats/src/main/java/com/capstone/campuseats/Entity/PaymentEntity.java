package com.capstone.campuseats.Entity;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Document(collection = "payments")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class PaymentEntity {
    @Id
    private String id;
    private String orderId;
    private String dasherId;
    private String shopId;
    private String userId;
    private String paymentMethod;
    private float deliveryFee;
    private float totalPrice;
    private List<CartItem> items;
    private LocalDateTime completedAt;

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

    public String getShopId() {
        return shopId;
    }

    public String getUserId() {
        return userId;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public float getDeliveryFee() {
        return deliveryFee;
    }

    public float getTotalPrice() {
        return totalPrice;
    }

    public List<CartItem> getItems() {
        return items;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
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

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public void setDeliveryFee(float deliveryFee) {
        this.deliveryFee = deliveryFee;
    }

    public void setTotalPrice(float totalPrice) {
        this.totalPrice = totalPrice;
    }

    public void setItems(List<CartItem> items) {
        this.items = items;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
