package com.capstone.campuseats.Service;

import com.capstone.campuseats.config.EmailUtils;
import com.capstone.campuseats.Entity.OrderEntity;
import com.sendgrid.*;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Slf4j
public class SendGridEmailService {

    public static final String NEW_USER_ACCOUNT_VERIFICATION = "Campus Eats - New User Account Verification";
    public static final String ORDER_RECEIPT_SUBJECT = "Campus Eats - Order Receipt";

    @Autowired
    private EmailUtils emailUtils;

    @Value("${env.VERIFY_EMAIL_HOST}")
    private String host;

    @Value("${env.EMAIL_ID}")
    private String fromEmail;

    @Value("${env.SENDGRID_API_KEY}")
    private String sendGridApiKey;

    @Async
    public void sendEmail(String name, String to, String token) {
        try {
            Email from = new Email(fromEmail);
            Email toEmail = new Email(to);
            String subject = NEW_USER_ACCOUNT_VERIFICATION;
            Content content = new Content("text/plain", EmailUtils.getEmailMessage(name, host, token));
            
            Mail mail = new Mail(from, subject, toEmail, content);

            SendGrid sg = new SendGrid(sendGridApiKey);
            Request request = new Request();
            
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            
            Response response = sg.api(request);
            
            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                log.info("Email sent successfully to: {}", to);
            } else {
                log.error("Failed to send email. Status: {}, Body: {}", response.getStatusCode(), response.getBody());
                throw new RuntimeException("Failed to send verification email");
            }
            
        } catch (IOException e) {
            log.error("Error sending email to {}: {}", to, e.getMessage());
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
            Email from = new Email(fromEmail);
            Email to = new Email(recipientEmail);
            String subject = ORDER_RECEIPT_SUBJECT;
            
            // Generate the receipt email content (HTML)
            String receiptEmailContent = emailUtils.generateReceiptHtml(order);
            Content content = new Content("text/html", receiptEmailContent);
            
            Mail mail = new Mail(from, subject, to, content);

            SendGrid sg = new SendGrid(sendGridApiKey);
            Request request = new Request();
            
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            
            Response response = sg.api(request);
            
            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                log.info("Order receipt sent successfully to: {}", recipientEmail);
            } else {
                log.error("Failed to send order receipt. Status: {}, Body: {}", response.getStatusCode(), response.getBody());
                throw new RuntimeException("Failed to send order receipt");
            }
            
        } catch (IOException e) {
            log.error("Error sending order receipt to {}: {}", recipientEmail, e.getMessage());
            throw new RuntimeException("Failed to send order receipt", e);
        }
    }

    // For mobile verification codes (simple text email)
    public String sendVerificationCode(String to, String verificationCode, boolean isMobile) {
        try {
            Email from = new Email(fromEmail);
            Email toEmail = new Email(to);
            String subject;
            String messageText;
            
            if (isMobile) {
                subject = "Campus Eats - Mobile Verification Code";
                messageText = "Your verification code is: " + verificationCode;
            } else {
                subject = "Campus Eats - Account Verification";
                messageText = EmailUtils.getEmailMessage(to, host, verificationCode);
            }
            
            Content content = new Content("text/plain", messageText);
            Mail mail = new Mail(from, subject, toEmail, content);

            SendGrid sg = new SendGrid(sendGridApiKey);
            Request request = new Request();
            
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            
            Response response = sg.api(request);
            
            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                log.info("Verification code sent successfully to: {}", to);
                return verificationCode;
            } else {
                log.error("Failed to send verification code. Status: {}, Body: {}", response.getStatusCode(), response.getBody());
                throw new RuntimeException("Failed to send verification code. Please try again.");
            }
            
        } catch (IOException e) {
            log.error("Error sending verification code to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send verification code. Please try again.", e);
        }
    }
}