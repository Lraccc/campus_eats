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

@Document(collection = "orders")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class OrderEntity {
    @Id
    private String id;
    private String uid;
    private String status;
    private LocalDateTime createdAt;
    private String dasherId;
    private String shopId;
    private float changeFor;
    private float deliveryFee;
    private String deliverTo;
    private String firstname;
    private String lastname;
    private List<CartItem> items;
    private String mobileNum;
    private String note;
    private String paymentMethod;
    private float totalPrice;
    private float previousNoShowFee;
    private float previousNoShowItems;
    private String noShowProofImage;
    private String customerNoShowProofImage; // Proof image when customer reports dasher no-show
    private String customerNoShowGcashQr; // Customer's GCash QR code for refund when reporting dasher no-show
    private String deliveryProofImage; // Dasher's proof of delivery image
    private String paymentReferenceId; // For Xendit charge ID (ewc_...) or PayMongo payment link ID

    // Getters
    public String getId() {
        return id;
    }

    public String getUid() {
        return uid;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getDasherId() {
        return dasherId;
    }

    public String getShopId() {
        return shopId;
    }

    public float getChangeFor() {
        return changeFor;
    }

    public float getDeliveryFee() {
        return deliveryFee;
    }

    public String getDeliverTo() {
        return deliverTo;
    }

    public String getFirstname() {
        return firstname;
    }

    public String getLastname() {
        return lastname;
    }

    public List<CartItem> getItems() {
        return items;
    }

    public String getMobileNum() {
        return mobileNum;
    }

    public String getNote() {
        return note;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public float getTotalPrice() {
        return totalPrice;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setDasherId(String dasherId) {
        this.dasherId = dasherId;
    }

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public void setChangeFor(float changeFor) {
        this.changeFor = changeFor;
    }

    public void setDeliveryFee(float deliveryFee) {
        this.deliveryFee = deliveryFee;
    }

    public void setDeliverTo(String deliverTo) {
        this.deliverTo = deliverTo;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public void setItems(List<CartItem> items) {
        this.items = items;
    }

    public void setMobileNum(String mobileNum) {
        this.mobileNum = mobileNum;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public void setTotalPrice(float totalPrice) {
        this.totalPrice = totalPrice;
    }
    
    public float getPreviousNoShowFee() {
        return previousNoShowFee;
    }
    
    public void setPreviousNoShowFee(float previousNoShowFee) {
        this.previousNoShowFee = previousNoShowFee;
    }
    
    public float getPreviousNoShowItems() {
        return previousNoShowItems;
    }
    
    public void setPreviousNoShowItems(float previousNoShowItems) {
        this.previousNoShowItems = previousNoShowItems;
    }
    
    public String getNoShowProofImage() {
        return noShowProofImage;
    }
    
    public void setNoShowProofImage(String noShowProofImage) {
        this.noShowProofImage = noShowProofImage;
    }
    
    public String getPaymentReferenceId() {
        return paymentReferenceId;
    }
    
    public void setPaymentReferenceId(String paymentReferenceId) {
        this.paymentReferenceId = paymentReferenceId;
    }
    
    public String getCustomerNoShowProofImage() {
        return customerNoShowProofImage;
    }
    
    public void setCustomerNoShowProofImage(String customerNoShowProofImage) {
        this.customerNoShowProofImage = customerNoShowProofImage;
    }
    
    public String getCustomerNoShowGcashQr() {
        return customerNoShowGcashQr;
    }
    
    public void setCustomerNoShowGcashQr(String customerNoShowGcashQr) {
        this.customerNoShowGcashQr = customerNoShowGcashQr;
    }
    
    public String getDeliveryProofImage() {
        return deliveryProofImage;
    }
    
    public void setDeliveryProofImage(String deliveryProofImage) {
        this.deliveryProofImage = deliveryProofImage;
    }
}
