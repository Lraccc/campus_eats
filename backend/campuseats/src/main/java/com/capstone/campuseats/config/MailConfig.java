package com.capstone.campuseats.Config;

// DEPRECATED: No longer using SMTP, now using Brevo HTTP API
// import org.springframework.context.annotation.Bean;
// import org.springframework.beans.factory.annotation.Value;
// import org.springframework.context.annotation.Configuration;
// import org.springframework.mail.javamail.JavaMailSender;
// import org.springframework.mail.javamail.JavaMailSenderImpl;

// import java.util.Properties;

// @Configuration
public class MailConfig {

    // DEPRECATED: Commented out since we're using Brevo HTTP API instead of SMTP
    // This class is kept for reference but not active
    
    /*
    @Value("${env.EMAIL_HOST}")
    private String host;

    @Value("${env.EMAIL_PORT}")
    private int port;

    @Value("${env.EMAIL_ID}")
    private String username;

    @Value("${env.EMAIL_PASSWORD}")
    private String password;

    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(host);
        mailSender.setPort(port);
        mailSender.setUsername(username);
        mailSender.setPassword(password);

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.debug", "true");

        return mailSender;
    }
    */
}

