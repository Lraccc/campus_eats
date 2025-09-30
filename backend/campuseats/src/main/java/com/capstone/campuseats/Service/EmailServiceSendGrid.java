package com.capstone.campuseats.Service;

import com.capstone.campuseats.Entity.OrderEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Async
public class EmailServiceBrevo {
    
    @Autowired
    private BrevoEmailService brevoEmailService;

    @Async
    public void sendEmail(String name, String to, String token) {
        brevoEmailService.sendEmail(name, to, token);
    }

    @Async
    public void sendOrderReceipt(OrderEntity order, String recipientEmail) {
        brevoEmailService.sendOrderReceipt(order, recipientEmail);
    }
    
    public String sendVerificationCode(String to, String verificationCode, boolean isMobile) {
        return brevoEmailService.sendVerificationCode(to, verificationCode, isMobile);
    }
}