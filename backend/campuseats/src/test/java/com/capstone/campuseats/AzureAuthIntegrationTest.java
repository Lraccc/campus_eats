package com.capstone.campuseats;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AzureAuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtDecoder jwtDecoder;

    @MockBean
    private UserRepository userRepository;

    @Test
    public void testAzureAuthentication_Success() throws Exception {
        // Set up mock JWT decoder
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .claim("sub", "test-subject")
                .claim("email", "test@example.com")
                .claim("name", "Test User")
                .claim("oid", "azure-oid-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
                
        when(jwtDecoder.decode(anyString())).thenReturn(jwt);

        // Set up mock user repository
        UserEntity mockUser = new UserEntity();
        mockUser.setId("user123");
        mockUser.setEmail("test@example.com");
        mockUser.setAzureOid("azure-oid-123");
        mockUser.setFirstname("Test");
        mockUser.setLastname("User");
        mockUser.setVerified(true);
        
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));

        // Test the endpoint
        mockMvc.perform(post("/api/users/azure-authenticate")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value("user123"))
                .andExpect(jsonPath("$.user.email").value("test@example.com"));
    }

    @Test
    public void testAzureAuthentication_NewUser() throws Exception {
        // Set up mock JWT decoder with claims for a new user
        Jwt jwt = Jwt.withTokenValue("new-user-token")
                .header("alg", "RS256")
                .claim("sub", "new-subject")
                .claim("email", "newuser@example.com")
                .claim("name", "New User")
                .claim("oid", "azure-oid-new")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
                
        when(jwtDecoder.decode("new-user-token")).thenReturn(jwt);

        // Set up mock repository to return empty (no existing user)
        when(userRepository.findByEmailIgnoreCase("newuser@example.com")).thenReturn(Optional.empty());
        
        // Set up mock for saving the new user
        UserEntity newUser = new UserEntity();
        newUser.setEmail("newuser@example.com");
        newUser.setFirstname("New");
        newUser.setLastname("User");
        newUser.setUsername("newuser");
        newUser.setAzureOid("azure-oid-new");
        newUser.setVerified(true);
        
        when(userRepository.save(org.mockito.ArgumentMatchers.any(UserEntity.class))).thenReturn(newUser);

        // Test the endpoint
        mockMvc.perform(post("/api/users/azure-authenticate")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer new-user-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("newuser@example.com"))
                .andExpect(jsonPath("$.user.verified").value(true));
    }
} 