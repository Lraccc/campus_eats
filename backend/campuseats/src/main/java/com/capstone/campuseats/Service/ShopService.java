package com.capstone.campuseats.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.capstone.campuseats.Entity.OrderEntity;
import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.OrderRepository;
import com.capstone.campuseats.Repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.capstone.campuseats.Entity.ShopEntity;
import com.capstone.campuseats.Repository.ShopRepository;
import com.capstone.campuseats.config.CustomException;

import jakarta.annotation.PostConstruct;

@Service
public class ShopService {
    private final ShopRepository shopRepository;

    private final UserRepository userRepository;

    private final OrderRepository orderRepository;

    @Value("${spring.cloud.azure.storage.blob.container-name}")
    private String containerName;

    @Value("${azure.blob-storage.connection-string}")
    private String connectionString;

    private BlobServiceClient blobServiceClient;

    @Autowired
    public ShopService(ShopRepository shopRepository, UserRepository userRepository, OrderRepository orderRepository) {
        this.shopRepository = shopRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }


    @PostConstruct
    public void init() {
        blobServiceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
    }

    public List<ShopEntity> getAllShops() {
        return shopRepository.findAll();
    }

    public Optional<ShopEntity> getShopById(String id) {
        return shopRepository.findById(id);
    }

    public ShopEntity createShop(ShopEntity shop, MultipartFile image, String userId) throws IOException {
        if (shopRepository.existsById(userId)) {
            throw new CustomException("Shop already exists.");
        }

        shop.setId(userId); // Set shopId to userId

        if (shop.getCreatedAt() == null) {
            shop.setCreatedAt(LocalDateTime.now());
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        String formattedTimestamp = shop.getCreatedAt().format(formatter);
        System.out.println("timestamp: " + formattedTimestamp);

        String sanitizedShopName = shop.getName().replaceAll("[^a-zA-Z0-9-_\\.]", "_");

        String blobFilename = "shop/" + formattedTimestamp + "_" + sanitizedShopName;

        BlobClient blobClient = blobServiceClient
                .getBlobContainerClient(containerName)
                .getBlobClient(blobFilename);

        blobClient.upload(image.getInputStream(), image.getSize(), true);

        String imageUrl = blobClient.getBlobUrl();

        shop.setImageUrl(imageUrl);
        shop.setWallet(0);
        shop.setStatus("pending");
        shop.setCreatedAt(LocalDateTime.now());
        return shopRepository.save(shop);
    }

    public ShopEntity updateShop(String shopId, ShopEntity shop, MultipartFile image) throws IOException {
        Optional<ShopEntity> optionalShop = shopRepository.findById(shopId);
        if (optionalShop.isEmpty()) {
            throw new CustomException("Shop not found.");
        }

        ShopEntity existingShop = optionalShop.get();

        if (image != null) {
            // Format the timestamp
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
            String formattedTimestamp = LocalDateTime.now().format(formatter);
            System.out.println("timestamp: " + formattedTimestamp);
            // Sanitize shop name (optional)
            String sanitizedShopName = shop.getName().replaceAll("[^a-zA-Z0-9-_\\.]", "_");

            // Create the blob filename
            String blobFilename = "shop/" + formattedTimestamp + "_" + sanitizedShopName;

            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(blobFilename);

            blobClient.upload(image.getInputStream(), image.getSize(), true);

            String imageUrl = blobClient.getBlobUrl();
            existingShop.setImageUrl(imageUrl);
        }

        existingShop.setName(shop.getName());
        existingShop.setDesc(shop.getDesc());
        existingShop.setAddress(shop.getAddress());
        existingShop.setGoogleLink(shop.getGoogleLink());
        existingShop.setCategories(shop.getCategories());
        existingShop.setTimeOpen(shop.getTimeOpen());
        existingShop.setTimeClose(shop.getTimeClose());
        existingShop.setGcashName(shop.getGcashName());
        existingShop.setGcashNumber(shop.getGcashNumber());
        existingShop.setAcceptGCASH(shop.isAcceptGCASH());

        return shopRepository.save(existingShop);
    }

    public List<ShopEntity> getActiveShops() {
        return shopRepository.findByStatus("active");
    }

    public List<ShopEntity> getPendingShops() {
        return shopRepository.findByStatus("pending");
    }

    public List<ShopEntity> getNonPendingShops() {
        return shopRepository.findByStatusNot("pending");
    }



    public Map<String, List<ShopEntity>> getShopsList() {
        List<ShopEntity> allPendingShops = getPendingShops();
        List<ShopEntity> allNonPendingShops = getNonPendingShops();

        // Filter out shops whose users are banned
        List<ShopEntity> pendingShops = filterShopsByBannedStatus(allPendingShops);
        List<ShopEntity> nonPendingShops = filterShopsByBannedStatus(allNonPendingShops);

        Map<String, List<ShopEntity>> shopsMap = new HashMap<>();
        shopsMap.put("pendingShops", pendingShops);
        shopsMap.put("nonPendingShops", nonPendingShops);

        return shopsMap;
    }

    private List<ShopEntity> filterShopsByBannedStatus(List<ShopEntity> shops) {
        return shops.stream()
                .filter(shop -> {
                    UserEntity user = userRepository.findById(shop.getId()).orElse(null);
                    return user != null && !user.isBanned();
                })
                .collect(Collectors.toList());
    }


    public boolean updateShopStatus(String shopId, String status) {
        Optional<ShopEntity> shopOptional = shopRepository.findById(shopId);
        if (shopOptional.isPresent()) {
            ShopEntity shop = shopOptional.get();
            shop.setStatus(status);
            shopRepository.save(shop);
            return true;
        }
        return false;
    }

    public boolean updateShopDeliveryFee(String shopId, float deliveryFee) {
        Optional<ShopEntity> shopOptional = shopRepository.findById(shopId);
        if (shopOptional.isPresent()) {
            ShopEntity shop = shopOptional.get();
            shop.setDeliveryFee(deliveryFee);
            shopRepository.save(shop);
            return true;
        }
        return false;
    }

    public boolean updateShopWallet(String shopId, float totalPrice) {
        Optional<ShopEntity> shopOptional = shopRepository.findById(shopId);
        if (shopOptional.isPresent()) {
            ShopEntity shop = shopOptional.get();
            shop.setWallet(shop.getWallet() + totalPrice);
            shopRepository.save(shop);
            return true;
        }
        return false;
    }

    public List<ShopEntity> getTopShopsByCompletedOrders() {
        // Step 1: Fetch all orders and group them by shopId, count the completed orders for each shop
        List<OrderEntity> orders = orderRepository.findAll();

        // Create a map to store the count of completed orders per shopId
        Map<String, Long> shopOrderCountMap = orders.stream()
                .filter(order -> "completed".equals(order.getStatus()))
                .collect(Collectors.groupingBy(OrderEntity::getShopId, Collectors.counting()));

        // Step 2: Fetch all shops and associate them with their completed order count
        List<ShopEntity> shops = shopRepository.findAll();

        // Step 3: For each shop, set the completed orders count (if any)
        shops.forEach(shop -> {
            Long completedOrderCount = shopOrderCountMap.getOrDefault(shop.getId(), 0L);
            // Adding the completed order count as a property in ShopEntity
            shop.setCompletedOrderCount(completedOrderCount);
        });

        // Step 4: Sort the shops based on completed orders count
        shops.sort((shop1, shop2) ->
                Long.compare(shop2.getCompletedOrderCount(), shop1.getCompletedOrderCount()));

        // Step 5: Return the sorted list of shops
        return shops;
    }

}

// public ShopEntity updateShop(ShopEntity shop) {
// return shopRepository.save(shop);
//
// }