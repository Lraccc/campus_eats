package com.capstone.campuseats.Entity;

import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "carts")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class CartEntity {

    // public static Object builder() {
    // throw new UnsupportedOperationException("Not supported yet.");
    // }

    public static CartEntityBuilder builder() {
        return new CartEntityBuilder();
    }

    // Manual builder class
    public static class CartEntityBuilder {
        private String id;
        private List<ShopCart> shops;

        public CartEntityBuilder id(String id) {
            this.id = id;
            return this;
        }

        public CartEntityBuilder shops(List<ShopCart> shops) {
            this.shops = shops;
            return this;
        }

        public CartEntity build() {
            CartEntity cart = new CartEntity();
            cart.setId(id);
            cart.setShops(shops);
            return cart;
        }
    }

    @Id
    private String id;
    // Multiple shop carts per user
    private List<ShopCart> shops;

    // Inner class to represent per-shop cart data
    public static class ShopCart {
        private String shopId;
        private List<CartItem> items;
        private float totalPrice;

        public ShopCart() {}

        public ShopCart(String shopId, List<CartItem> items, float totalPrice) {
            this.shopId = shopId;
            this.items = items;
            this.totalPrice = totalPrice;
        }

        public String getShopId() { return shopId; }
        public void setShopId(String shopId) { this.shopId = shopId; }

        public List<CartItem> getItems() { return items; }
        public void setItems(List<CartItem> items) { this.items = items; }

        public float getTotalPrice() { return totalPrice; }
        public void setTotalPrice(float totalPrice) { this.totalPrice = totalPrice; }
    }

    // Manual getters
    public String getId() {
        return id;
    }

    public List<ShopCart> getShops() {
        return shops;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setShops(List<ShopCart> shops) {
        this.shops = shops;
    }

}
