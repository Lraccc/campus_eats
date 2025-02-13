package com.capstone.campuseats.Service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.capstone.campuseats.Entity.ItemEntity;
import com.capstone.campuseats.Entity.ShopEntity;
import com.capstone.campuseats.Repository.ItemRepository;
import com.capstone.campuseats.Repository.ShopRepository;
import com.capstone.campuseats.config.CustomException;
import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ItemService {

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;


    @PostConstruct
    public void init() {
        blobServiceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
    }

    public List<ItemEntity> getAllItems() {
        return itemRepository.findAll();
    }

    public Optional<ItemEntity> getItemById(String id) {
        return itemRepository.findById(id);
    }

    public ItemEntity createItem(ItemEntity item, MultipartFile image, String shopId) throws IOException {
        // Validate that the shop exists
        Optional<ShopEntity> optionalShop = shopRepository.findById(shopId);
        if (optionalShop.isEmpty()) {
            throw new CustomException("Shop not found.");
        }

        // Check if item with the same name already exists in the shop
        List<ItemEntity> existingItems = itemRepository.findByNameAndShopId(item.getName(), shopId);
        if (!existingItems.isEmpty()) {
            throw new CustomException("An item with this name already exists.");
        }

        // Set shopId to the item
        item.setShopId(shopId);

        // Ensure createdAt is set
        if (item.getCreatedAt() == null) {
            item.setCreatedAt(LocalDateTime.now());
        }

        // Handle image upload
        if (image != null) {
            // Format the timestamp
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = item.getCreatedAt().format(formatter);

            // Sanitize item name (optional)
            String sanitizedItemName = item.getName().replaceAll("[^a-zA-Z0-9-_\\.]", "_");

            // Create the blob filename
            String blobFilename = "shop/items/" + shopId + "/" + sanitizedItemName + ".png";

            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(blobFilename);

            blobClient.upload(image.getInputStream(), image.getSize(), true);

            String imageUrl = blobClient.getBlobUrl();
            item.setImageUrl(imageUrl);
        }
        String stringId = UUID.randomUUID().toString();
        item.setId(stringId);

        return itemRepository.save(item);
    }

    public ItemEntity updateItem(String itemId, ItemEntity item, MultipartFile image) throws IOException {
        Optional<ItemEntity> optionalItem = itemRepository.findById(itemId);
        if (optionalItem.isEmpty()) {
            throw new CustomException("Item not found.");
        }

        ItemEntity existingItem = optionalItem.get();

        // Validate that the shop exists
        Optional<ShopEntity> optionalShop = shopRepository.findById(existingItem.getShopId());
        if (optionalShop.isEmpty()) {
            throw new CustomException("Shop not found.");
        }

        // Handle image upload if new image is provided

        if (image != null) {
            // Format the timestamp
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = LocalDateTime.now().format(formatter);

            // Sanitize item name (optional)
            String sanitizedItemName = item.getName().replaceAll("[^a-zA-Z0-9-_\\.]", "_");

            // Create the blob filename
            String blobFilename = "shop/items/" + existingItem.getShopId() + "/" + sanitizedItemName + ".png";

            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(blobFilename);

            blobClient.upload(image.getInputStream(), image.getSize(), true);

            String imageUrl = blobClient.getBlobUrl();
            existingItem.setImageUrl(imageUrl);
            System.out.println("new image: "+imageUrl);
            System.out.println("old image: "+existingItem.getImageUrl());
        }else {
            System.out.println("hi");
        }

        // Update the item fields
        existingItem.setName(item.getName());
        existingItem.setQuantity(item.getQuantity());
        existingItem.setDescription(item.getDescription());
        existingItem.setCategories(item.getCategories());
        existingItem.setPrice(item.getPrice());
        return itemRepository.save(existingItem);
    }
    public List<ItemEntity> getItemsByShopId(String shopId) {
        return itemRepository.findByShopIdAndQuantityGreaterThan(shopId, 0);
    }
}
