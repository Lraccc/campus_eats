package com.capstone.campuseats.Service;


import com.capstone.campuseats.config.EmailUtils;
import com.capstone.campuseats.Entity.OrderEntity;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.MessagingException; // Change to jakarta.mail
import jakarta.mail.internet.MimeMessage; // Change to jakarta.mail
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Async
public class EmailService {
    public static final String NEW_USER_ACCOUNT_VERIFICATION = "Campus Eats - New User Account Verification";
    public static final String ORDER_RECEIPT_SUBJECT = "Campus Eats - Order Receipt";
    
    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private EmailUtils emailUtils;

    @Value("${env.VERIFY_EMAIL_HOST}")
    private String host;

    @Value("${env.EMAIL_ID}")
    private String fromEmail;

    @Async
    public void sendEmail(String name, String to, String token) {
        try{
            SimpleMailMessage message = new SimpleMailMessage();
            message.setSubject(NEW_USER_ACCOUNT_VERIFICATION);
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setText(EmailUtils.getEmailMessage(name,host,token));
            mailSender.send(message);
        }catch (Exception e){
            System.out.println(e.getMessage());
            throw new RuntimeException(e.getMessage());
        }
    }

    @Async
    public void sendOrderReceipt(OrderEntity order, String recipientEmail) {
        if (recipientEmail == null || recipientEmail.isEmpty()) {
            System.err.println("Recipient email is not valid.");
            return; // Don't proceed if the email is invalid
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setSubject(ORDER_RECEIPT_SUBJECT);
            helper.setFrom(fromEmail);
            helper.setTo(recipientEmail);

            // Generate the receipt email content (HTML)
            String receiptEmailContent = emailUtils.generateReceiptHtml(order);

            // Set the message text as HTML
            helper.setText(receiptEmailContent, true);  // true for HTML

            // Send the email
            mailSender.send(message);
            System.out.println("Order receipt email sent successfully to " + recipientEmail);
        } catch (MessagingException e) {
            System.err.println("Error sending order receipt email: " + e.getMessage());
            throw new RuntimeException("Failed to send email due to: " + e.getMessage(), e);
        } catch (Exception e) {
            System.err.println("Unexpected error while sending order receipt: " + e.getMessage());
            throw new RuntimeException("Failed to send email due to: " + e.getMessage(), e);
        }
    }
}
