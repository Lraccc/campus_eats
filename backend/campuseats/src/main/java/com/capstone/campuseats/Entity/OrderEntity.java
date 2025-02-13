package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

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

}
