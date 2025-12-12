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

@Document(collection = "shops")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class ShopEntity {
    @Id
    private String id;
    private String gcashName;
    private String gcashNumber;
    private List<String> categories;
    private float deliveryFee;
    private String googleLink;
    private String address;
    private String name;
    private String desc;
    private String imageUrl;
    private String timeOpen;
    private String timeClose;
    private String status;
    private LocalDateTime createdAt;
    private double wallet;
    private boolean acceptGCASH;
    private Long completedOrderCount;
    private String streamUrl;
    @lombok.Builder.Default
    private boolean isStreaming = false;
    private String campusId; // Campus/School association
    @lombok.Builder.Default
    private boolean subscriptionStatus = false; // Analytics subscription status

    // Getters
    public String getId() {
        return id;
    }

    public String getGcashName() {
        return gcashName;
    }

    public String getGcashNumber() {
        return gcashNumber;
    }

    public List<String> getCategories() {
        return categories;
    }

    public float getDeliveryFee() {
        return deliveryFee;
    }

    public String getGoogleLink() {
        return googleLink;
    }

    public String getAddress() {
        return address;
    }

    public String getName() {
        return name;
    }

    public String getDesc() {
        return desc;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getTimeOpen() {
        return timeOpen;
    }

    public String getTimeClose() {
        return timeClose;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public double getWallet() {
        return wallet;
    }

    public boolean getAcceptGCASH() {
        return acceptGCASH;
    }

    public boolean isAcceptGCASH() {
        return acceptGCASH;
    }

    public Long getCompletedOrderCount() {
        return completedOrderCount;
    }
    
    public String getStreamUrl() {
        return streamUrl;
    }
    
    public boolean getIsStreaming() {
        return isStreaming;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setGcashName(String gcashName) {
        this.gcashName = gcashName;
    }

    public void setGcashNumber(String gcashNumber) {
        this.gcashNumber = gcashNumber;
    }

    public void setCategories(List<String> categories) {
        this.categories = categories;
    }

    public void setDeliveryFee(float deliveryFee) {
        this.deliveryFee = deliveryFee;
    }

    public void setGoogleLink(String googleLink) {
        this.googleLink = googleLink;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setDesc(String desc) {
        this.desc = desc;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public void setTimeOpen(String timeOpen) {
        this.timeOpen = timeOpen;
    }

    public void setTimeClose(String timeClose) {
        this.timeClose = timeClose;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setWallet(double wallet) {
        this.wallet = wallet;
    }

    public void setAcceptGCASH(boolean acceptGCASH) {
        this.acceptGCASH = acceptGCASH;
    }

    public void setCompletedOrderCount(Long completedOrderCount) {
        this.completedOrderCount = completedOrderCount;
    }
    
    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }
    
    public void setIsStreaming(boolean isStreaming) {
        this.isStreaming = isStreaming;
    }

    public String getCampusId() {
        return campusId;
    }

    public void setCampusId(String campusId) {
        this.campusId = campusId;
    }

    public boolean getSubscriptionStatus() {
        return subscriptionStatus;
    }

    public void setSubscriptionStatus(boolean subscriptionStatus) {
        this.subscriptionStatus = subscriptionStatus;
    }
}
