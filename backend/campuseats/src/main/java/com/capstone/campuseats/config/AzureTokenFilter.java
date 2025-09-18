package com.capstone.campuseats.config;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.capstone.campuseats.Entity.UserEntity;
import com.capstone.campuseats.Repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AzureTokenFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private JwtDecoder jwtDecoder;

    @Autowired
    public AzureTokenFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @Autowired(required = false)
    public void setJwtDecoder(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String authHeader = request.getHeader("Authorization");
        
        // If no auth header or this is a public endpoint or jwtDecoder is not set, just continue
        if (authHeader == null || authHeader.isEmpty() || shouldSkipAuthentication(request) || jwtDecoder == null) {
            filterChain.doFilter(request, response);
            return;
        }
        
        try {
            if (authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                
                // Decode and validate JWT
                var jwt = jwtDecoder.decode(token);
                
                // Extract important claims from the JWT
                String email = jwt.getClaimAsString("email");
                String oid = jwt.getClaimAsString("oid");
                
                // Try to find user by email first, then by Azure OID
                var userOpt = Optional.<UserEntity>empty();
                if (email != null && !email.isEmpty()) {
                    userOpt = userRepository.findByEmailIgnoreCase(email);
                }
                if (userOpt.isEmpty() && oid != null) {
                    userOpt = userRepository.findByAzureOid(oid);
                }
                
                // If we found a user, create an authentication object
                if (userOpt.isPresent()) {
                    UserEntity user = userOpt.get();
                    
                    // Create authentication object with the user information
                    var auth = new UsernamePasswordAuthenticationToken(
                        user.getEmail(), null, Collections.emptyList());
                    
                    // Add to security context
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (JwtException e) {
            // Invalid token, just log and continue
            logger.warn("Invalid JWT token: " + e.getMessage());
        } catch (Exception e) {
            // Log other exceptions but don't fail the request
            logger.error("Error processing JWT token", e);
        }
        
        // Continue filter chain
        filterChain.doFilter(request, response);
    }
    
    /**
     * Determines if authentication should be skipped for this request
     */
    private boolean shouldSkipAuthentication(HttpServletRequest request) {
        String path = request.getRequestURI();
        
        // Public endpoints do not require authentication
        return path.contains("/api/users/signup") ||
               path.contains("/api/users/verify") ||
               path.contains("/api/users/authenticate") ||
               path.contains("/api/users/azure-authenticate") ||
               path.contains("/api/users/sync-oauth") ||
               path.contains("/api/users/sendVerificationCode") ||
               path.contains("/api/users/verifyCode") ||
               path.contains("/api/users/verificationCodeStatus");
    }
} 