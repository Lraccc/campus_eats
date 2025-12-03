package com.capstone.campuseats.config;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.stereotype.Component;

import com.capstone.campuseats.Entity.OrderEntity;

@Component
public class EmailUtils {

    // Method for account verification emails
    public static String getEmailMessage(String name, String host, String token) {
        return generateAccountVerificationHtml(name, getVerificationUrl(host, token));
    }

    private static String getVerificationUrl(String host, String token) {
        return host + "api/users/verify?token=" + token;
    }

    // Beautiful HTML template for account verification
    private static String generateAccountVerificationHtml(String name, String verificationUrl) {
        return "<!DOCTYPE html>" +
                "<html lang='en'>" +
                "<head>" +
                "<meta charset='UTF-8'>" +
                "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "<style>" +
                "* { margin: 0; padding: 0; box-sizing: border-box; }" +
                "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; }" +
                ".email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }" +
                ".header { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); padding: 40px 30px; text-align: center; position: relative; }" +
                ".header::after { content: ''; position: absolute; bottom: -20px; left: 0; right: 0; height: 40px; background: white; border-radius: 50% 50% 0 0; }" +
                ".header h1 { color: #DAA520; font-size: 32px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }" +
                ".header p { color: rgba(218,165,32,0.9); font-size: 16px; }" +
                ".content { padding: 40px 30px; }" +
                ".greeting { font-size: 22px; color: #1F2937; margin-bottom: 20px; font-weight: 600; }" +
                ".message { color: #4B5563; line-height: 1.8; font-size: 16px; margin-bottom: 25px; }" +
                ".verify-button { display: inline-block; background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(188,74,77,0.3); transition: transform 0.2s; }" +
                ".verify-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(188,74,77,0.4); }" +
                ".info-box { background: linear-gradient(135deg, #DFD6C5 0%, #F5EFE6 100%); border-radius: 15px; padding: 20px; margin: 25px 0; border-left: 5px solid #DAA520; }" +
                ".info-box p { color: #8B4513; font-size: 14px; line-height: 1.6; margin: 5px 0; }" +
                ".footer { background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #DAA520; }" +
                ".footer-message { color: #6B7280; font-size: 14px; margin: 10px 0; }" +
                ".divider { height: 2px; background: linear-gradient(90deg, transparent, #DAA520, transparent); margin: 20px 0; }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class='email-wrapper'>" +
                "<div class='header'>" +
                "<h1>🎉 Welcome to Campus Eats!</h1>" +
                "<p>Just one more step to get started</p>" +
                "</div>" +
                "<div class='content'>" +
                "<p class='greeting'>Hello " + name + ",</p>" +
                "<p class='message'>" +
                "Thank you for signing up! We're excited to have you join our Campus Eats community. " +
                "To complete your registration and start enjoying delicious campus food, please verify your email address." +
                "</p>" +
                "<div style='text-align: center;'>" +
                "<a href='" + verificationUrl + "' class='verify-button'>✓ Verify My Account</a>" +
                "</div>" +
                "<div class='info-box'>" +
                "<p><strong>⚠️ Important:</strong></p>" +
                "<p>• This verification link will expire in 24 hours</p>" +
                "<p>• If you didn't create this account, please ignore this email</p>" +
                "<p>• Having trouble? Copy and paste this link: <a href='" + verificationUrl + "' style='color: #BC4A4D; word-break: break-all;'>" + verificationUrl + "</a></p>" +
                "</div>" +
                "<div class='divider'></div>" +
                "<p class='message' style='color: #6B7280; font-size: 14px;'>" +
                "Once verified, you'll be able to browse menus, place orders, and enjoy all the features Campus Eats has to offer!" +
                "</p>" +
                "</div>" +
                "<div class='footer'>" +
                "<p class='footer-message'>Campus Eats - Delivering happiness, one meal at a time</p>" +
                "<p class='footer-message'>Need help? Contact our support team</p>" +
                "<div class='divider'></div>" +
                "<p class='footer-message'>© 2025 Campus Eats. All rights reserved.</p>" +
                "</div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }

    // New method for generating e-receipt email content
    public String generateReceiptHtml(OrderEntity order) {
        StringBuilder sb = new StringBuilder();

        sb.append("<!DOCTYPE html>")
                .append("<html lang='en'>")
                .append("<head>")
                .append("<meta charset='UTF-8'>")
                .append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
                .append("<style>")
                .append("* { margin: 0; padding: 0; box-sizing: border-box; }")
                .append("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; }")
                .append(".email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }")
                .append(".header { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); padding: 40px 30px; text-align: center; position: relative; }")
                .append(".header::after { content: ''; position: absolute; bottom: -20px; left: 0; right: 0; height: 40px; background: white; border-radius: 50% 50% 0 0; }")
                .append(".header h1 { color: #DAA520; font-size: 32px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }")
                .append(".header p { color: rgba(218,165,32,0.9); font-size: 16px; }")
                .append(".success-badge { background: #DAA520; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin: 20px 0; font-size: 14px; }")
                .append(".content { padding: 30px; }")
                .append(".greeting { font-size: 18px; color: #BC4A4D; margin-bottom: 20px; font-weight: 600; }")
                .append(".info-card { background: linear-gradient(135deg, #DFD6C5 0%, #F5EFE6 100%); border-radius: 15px; padding: 25px; margin: 20px 0; border-left: 5px solid #DAA520; }")
                .append(".info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed rgba(162,71,87,0.2); }")
                .append(".info-row:last-child { border-bottom: none; }")
                .append(".info-label { font-weight: 600; color: #6B7280; font-size: 14px; }")
                .append(".info-value { color: #374151; font-weight: 500; text-align: right; }")
                .append(".section-title { font-size: 20px; color: #BC4A4D; margin: 30px 0 15px 0; font-weight: bold; display: flex; align-items: center; }")
                .append(".section-title::before { content: ''; width: 4px; height: 24px; background: #DAA520; margin-right: 10px; border-radius: 2px; }")
                .append(".items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }")
                .append(".items-table thead { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); }")
                .append(".items-table th { padding: 15px; color: #DAA520; font-weight: 600; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }")
                .append(".items-table tbody tr { background: white; transition: background 0.3s; }")
                .append(".items-table tbody tr:nth-child(even) { background: #F9FAFB; }")
                .append(".items-table tbody tr:hover { background: #DFD6C5; }")
                .append(".items-table td { padding: 15px; color: #374151; border-bottom: 1px solid #E5E7EB; font-size: 14px; }")
                .append(".items-table tbody tr:last-child td { border-bottom: none; }")
                .append(".item-name { font-weight: 600; color: #1F2937; }")
                .append(".item-qty { text-align: center; background: #F5EFE6; padding: 4px 12px; border-radius: 12px; display: inline-block; font-weight: 600; color: #8B4513; }")
                .append(".item-price { text-align: right; font-weight: 600; color: #BC4A4D; }")
                .append(".totals-section { background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%); border-radius: 15px; padding: 25px; margin: 30px 0; }")
                .append(".total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; }")
                .append(".total-row.subtotal { color: #6B7280; }")
                .append(".total-row.delivery { color: #6B7280; padding-bottom: 15px; border-bottom: 2px solid #D1D5DB; }")
                .append(".total-row.grand-total { font-size: 24px; font-weight: bold; color: #BC4A4D; padding-top: 15px; }")
                .append(".total-row.grand-total .amount { color: #BC4A4D; }")
                .append(".footer { background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #DAA520; }")
                .append(".footer-message { font-size: 18px; color: #BC4A4D; font-weight: 600; margin-bottom: 15px; }")
                .append(".footer-tagline { color: #6B7280; font-size: 14px; margin: 10px 0; }")
                .append(".footer-contact { color: #9CA3AF; font-size: 12px; margin-top: 20px; }")
                .append(".divider { height: 2px; background: linear-gradient(90deg, transparent, #DAA520, transparent); margin: 20px 0; }")
                .append("@media only screen and (max-width: 600px) {")
                .append(".email-wrapper { border-radius: 0; }")
                .append(".header { padding: 30px 20px; }")
                .append(".content { padding: 20px; }")
                .append(".info-row { flex-direction: column; gap: 5px; }")
                .append(".info-value { text-align: left; }")
                .append(".items-table th, .items-table td { padding: 10px; font-size: 12px; }")
                .append("}")
                .append("</style>")
                .append("</head>")
                .append("<body>")
                .append("<div class='email-wrapper'>")
                
                // Header
                .append("<div class='header'>")
                .append("<h1>🎉 Order Complete!</h1>")
                .append("<p>Your delicious food is on its way</p>")
                .append("</div>")
                
                // Content
                .append("<div class='content'>")
                .append("<div class='success-badge'>✓ Successfully Delivered</div>")
                .append("<p class='greeting'>Dear Valued Customer,</p>")
                .append("<p style='color: #6B7280; line-height: 1.6; margin-bottom: 20px;'>")
                .append("Thank you for choosing Campus Eats! Your order has been successfully completed. ")
                .append("We hope you enjoyed your meal! 🍽️")
                .append("</p>")
                
                // Order Information Card
                .append("<div class='info-card'>")
                .append("<div class='info-row'>")
                .append("<span class='info-label'>📋 Order ID</span>")
                .append("<span class='info-value'>#").append(order.getId()).append("</span>")
                .append("</div>")
                .append("<div class='info-row'>")
                .append("<span class='info-label'>📅 Date & Time</span>")
                .append("<span class='info-value'>").append(formatOrderDate(order.getCreatedAt())).append("</span>")
                .append("</div>")
                .append("<div class='info-row'>")
                .append("<span class='info-label'>📍 Delivery Address</span>")
                .append("<span class='info-value'>").append(order.getDeliverTo()).append("</span>")
                .append("</div>")
                .append("<div class='info-row'>")
                .append("<span class='info-label'>💳 Payment Method</span>")
                .append("<span class='info-value'>").append(order.getPaymentMethod()).append("</span>")
                .append("</div>")
                .append("</div>")
                
                // Items Section
                .append("<div class='section-title'>Your Items</div>")
                .append("<table class='items-table'>")
                .append("<thead>")
                .append("<tr>")
                .append("<th>Item</th>")
                .append("<th style='text-align: center;'>Qty</th>")
                .append("<th style='text-align: right;'>Price</th>")
                .append("</tr>")
                .append("</thead>")
                .append("<tbody>");

        // Loop through the items in the order
        order.getItems().forEach(item -> {
            sb.append("<tr>")
                    .append("<td class='item-name'>").append(item.getName()).append("</td>")
                    .append("<td style='text-align: center;'><span class='item-qty'>").append(item.getQuantity()).append("</span></td>")
                    .append("<td class='item-price'>&#8369;").append(String.format("%.2f", item.getPrice())).append("</td>")
                    .append("</tr>");
        });

        sb.append("</tbody>")
                .append("</table>")
                
                // Totals Section
                .append("<div class='totals-section'>")
                .append("<div class='total-row subtotal'>")
                .append("<span>Subtotal</span>")
                .append("<span>&#8369;").append(String.format("%.2f", order.getTotalPrice())).append("</span>")
                .append("</div>")
                .append("<div class='total-row delivery'>")
                .append("<span>Delivery Fee</span>")
                .append("<span>&#8369;").append(String.format("%.2f", order.getDeliveryFee())).append("</span>")
                .append("</div>")
                .append("<div class='total-row grand-total'>")
                .append("<span>Grand Total</span>")
                .append("<span class='amount'>&#8369;").append(String.format("%.2f", order.getTotalPrice() + order.getDeliveryFee())).append("</span>")
                .append("</div>")
                .append("</div>")
                
                .append("</div>") // End content
                
                // Footer
                .append("<div class='footer'>")
                .append("<div class='footer-message'>Thank you for choosing Campus Eats! 🙏</div>")
                .append("<div class='footer-tagline'>Delivering happiness, one meal at a time</div>")
                .append("<div class='divider'></div>")
                .append("<div class='footer-contact'>")
                .append("Need help? Contact our support team<br>")
                .append("© 2025 Campus Eats. All rights reserved.")
                .append("</div>")
                .append("</div>")
                
                .append("</div>") // End email-wrapper
                .append("</body>")
                .append("</html>");

        return sb.toString();
    }

    // Helper method to format date
    private String formatOrderDate(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "Invalid date";
        }

        DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");
        return dateTime.format(outputFormatter);
    }

