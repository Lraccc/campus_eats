package com.capstone.campuseats.Controller;

import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.capstone.campuseats.Entity.CartEntity;
import com.capstone.campuseats.Entity.CartItem;
import com.capstone.campuseats.Service.CartService;

import lombok.RequiredArgsConstructor;


@RestController
@RequestMapping("/api/carts")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed.origins}")
public class CartController {

    private final CartService cartService;

    @GetMapping("/cart")
    public ResponseEntity<?> getCart(@RequestParam String uid, @RequestParam(required = false) String shopId) {
        try {
            if (uid == null || uid.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "Missing user ID"), HttpStatus.BAD_REQUEST);
            }

            String userId = new String(uid);
            Optional<CartEntity> cartOptional = cartService.getCartByUserId(userId);

            if (cartOptional.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "Cart not found"), HttpStatus.NOT_FOUND);
            }

            CartEntity cart = cartOptional.get();

            // If a shopId was provided, return only that shop's cart if present
            if (shopId != null && !shopId.isEmpty()) {
                var shops = cart.getShops();
                if (shops != null) {
                    for (var s : shops) {
                        if (shopId.equals(s.getShopId())) {
                            return new ResponseEntity<>(s, HttpStatus.OK);
                        }
                    }
                }
                return new ResponseEntity<>(Map.of("error", "Shop cart not found"), HttpStatus.NOT_FOUND);
            }

            return new ResponseEntity<>(cart, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/add-to-cart")
    public ResponseEntity<?> addItemToCart(@RequestBody Map<String, Object> payload) {
        try {
            String uid = (String) payload.get("uid");
            String shopId = (String) payload.get("shopId");
            Map<String, Object> itemData = (Map<String, Object>) payload.get("item");

            CartItem newItem = CartItem.builder()
                    .itemId((String) itemData.get("id"))
                    .name((String) itemData.get("name"))
                    .unitPrice(Float.parseFloat(itemData.get("price").toString()))
                    .price(Float.parseFloat(itemData.get("price").toString())
                            * Integer.parseInt(itemData.get("userQuantity").toString()))
                    .quantity(Integer.parseInt(itemData.get("userQuantity").toString()))
                    .itemQuantity(Integer.parseInt(itemData.get("quantity").toString()))
                    .build();

            float totalPrice = Float.parseFloat(payload.get("totalPrice").toString());

            CartEntity updatedCart = cartService.addItemToCart(uid, newItem, totalPrice, shopId);

            return new ResponseEntity<>(
                    Map.of("message", "Item added to cart successfully", "cartId", updatedCart.getId().toString()),
                    HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/update-cart-item")
    public ResponseEntity<?> updateCartItem(@RequestBody Map<String, Object> payload) {
        try {
            String uid = new String((String) payload.get("uid"));
            String itemId = new String((String) payload.get("itemId"));
            String action = (String) payload.get("action");

            CartEntity updatedCart = cartService.updateCartItem(uid, itemId, action);

            return new ResponseEntity<>(Map.of("message", "Cart updated successfully", "cartData", updatedCart),
                    HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/remove-cart")
    public ResponseEntity<?> removeCart(@RequestBody Map<String, Object> payload) {
        try {
            String uid = new String((String) payload.get("uid"));
            Object shopIdObj = payload.get("shopId");

            if (shopIdObj != null && shopIdObj.toString().length() > 0) {
                // Remove only the specified shop's cart
                String shopId = shopIdObj.toString();
                cartService.removeShopFromCart(uid, shopId);
                return new ResponseEntity<>(Map.of("message", "Shop cart removed successfully"), HttpStatus.OK);
            }

            // Remove entire cart
            cartService.removeCart(uid);

            return new ResponseEntity<>(Map.of("message", "Cart removed successfully"), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
