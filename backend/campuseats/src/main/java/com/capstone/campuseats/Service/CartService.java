package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.CartEntity;
import com.capstone.campuseats.Entity.CartItem;
import com.capstone.campuseats.Entity.ItemEntity;
import com.capstone.campuseats.Repository.CartRepository;
import com.capstone.campuseats.Repository.ItemRepository;
import com.capstone.campuseats.Repository.ShopRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;

@Service
public class CartService {

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private ItemRepository itemRepository;

    public Optional<CartEntity> getCartByUserId(String uid) {
        return cartRepository.findById(uid);
    }


    public CartEntity addItemToCart(String uid, CartItem newItem, float totalPrice, String shopId) {
        Optional<CartEntity> optionalCart = cartRepository.findById(uid);
        CartEntity cart;

        if (optionalCart.isEmpty()) {
            // If cart doesn't exist, create a new one
            cart = CartEntity.builder()
                    .id(uid)
                    .shopId(shopId)
                    .items(new ArrayList<>())
                    .totalPrice(0)
                    .build();
        } else {
            // If cart exists, get its data
            cart = optionalCart.get();

            // Check if the shop ID of the item matches the shop ID of the cart
            if (!cart.getShopId().equals(shopId)) {
                throw new RuntimeException("Item is from a different shop");
            }
        }

        int newItemIndex = -1;
        for (int i = 0; i < cart.getItems().size(); i++) {
            if (cart.getItems().get(i).getItemId().equals(newItem.getItemId())) {
                newItemIndex = i;
                break;
            }
        }

        if (newItemIndex != -1) {
            // If the item already exists, just update the quantity
            CartItem existingItem = cart.getItems().get(newItemIndex);
            existingItem.setQuantity(existingItem.getQuantity() + newItem.getQuantity());
            existingItem.setPrice(existingItem.getPrice() + (newItem.getQuantity() * existingItem.getUnitPrice()));
        } else {
            // If the item does not exist, add it to the items array
            cart.getItems().add(newItem);
        }

        cart.setTotalPrice(cart.getTotalPrice() + totalPrice);
        return cartRepository.save(cart);
    }


    public CartEntity updateCartItem(String uid, String itemId, String action) {
        Optional<CartEntity> optionalCart = cartRepository.findById(uid);
        if (optionalCart.isEmpty()) {
            throw new RuntimeException("Cart not found");
        }

        CartEntity cart = optionalCart.get();
        Optional<CartItem> optionalItem = cart.getItems().stream()
                .filter(item -> item.getItemId().equals(itemId))
                .findFirst();

        if (optionalItem.isEmpty()) {
            throw new RuntimeException("Item not found in cart");
        }

        CartItem updatedItem = optionalItem.get();
        if ("increase".equals(action)) {
            Optional<ItemEntity> itemEntityOptional = itemRepository.findById(itemId);
            if (itemEntityOptional.isEmpty() || updatedItem.getQuantity() >= itemEntityOptional.get().getQuantity()) {
                throw new RuntimeException("Quantity limit reached");
            }
            updatedItem.setQuantity(updatedItem.getQuantity() + 1);
            updatedItem.setPrice(updatedItem.getPrice() + updatedItem.getUnitPrice());
        } else if ("decrease".equals(action)) {
            if (updatedItem.getQuantity() > 1) {
                updatedItem.setQuantity(updatedItem.getQuantity() - 1);
                updatedItem.setPrice(updatedItem.getPrice() - updatedItem.getUnitPrice());
            } else {
                cart.getItems().remove(updatedItem);
            }
        } else if ("remove".equals(action)) {
            cart.getItems().remove(updatedItem);
        } else {
            throw new RuntimeException("Invalid action");
        }

        if (cart.getItems().isEmpty()) {
            cartRepository.delete(cart);
            return cart;
        }

        cart.setTotalPrice(cart.getItems().stream().map(CartItem::getPrice).reduce(0f, Float::sum));

        return cartRepository.save(cart);
    }

    public void removeCart(String uid) {
        cartRepository.deleteById(uid);
    }
}