    // Method for generating mobile verification code email
    public String generateMobileVerificationCodeHtml(String verificationCode) {
        StringBuilder sb = new StringBuilder();

        sb.append("<!DOCTYPE html>")
                .append("<html lang='en'>")
                .append("<head>")
                .append("<meta charset='UTF-8'>")
                .append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
                .append("<style>")
                .append("* { margin: 0; padding: 0; box-sizing: border-box; }")
                .append("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; }")
                .append(".email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }")
                .append(".header { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); padding: 40px 30px; text-align: center; position: relative; }")
                .append(".header::after { content: ''; position: absolute; bottom: -20px; left: 0; right: 0; height: 40px; background: white; border-radius: 50% 50% 0 0; }")
                .append(".header h1 { color: #DAA520; font-size: 32px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }")
                .append(".header p { color: rgba(218,165,32,0.9); font-size: 16px; }")
                .append(".content { padding: 40px 30px; text-align: center; }")
                .append(".greeting { font-size: 22px; color: #1F2937; margin-bottom: 20px; font-weight: 600; }")
                .append(".message { color: #4B5563; line-height: 1.8; font-size: 16px; margin-bottom: 30px; }")
                .append(".code-container { background: linear-gradient(135deg, #DFD6C5 0%, #F5EFE6 100%); border-radius: 15px; padding: 30px; margin: 30px 0; border: 3px dashed #BC4A4D; }")
                .append(".code { font-size: 48px; font-weight: bold; color: #BC4A4D; letter-spacing: 10px; font-family: 'Courier New', monospace; text-shadow: 2px 2px 4px rgba(188,74,77,0.2); }")
                .append(".code-label { color: #BC4A4D; font-size: 14px; font-weight: 600; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }")
                .append(".info-box { background: linear-gradient(135deg, #F5EFE6 0%, #E8DCC8 100%); border-radius: 15px; padding: 20px; margin: 25px 0; border-left: 5px solid #DAA520; }")
                .append(".info-box p { color: #8B4513; font-size: 14px; line-height: 1.6; margin: 5px 0; text-align: left; }")
                .append(".timer-badge { display: inline-block; background: #EF4444; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin: 15px 0; }")
                .append(".footer { background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #DAA520; }")
                .append(".footer-message { color: #6B7280; font-size: 14px; margin: 10px 0; }")
                .append(".divider { height: 2px; background: linear-gradient(90deg, transparent, #DAA520, transparent); margin: 20px 0; }")
                .append("</style>")
                .append("</head>")
                .append("<body>")
                .append("<div class='email-wrapper'>")
                .append("<div class='header'>")
                .append("<h1>🔐 Verification Code</h1>")
                .append("<p>Secure your Campus Eats account</p>")
                .append("</div>")
                .append("<div class='content'>")
                .append("<p class='greeting'>Welcome back!</p>")
                .append("<p class='message'>")
                .append("To continue, please enter the verification code below in your Campus Eats mobile app.")
                .append("</p>")
                .append("<div class='code-container'>")
                .append("<div class='code-label'>Your Verification Code</div>")
                .append("<div class='code'>").append(verificationCode).append("</div>")
                .append("</div>")
                .append("<div class='timer-badge'>⏱️ Expires in 2 minutes</div>")
                .append("<div class='info-box'>")
                .append("<p><strong>⚠️ Security Tips:</strong></p>")
                .append("<p>• Never share this code with anyone</p>")
                .append("<p>• Campus Eats staff will never ask for your code</p>")
                .append("<p>• If you didn't request this code, please ignore this email</p>")
                .append("<p>• This code is only valid for the next 2 minutes</p>")
                .append("</div>")
                .append("<div class='divider'></div>")
                .append("<p class='message' style='color: #6B7280; font-size: 14px;'>")
                .append("Having trouble? Make sure you're using the latest version of the Campus Eats mobile app.")
                .append("</p>")
                .append("</div>")
                .append("<div class='footer'>")
                .append("<p class='footer-message'>Campus Eats - Your trusted campus food delivery</p>")
                .append("<p class='footer-message'>Need help? Contact our support team</p>")
                .append("<div class='divider'></div>")
                .append("<p class='footer-message'>© 2025 Campus Eats. All rights reserved.</p>")
                .append("</div>")
                .append("</div>")
                .append("</body>")
                .append("</html>");

        return sb.toString();
    }

