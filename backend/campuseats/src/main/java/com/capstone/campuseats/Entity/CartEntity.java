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
        private String shopId;
        private List<CartItem> items;
        private float totalPrice;

        public CartEntityBuilder id(String id) {
            this.id = id;
            return this;
        }

        public CartEntityBuilder shopId(String shopId) {
            this.shopId = shopId;
            return this;
        }

        public CartEntityBuilder items(List<CartItem> items) {
            this.items = items;
            return this;
        }

        public CartEntityBuilder totalPrice(float totalPrice) {
            this.totalPrice = totalPrice;
            return this;
        }

        public CartEntity build() {
            CartEntity cart = new CartEntity();
            cart.setId(id);
            cart.setShopId(shopId);
            cart.setItems(items);
            cart.setTotalPrice(totalPrice);
            return cart;
        }
    }

    @Id
    private String id;
    private String shopId;
    private List<CartItem> items;
    private float totalPrice;

    // Manual getters
    public String getId() {
        return id;
    }

    public String getShopId() {
        return shopId;
    }

    public List<CartItem> getItems() {
        return items;
    }

    public float getTotalPrice() {
        return totalPrice;
    }

    // Manual setters
    public void setId(String id) {
        this.id = id;
    }

    public void setShopId(String shopId) {
        this.shopId = shopId;
    }

    public void setItems(List<CartItem> items) {
        this.items = items;
    }

    public void setTotalPrice(float totalPrice) {
        this.totalPrice = totalPrice;
    }

}
