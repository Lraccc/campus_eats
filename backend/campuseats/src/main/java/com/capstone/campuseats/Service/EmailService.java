package com.capstone.campuseats.Service;

import com.capstone.campuseats.config.EmailUtils;
import com.capstone.campuseats.Entity.OrderEntity;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Async
public class EmailService {
    public static final String NEW_USER_ACCOUNT_VERIFICATION = "Campus Eats - New User Account Verification";
    public static final String ORDER_RECEIPT_SUBJECT = "Campus Eats - Order Receipt";

    @Autowired
    private BrevoEmailService brevoEmailService;

    @Autowired
    private EmailUtils emailUtils;

    @Value("${env.VERIFY_EMAIL_HOST}")
    private String host;

    @Value("${env.EMAIL_ID}")
    private String fromEmail;

    @Async
    public void sendEmail(String name, String to, String token) {
        brevoEmailService.sendEmail(name, to, token);
    }

    @Async
    public void sendOrderReceipt(OrderEntity order, String recipientEmail) {
        brevoEmailService.sendOrderReceipt(order, recipientEmail);
    }

    @Async
    public void sendDasherApprovalEmail(String name, String email) {
        brevoEmailService.sendDasherApprovalEmail(name, email);
    }

    @Async
    public void sendShopApprovalEmail(String name, String email) {
        brevoEmailService.sendShopApprovalEmail(name, email);
    }
}