    // Method for generating dasher approval email content
    public String generateDasherApprovalHtml(String name) {
        StringBuilder sb = new StringBuilder();

        sb.append("<!DOCTYPE html>")
                .append("<html lang='en'>")
                .append("<head>")
                .append("<meta charset='UTF-8'>")
                .append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
                .append("<style>")
                .append("* { margin: 0; padding: 0; box-sizing: border-box; }")
                .append("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; }")
                .append(".email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }")
                .append(".header { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); padding: 40px 30px; text-align: center; position: relative; }")
                .append(".header::after { content: ''; position: absolute; bottom: -20px; left: 0; right: 0; height: 40px; background: white; border-radius: 50% 50% 0 0; }")
                .append(".header h1 { color: #DAA520; font-size: 32px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }")
                .append(".header p { color: rgba(218,165,32,0.9); font-size: 16px; }")
                .append(".content { padding: 40px 30px; }")
                .append(".greeting { font-size: 22px; color: #1F2937; margin-bottom: 20px; font-weight: 600; }")
                .append(".message { color: #4B5563; line-height: 1.8; font-size: 16px; margin-bottom: 25px; }")
                .append(".info-box { background: linear-gradient(135deg, #DFD6C5 0%, #F5EFE6 100%); border-radius: 15px; padding: 25px; margin: 25px 0; border-left: 5px solid #DAA520; }")
                .append(".info-box h3 { color: #BC4A4D; font-size: 18px; margin-bottom: 15px; }")
                .append(".info-box ul { list-style: none; padding-left: 0; }")
                .append(".info-box li { color: #8B4513; margin: 10px 0; padding-left: 25px; position: relative; }")
                .append(".info-box li::before { content: '✓'; position: absolute; left: 0; color: #DAA520; font-weight: bold; font-size: 18px; }")
                .append(".cta-button { display: inline-block; background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(188,74,77,0.3); }")
                .append(".footer { background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #DAA520; }")
                .append(".footer-message { color: #6B7280; font-size: 14px; margin: 10px 0; }")
                .append(".divider { height: 2px; background: linear-gradient(90deg, transparent, #DAA520, transparent); margin: 20px 0; }")
                .append("</style>")
                .append("</head>")
                .append("<body>")
                .append("<div class='email-wrapper'>")
                .append("<div class='header'>")
                .append("<h1>🎉 Congratulations!</h1>")
                .append("<p>Your Dasher Application Has Been Approved</p>")
                .append("</div>")
                .append("<div class='content'>")
                .append("<p class='greeting'>Hello ").append(name).append(",</p>")
                .append("<p class='message'>")
                .append("Great news! We're excited to inform you that your dasher application has been approved. ")
                .append("You are now officially part of the Campus Eats delivery team! 🚀")
                .append("</p>")
                .append("<div class='info-box'>")
                .append("<h3>What's Next?</h3>")
                .append("<ul>")
                .append("<li>Log in to your Campus Eats account</li>")
                .append("<li>Set your availability and start accepting orders</li>")
                .append("<li>Deliver delicious food and earn money</li>")
                .append("<li>Build your reputation as a top dasher</li>")
                .append("</ul>")
                .append("</div>")
                .append("<p class='message'>")
                .append("As a dasher, you'll have the flexibility to work on your own schedule while earning income. ")
                .append("Remember to maintain professionalism and provide excellent service to our customers.")
                .append("</p>")
                .append("<div class='divider'></div>")
                .append("<p class='message' style='color: #BC4A4D; font-weight: 600;'>")
                .append("Ready to start delivering? Log in to your account now!")
                .append("</p>")
                .append("</div>")
                .append("<div class='footer'>")
                .append("<p class='footer-message'>Thank you for joining Campus Eats!</p>")
                .append("<p class='footer-message'>Questions? Contact our support team anytime.</p>")
                .append("<div class='divider'></div>")
                .append("<p class='footer-message'>© 2025 Campus Eats. All rights reserved.</p>")
                .append("</div>")
                .append("</div>")
                .append("</body>")
                .append("</html>");

        return sb.toString();
    }

