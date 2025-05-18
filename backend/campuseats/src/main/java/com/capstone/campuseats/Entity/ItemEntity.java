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

    // Getters
    public String getId() {
        return id;
    }

    public String getShopId() {
        return shopId;
    }

    public String getName() {
        return name;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getCategories() {
        return categories;
    }

    public float getPrice() {
        return price;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setCategories(List<String> categories) {
        this.categories = categories;
    }

    public void setPrice(float price) {
        this.price = price;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
