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
import java.util.List;
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

    // Add item to a specific shop within the user's cart. Create shop entry if missing.
    public CartEntity addItemToCart(String uid, CartItem newItem, float totalPrice, String shopId) {
        Optional<CartEntity> optionalCart = cartRepository.findById(uid);
        CartEntity cart;

    if (optionalCart.isEmpty()) {
        // Create new cart entity using builder
        cart = CartEntity.builder()
            .id(uid)
            .shops(new ArrayList<>())
            .build();
        } else {
            cart = optionalCart.get();
            if (cart.getShops() == null) cart.setShops(new ArrayList<>());
        }

        // Find or create the shop cart
        CartEntity.ShopCart targetShopCart = null;
        for (CartEntity.ShopCart sc : cart.getShops()) {
            if (sc.getShopId().equals(shopId)) {
                targetShopCart = sc;
                break;
            }
        }

        if (targetShopCart == null) {
            targetShopCart = new CartEntity.ShopCart(shopId, new ArrayList<>(), 0f);
            cart.getShops().add(targetShopCart);
        }

        // Merge or add item inside shop cart
        int newItemIndex = -1;
        for (int i = 0; i < targetShopCart.getItems().size(); i++) {
            if (targetShopCart.getItems().get(i).getItemId().equals(newItem.getItemId())) {
                newItemIndex = i;
                break;
            }
        }

        if (newItemIndex != -1) {
            CartItem existingItem = targetShopCart.getItems().get(newItemIndex);
            existingItem.setQuantity(existingItem.getQuantity() + newItem.getQuantity());
            existingItem.setPrice(existingItem.getPrice() + (newItem.getQuantity() * existingItem.getUnitPrice()));
        } else {
            targetShopCart.getItems().add(newItem);
        }

        targetShopCart.setTotalPrice(targetShopCart.getTotalPrice() + totalPrice);

        return cartRepository.save(cart);
    }

    // Update an item across shop carts (find item by itemId)
    public CartEntity updateCartItem(String uid, String itemId, String action) {
        Optional<CartEntity> optionalCart = cartRepository.findById(uid);
        if (optionalCart.isEmpty()) {
            throw new RuntimeException("Cart not found");
        }

        CartEntity cart = optionalCart.get();
        if (cart.getShops() == null || cart.getShops().isEmpty()) {
            throw new RuntimeException("Cart is empty");
        }

        CartEntity.ShopCart foundShopCart = null;
        CartItem updatedItem = null;

        for (CartEntity.ShopCart sc : cart.getShops()) {
            Optional<CartItem> opt = sc.getItems().stream()
                    .filter(it -> it.getItemId().equals(itemId))
                    .findFirst();
            if (opt.isPresent()) {
                foundShopCart = sc;
                updatedItem = opt.get();
                break;
            }
        }

        if (updatedItem == null) {
            throw new RuntimeException("Item not found in any shop cart");
        }

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
                foundShopCart.getItems().remove(updatedItem);
            }
        } else if ("remove".equals(action)) {
            foundShopCart.getItems().remove(updatedItem);
        } else {
            throw new RuntimeException("Invalid action");
        }

        // Recompute shop subtotal or remove empty shop
        if (foundShopCart.getItems().isEmpty()) {
            cart.getShops().remove(foundShopCart);
        } else {
            foundShopCart.setTotalPrice(foundShopCart.getItems().stream().map(CartItem::getPrice).reduce(0f, Float::sum));
        }

        // If cart is empty, delete entity
        if (cart.getShops().isEmpty()) {
            cartRepository.delete(cart);
            return cart;
        }

        return cartRepository.save(cart);
    }

    // Remove entire cart for user
    public void removeCart(String uid) {
        cartRepository.deleteById(uid);
    }

    // Remove a specific shop cart from user's cart
    public CartEntity removeShopFromCart(String uid, String shopId) {
        Optional<CartEntity> optionalCart = cartRepository.findById(uid);
        if (optionalCart.isEmpty()) {
            throw new RuntimeException("Cart not found");
        }

        CartEntity cart = optionalCart.get();
        if (cart.getShops() == null) return cart;

        cart.getShops().removeIf(sc -> sc.getShopId().equals(shopId));

        if (cart.getShops().isEmpty()) {
            cartRepository.delete(cart);
            return cart;
        }

        return cartRepository.save(cart);
    }
}