    // Method for generating shop approval email content
    public String generateShopApprovalHtml(String name) {
        StringBuilder sb = new StringBuilder();

        sb.append("<!DOCTYPE html>")
                .append("<html lang='en'>")
                .append("<head>")
                .append("<meta charset='UTF-8'>")
                .append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>")
                .append("<style>")
                .append("* { margin: 0; padding: 0; box-sizing: border-box; }")
                .append("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; }")
                .append(".email-wrapper { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }")
                .append(".header { background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); padding: 40px 30px; text-align: center; position: relative; }")
                .append(".header::after { content: ''; position: absolute; bottom: -20px; left: 0; right: 0; height: 40px; background: white; border-radius: 50% 50% 0 0; }")
                .append(".header h1 { color: #DAA520; font-size: 32px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }")
                .append(".header p { color: rgba(218,165,32,0.9); font-size: 16px; }")
                .append(".content { padding: 40px 30px; }")
                .append(".greeting { font-size: 22px; color: #1F2937; margin-bottom: 20px; font-weight: 600; }")
                .append(".message { color: #4B5563; line-height: 1.8; font-size: 16px; margin-bottom: 25px; }")
                .append(".info-box { background: linear-gradient(135deg, #DFD6C5 0%, #F5EFE6 100%); border-radius: 15px; padding: 25px; margin: 25px 0; border-left: 5px solid #DAA520; }")
                .append(".info-box h3 { color: #BC4A4D; font-size: 18px; margin-bottom: 15px; }")
                .append(".info-box ul { list-style: none; padding-left: 0; }")
                .append(".info-box li { color: #8B4513; margin: 10px 0; padding-left: 25px; position: relative; }")
                .append(".info-box li::before { content: '✓'; position: absolute; left: 0; color: #DAA520; font-weight: bold; font-size: 18px; }")
                .append(".cta-button { display: inline-block; background: linear-gradient(135deg, #BC4A4D 0%, #A24757 100%); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 15px rgba(188,74,77,0.3); }")
                .append(".footer { background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #DAA520; }")
                .append(".footer-message { color: #6B7280; font-size: 14px; margin: 10px 0; }")
                .append(".divider { height: 2px; background: linear-gradient(90deg, transparent, #DAA520, transparent); margin: 20px 0; }")
                .append("</style>")
                .append("</head>")
                .append("<body>")
                .append("<div class='email-wrapper'>")
                .append("<div class='header'>")
                .append("<h1>🎉 Congratulations!</h1>")
                .append("<p>Your Shop Application Has Been Approved</p>")
                .append("</div>")
                .append("<div class='content'>")
                .append("<p class='greeting'>Hello ").append(name).append(",</p>")
                .append("<p class='message'>")
                .append("Fantastic news! We're thrilled to inform you that your shop application has been approved. ")
                .append("Your shop is now live on Campus Eats! 🎊")
                .append("</p>")
                .append("<div class='info-box'>")
                .append("<h3>Getting Started</h3>")
                .append("<ul>")
                .append("<li>Log in to your Campus Eats shop dashboard</li>")
                .append("<li>Add or update your menu items</li>")
                .append("<li>Set your shop hours and availability</li>")
                .append("<li>Start accepting orders from hungry customers</li>")
                .append("<li>Track your orders and earnings in real-time</li>")
                .append("</ul>")
                .append("</div>")
                .append("<p class='message'>")
                .append("As a Campus Eats shop partner, you'll reach thousands of students and staff on campus. ")
                .append("Make sure to keep your menu updated, maintain quality food preparation, and provide excellent service to build a loyal customer base.")
                .append("</p>")
                .append("<div class='divider'></div>")
                .append("<p class='message' style='color: #BC4A4D; font-weight: 600;'>")
                .append("Ready to start serving? Access your shop dashboard now!")
                .append("</p>")
                .append("</div>")
                .append("<div class='footer'>")
                .append("<p class='footer-message'>Welcome to the Campus Eats family!</p>")
                .append("<p class='footer-message'>Need assistance? Our support team is here to help.</p>")
                .append("<div class='divider'></div>")
                .append("<p class='footer-message'>© 2025 Campus Eats. All rights reserved.</p>")
                .append("</div>")
                .append("</div>")
                .append("</body>")
                .append("</html>");

        return sb.toString();
    }
}
