package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Entity.OrderLocation;
import com.capstone.campuseats.Repository.OrderLocationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Example test file for OrderLocationController
 * 
 * To use this in the project:
 * 1. Copy to backend/campuseats/src/test/java/com/capstone/campuseats/Controller/OrderLocationControllerTest.java
 * 2. Run: mvn test
 */
@WebMvcTest(OrderLocationController.class)
public class OrderLocationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OrderLocationRepository repository;

    private OrderLocation mockLocation;
    private Map<String, Object> locationPayload;

    @BeforeEach
    void setUp() {
        mockLocation = new OrderLocation("order123", 10.2944327, 123.8812167, "user");
        mockLocation.setId("loc123");

        locationPayload = new HashMap<>();
        locationPayload.put("latitude", 10.2944327);
        locationPayload.put("longitude", 123.8812167);
    }

    @Test
    void testUpsertLocation_Success() throws Exception {
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("user")))
            .thenReturn(Optional.empty());
        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(locationPayload)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderId").value("order123"))
            .andExpect(jsonPath("$.userType").value("user"))
            .andExpect(jsonPath("$.latitude").value(10.2944327))
            .andExpect(jsonPath("$.longitude").value(123.8812167))
            .andExpect(jsonPath("$.status").value("updated"));

        verify(repository, times(1)).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_Update() throws Exception {
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("user")))
            .thenReturn(Optional.of(mockLocation));
        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        Map<String, Object> updatedPayload = new HashMap<>();
        updatedPayload.put("latitude", 11.0);
        updatedPayload.put("longitude", 124.0);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updatedPayload)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.latitude").value(11.0))
            .andExpect(jsonPath("$.longitude").value(124.0));

        verify(repository, times(1)).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_InvalidLatitude_TooHigh() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("latitude", 91.0);  // > 90
        invalidPayload.put("longitude", 120.0);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid latitude")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_InvalidLatitude_TooLow() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("latitude", -91.0);  // < -90
        invalidPayload.put("longitude", 120.0);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid latitude")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_InvalidLongitude_TooHigh() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("latitude", 10.0);
        invalidPayload.put("longitude", 181.0);  // > 180

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid longitude")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_InvalidLongitude_TooLow() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("latitude", 10.0);
        invalidPayload.put("longitude", -181.0);  // < -180

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid longitude")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_MissingLatitude() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("longitude", 120.0);
        // latitude is missing

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Missing required fields")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_MissingLongitude() throws Exception {
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("latitude", 10.0);
        // longitude is missing

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Missing required fields")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testUpsertLocation_InvalidUserType() throws Exception {
        mockMvc.perform(post("/api/orders/order123/location/invalid")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(locationPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid userType")));

        verify(repository, never()).save(any(OrderLocation.class));
    }

    @Test
    void testGetLocationByType_Success() throws Exception {
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("user")))
            .thenReturn(Optional.of(mockLocation));

        mockMvc.perform(get("/api/orders/order123/location/user"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderId").value("order123"))
            .andExpect(jsonPath("$.userType").value("user"))
            .andExpect(jsonPath("$.latitude").value(10.2944327))
            .andExpect(jsonPath("$.longitude").value(123.8812167));
    }

    @Test
    void testGetLocationByType_NotFound() throws Exception {
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("user")))
            .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/orders/order123/location/user"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("location not found")));
    }

    @Test
    void testUpdateDasherLocation_Success() throws Exception {
        OrderLocation dasherLocation = new OrderLocation("order123", 10.0, 120.0, "dasher");
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("dasher")))
            .thenReturn(Optional.empty());
        when(repository.save(any(OrderLocation.class)))
            .thenReturn(dasherLocation);

        mockMvc.perform(post("/api/orders/order123/location/dasher")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(locationPayload)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userType").value("dasher"));
    }

    @Test
    void testGetDasherLocation_Success() throws Exception {
        OrderLocation dasherLocation = new OrderLocation("order123", 10.0, 120.0, "dasher");
        when(repository.findByOrderIdAndUserType(eq("order123"), eq("dasher")))
            .thenReturn(Optional.of(dasherLocation));

        mockMvc.perform(get("/api/orders/order123/location/dasher"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userType").value("dasher"));
    }

    @Test
    void testBoundaryValues_LatitudeMin() throws Exception {
        Map<String, Object> boundaryPayload = new HashMap<>();
        boundaryPayload.put("latitude", -90.0);
        boundaryPayload.put("longitude", 0.0);

        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(boundaryPayload)))
            .andExpect(status().isOk());
    }

    @Test
    void testBoundaryValues_LatitudeMax() throws Exception {
        Map<String, Object> boundaryPayload = new HashMap<>();
        boundaryPayload.put("latitude", 90.0);
        boundaryPayload.put("longitude", 0.0);

        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(boundaryPayload)))
            .andExpect(status().isOk());
    }

    @Test
    void testBoundaryValues_LongitudeMin() throws Exception {
        Map<String, Object> boundaryPayload = new HashMap<>();
        boundaryPayload.put("latitude", 0.0);
        boundaryPayload.put("longitude", -180.0);

        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(boundaryPayload)))
            .andExpect(status().isOk());
    }

    @Test
    void testBoundaryValues_LongitudeMax() throws Exception {
        Map<String, Object> boundaryPayload = new HashMap<>();
        boundaryPayload.put("latitude", 0.0);
        boundaryPayload.put("longitude", 180.0);

        when(repository.save(any(OrderLocation.class)))
            .thenReturn(mockLocation);

        mockMvc.perform(post("/api/orders/order123/location/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(boundaryPayload)))
            .andExpect(status().isOk());
    }
}
