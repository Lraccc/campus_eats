package com.capstone.campuseats.Entity;


import lombok.*;
import lombok.experimental.SuperBuilder;
import org.bson.types.Binary;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

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
}
