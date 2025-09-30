package com.capstone.campuseats.Service;

import com.capstone.campuseats.config.EmailUtils;
import com.capstone.campuseats.Entity.OrderEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@Slf4j
public class BrevoEmailService {

    public static final String NEW_USER_ACCOUNT_VERIFICATION = "Campus Eats - New User Account Verification";
    public static final String ORDER_RECEIPT_SUBJECT = "Campus Eats - Order Receipt";

    @Autowired
    private EmailUtils emailUtils;

    @Value("${env.VERIFY_EMAIL_HOST}")
    private String host;

    @Value("${env.EMAIL_ID}")
    private String fromEmail;

    @Value("${env.BREVO_API_KEY}")
    private String brevoApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .timeout(Duration.ofSeconds(30))
            .build();

    @Async
    public void sendEmail(String name, String to, String token) {
        try {
            String htmlContent = EmailUtils.getEmailMessage(name, host, token);
            String textContent = "Please verify your email by clicking the link sent to you.";
            
            sendBrevoEmail(to, NEW_USER_ACCOUNT_VERIFICATION, htmlContent, textContent);
            log.info("Verification email sent successfully to: {}", to);
            
        } catch (Exception e) {
            log.error("Error sending verification email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send verification email", e);
        }
    }

    @Async
    public void sendOrderReceipt(OrderEntity order, String recipientEmail) {
        if (recipientEmail == null || recipientEmail.isEmpty()) {
            log.error("Recipient email is not valid.");
            return;
        }
        
        try {
            String receiptEmailContent = emailUtils.generateReceiptHtml(order);
            String textContent = "Your order receipt from Campus Eats";
            
            sendBrevoEmail(recipientEmail, ORDER_RECEIPT_SUBJECT, receiptEmailContent, textContent);
            log.info("Order receipt sent successfully to: {}", recipientEmail);
            
        } catch (Exception e) {
            log.error("Error sending order receipt to {}: {}", recipientEmail, e.getMessage());
            throw new RuntimeException("Failed to send order receipt", e);
        }
    }

    public String sendVerificationCode(String to, String verificationCode, boolean isMobile) {
        try {
            String subject;
            String htmlContent;
            String textContent;
            
            if (isMobile) {
                subject = "Campus Eats - Mobile Verification Code";
                textContent = "Your verification code is: " + verificationCode;
                htmlContent = "<h2>Campus Eats</h2><p>Your verification code is: <strong>" + verificationCode + "</strong></p>";
            } else {
                subject = "Campus Eats - Account Verification";
                textContent = EmailUtils.getEmailMessage(to, host, verificationCode);
                htmlContent = EmailUtils.getEmailMessage(to, host, verificationCode);
            }
            
            sendBrevoEmail(to, subject, htmlContent, textContent);
            log.info("Verification code sent successfully to: {}", to);
            return verificationCode;
            
        } catch (Exception e) {
            log.error("Error sending verification code to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send verification code. Please try again.", e);
        }
    }

    private void sendBrevoEmail(String to, String subject, String htmlContent, String textContent) 
            throws IOException, InterruptedException {
        
        String jsonPayload = String.format("""
            {
                "sender": {
                    "name": "Campus Eats",
                    "email": "%s"
                },
                "to": [
                    {
                        "email": "%s"
                    }
                ],
                "subject": "%s",
                "htmlContent": "%s",
                "textContent": "%s"
            }
            """, fromEmail, to, subject, 
            htmlContent.replace("\"", "\\\"").replace("\n", "\\n"),
            textContent.replace("\"", "\\\"").replace("\n", "\\n"));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                .header("accept", "application/json")
                .header("api-key", brevoApiKey)
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            log.debug("Email sent successfully via Brevo. Response: {}", response.body());
        } else {
            log.error("Failed to send email via Brevo. Status: {}, Response: {}", 
                     response.statusCode(), response.body());
            throw new RuntimeException("Failed to send email via Brevo API");
        }
    }
}