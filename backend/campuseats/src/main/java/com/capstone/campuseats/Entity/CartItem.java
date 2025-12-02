package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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
    private List<AddOn> selectedAddOns; // New field for selected add-ons

    // Manual builder implementation to replace Lombok's @Builder
    public static CartItemBuilder builder() {
        return new CartItemBuilder();
    }

    // Manual builder class
    public static class CartItemBuilder {
        private String itemId;
        private String name;
        private float unitPrice;
        private float price;
        private int quantity;
        private int itemQuantity;
        private List<AddOn> selectedAddOns;

        public CartItemBuilder itemId(String itemId) {
            this.itemId = itemId;
            return this;
        }

        public CartItemBuilder name(String name) {
            this.name = name;
            return this;
        }

        public CartItemBuilder unitPrice(float unitPrice) {
            this.unitPrice = unitPrice;
            return this;
        }

        public CartItemBuilder price(float price) {
            this.price = price;
            return this;
        }

        public CartItemBuilder quantity(int quantity) {
            this.quantity = quantity;
            return this;
        }

        public CartItemBuilder itemQuantity(int itemQuantity) {
            this.itemQuantity = itemQuantity;
            return this;
        }

        public CartItemBuilder selectedAddOns(List<AddOn> selectedAddOns) {
            this.selectedAddOns = selectedAddOns;
            return this;
        }

        public CartItem build() {
            CartItem item = new CartItem();
            item.setItemId(itemId);
            item.setName(name);
            item.setUnitPrice(unitPrice);
            item.setPrice(price);
            item.setQuantity(quantity);
            item.setItemQuantity(itemQuantity);
            item.setSelectedAddOns(selectedAddOns);
            return item;
        }
    }

    // Manual getters
    public String getItemId() {
        return itemId;
    }

    public String getName() {
        return name;
    }

    public float getUnitPrice() {
        return unitPrice;
    }

    public float getPrice() {
        return price;
    }

    public int getQuantity() {
        return quantity;
    }

    public int getItemQuantity() {
        return itemQuantity;
    }

    public List<AddOn> getSelectedAddOns() {
        return selectedAddOns;
    }

    // Manual setters
    public void setItemId(String itemId) {
        this.itemId = itemId;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setUnitPrice(float unitPrice) {
        this.unitPrice = unitPrice;
    }

    public void setPrice(float price) {
        this.price = price;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public void setItemQuantity(int itemQuantity) {
        this.itemQuantity = itemQuantity;
    }

    public void setSelectedAddOns(List<AddOn> selectedAddOns) {
        this.selectedAddOns = selectedAddOns;
    }
}
