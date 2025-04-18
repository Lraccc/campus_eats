package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.DasherEntity;
import com.capstone.campuseats.Entity.ItemEntity;
import com.capstone.campuseats.Entity.ShopEntity;
import com.capstone.campuseats.Service.ItemService;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.DataInput;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/items")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class ItemController {

    @Autowired
    private ItemService itemService;

    @GetMapping
    public ResponseEntity<List<ItemEntity>> getAllItems() {
        return new ResponseEntity<>(itemService.getAllItems(), HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Optional<ItemEntity>> getItemById(@PathVariable String id) {
        return new ResponseEntity<>(itemService.getItemById(id), HttpStatus.OK);
    }

    @PostMapping("/shop-add-item/{shopId}")
    public ResponseEntity<?> addItemToShop(
            @RequestPart("shopId") String shopIdStr,
            @RequestPart("item") String itemStr,
            @RequestPart(value = "image", required = false) MultipartFile image) throws IOException {

        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            ItemEntity item = mapper.readValue(itemStr, ItemEntity.class);
            String shopId = new String(shopIdStr);
            ItemEntity createdItem = itemService.createItem(item, image, shopId);
            return new ResponseEntity<>(createdItem, HttpStatus.CREATED);

        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.BAD_REQUEST);
        }
    }

    @PutMapping("/shop-update-item/{itemId}")
    public ResponseEntity<?> updateItem(
            @PathVariable String itemId,
            @RequestPart("item") String itemStr,
            @RequestPart(value = "image", required = false) MultipartFile image) {

        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            ItemEntity item = mapper.readValue(itemStr, ItemEntity.class);
            ItemEntity updatedItem = itemService.updateItem(itemId, item, image);
            return new ResponseEntity<>(Map.of("message", "Item updated successfully", "itemId", updatedItem.getId().toString()), HttpStatus.OK);

        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/{shopId}/shop-items")
    public ResponseEntity<?> getItemsByShopId(@PathVariable String shopId) {
        try {
            List<ItemEntity> items = itemService.getItemsByShopId(shopId);
            if (items.isEmpty()) {
                return new ResponseEntity<>(Map.of("error", "No items found for this shop"), HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(items, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", "Internal Server Error"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
