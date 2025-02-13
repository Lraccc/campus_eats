package com.capstone.campuseats.config;

import com.capstone.campuseats.Entity.OrderEntity;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class EmailUtils {

    // Existing method for account verification emails
    public static String getEmailMessage(String name, String host, String token) {
        return "Hello " + name + ",\n\nPlease click the link below to verify your account.\n\n"
                + getVerificationUrl(host, token) + "\n\nCampus Eats Team";
    }

    private static String getVerificationUrl(String host, String token) {
        return host + "api/users/verify?token=" + token;
    }

     // New method for generating e-receipt email content
    public String generateReceiptHtml(OrderEntity order) {
        StringBuilder sb = new StringBuilder();

        sb.append("<html>")
          .append("<head><style>")
          .append("body { font-family: Arial, sans-serif; }")
          .append(".container { width: 80%; margin: 0 auto; padding: 20px; }")
          .append(".header { background-color: #A24757; color: #FFD700; padding: 10px; text-align: center; font-weight: bold; }")
          .append(".bold { font-weight: bold; }")
          .append(".maroon { color: #A24757; font-size: 1.2em; font-weight: bold; }")
          .append(".gold { color: #FFD700; font-weight: bold; font-size: 1.2em; }")
          .append(".items { width: 100%; border-collapse: collapse; margin: 20px 0; }")
          .append(".items th, .items td { padding: 8px 12px; border: 1px solid #ddd; }")
          .append(".total { text-align: right; margin-top: 20px; }")
          .append("</style></head>")
          .append("<body>")
          .append("<div class='container'>")
          
          // Header
          .append("<div class='header'><h2>Your Order is Complete</h2></div>")
          
          // Greeting
          .append("<p class='maroon'>Dear Customer,</p>")
          .append("<p>Thank you for your order! Here are the details:</p>")
          
          // Order details
          .append("<p class='bold'>Order ID: ").append(order.getId()).append("</p>")
          .append("<p class='bold'>Date: ").append(formatOrderDate(order.getCreatedAt())).append("</p>")
          .append("<p class='bold'>Delivery To: ").append(order.getDeliverTo()).append("</p>")
          .append("<p class='bold'>Payment Method: ").append(order.getPaymentMethod()).append("</p>")
          
          // Items ordered
          .append("<h3>Items Ordered</h3>")
          .append("<table class='items'>")
          .append("<thead><tr><th>Item</th><th>Quantity</th><th>Price</th></tr></thead>")
          .append("<tbody>");

        // Loop through the items in the order
        order.getItems().forEach(item -> {
            sb.append("<tr>")
              .append("<td>").append(item.getName()).append("</td>")
              .append("<td>").append(item.getQuantity()).append("</td>")
              .append("<td>&#8369;").append(String.format("%.2f", item.getPrice())).append("</td>")
              .append("</tr>");
        });

        sb.append("</tbody></table>")
          
          // Subtotal, Delivery Fee, and Total
          .append("<div class='total'>")
          .append("<h3>Subtotal: &#8369;").append(String.format("%.2f", order.getTotalPrice())).append("</h3>")
          .append("<h3>Delivery Fee: &#8369;").append(String.format("%.2f", order.getDeliveryFee())).append("</h3>")
          .append("<h3>Total: &#8369;").append(String.format("%.2f", order.getTotalPrice() + order.getDeliveryFee())).append("</h3></div>")
          
          // Thank you message
          .append("<p class='gold'>Thank you for ordering with Campus Eats!</p>")
          .append("</div></body></html>");

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
}
