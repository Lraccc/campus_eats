package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AddOn {
    private String name;
    private float price;

    // Manual getters
    public String getName() {
        return name;
    }

    public float getPrice() {
        return price;
    }

    // Manual setters
    public void setName(String name) {
        this.name = name;
    }

    public void setPrice(float price) {
        this.price = price;
    }
}
