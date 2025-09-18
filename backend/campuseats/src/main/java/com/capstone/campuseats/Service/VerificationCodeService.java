package com.capstone.campuseats.Service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class VerificationCodeService {

    // In-memory cache to store verification codes with timestamps
    private final Map<String, VerificationCodeData> verificationCodeCache = new ConcurrentHashMap<>();
    
    // Code expiration time in minutes
    private static final int CODE_EXPIRATION_MINUTES = 1;

    public void storeVerificationCode(String email, String code) {
        LocalDateTime expirationTime = LocalDateTime.now().plusMinutes(CODE_EXPIRATION_MINUTES);
        verificationCodeCache.put(email, new VerificationCodeData(code, expirationTime));
    }

    public String getVerificationCode(String email) {
        VerificationCodeData data = verificationCodeCache.get(email);
        if (data != null && !isCodeExpired(data)) {
            return data.getCode();
        }
        return null;
    }

    public void removeVerificationCode(String email) {
        verificationCodeCache.remove(email);
    }

    public boolean verifyCode(String email, String code) {
        VerificationCodeData data = verificationCodeCache.get(email);
        if (data != null && !isCodeExpired(data) && data.getCode().equals(code)) {
            // Remove the code after successful verification
            verificationCodeCache.remove(email);
            return true;
        }
        return false;
    }
    
    public boolean isCodeExpired(String email) {
        VerificationCodeData data = verificationCodeCache.get(email);
        return data == null || isCodeExpired(data);
    }
    
    private boolean isCodeExpired(VerificationCodeData data) {
        return LocalDateTime.now().isAfter(data.getExpirationTime());
    }
    
    public long getRemainingTimeInSeconds(String email) {
        VerificationCodeData data = verificationCodeCache.get(email);
        if (data != null && !isCodeExpired(data)) {
            return java.time.Duration.between(LocalDateTime.now(), data.getExpirationTime()).getSeconds();
        }
        return 0;
    }

    // Inner class to store code and expiration time
    private static class VerificationCodeData {
        private final String code;
        private final LocalDateTime expirationTime;

        public VerificationCodeData(String code, LocalDateTime expirationTime) {
            this.code = code;
            this.expirationTime = expirationTime;
        }

        public String getCode() {
            return code;
        }

        public LocalDateTime getExpirationTime() {
            return expirationTime;
        }
    }
}