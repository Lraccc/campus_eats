package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "items")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class ItemEntity {
    @Id
    private String id;
    private String shopId;
    private String name;
    private int quantity;
    private String description;
    private List<String> categories;
    private float price;
    private String imageUrl;
    private LocalDateTime createdAt;
}
