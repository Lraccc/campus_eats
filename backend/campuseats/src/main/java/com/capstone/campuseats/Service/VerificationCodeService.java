package com.capstone.campuseats.Service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class VerificationCodeService {

    // In-memory cache to store verification codes
    private final Map<String, String> verificationCodeCache = new ConcurrentHashMap<>();

    public void storeVerificationCode(String email, String code) {
        verificationCodeCache.put(email, code);
    }

    public String getVerificationCode(String email) {
        return verificationCodeCache.get(email);
    }

    public void removeVerificationCode(String email) {
        verificationCodeCache.remove(email);
    }

    public boolean verifyCode(String email, String code) {
        String storedCode = verificationCodeCache.get(email);
        if (storedCode != null && storedCode.equals(code)) {
            // Remove the code after successful verification
            verificationCodeCache.remove(email);
            return true;
        }
        return false;
    }
}