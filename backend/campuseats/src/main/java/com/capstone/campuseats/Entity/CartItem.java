package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class CartItem {
    private String itemId;
    private String name;
    private float unitPrice;
    private float price;
    private int quantity;
    private int itemQuantity;
}
