package com.capstone.campuseats.Controller;

import com.capstone.campuseats.Service.WebSocketNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class NotificationController {

    private static final Logger logger = LoggerFactory.getLogger(NotificationController.class);
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    
    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    @GetMapping("/test")
    public String test() {
        return "Controller is working!";
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications() {
        logger.info("Stream request received.");
        SseEmitter emitter = new SseEmitter();

        emitters.add(emitter);
        logger.info("Emitter added. Current emitters count: {}", emitters.size());

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            logger.info("Emitter completed. Current emitters count: {}", emitters.size());
        });
        
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            logger.warn("Emitter timed out. Current emitters count: {}", emitters.size());
        });

        return emitter;
    }

    public void sendNotification(String message) {
        // Send via WebSocket (primary method)
        try {
            webSocketNotificationService.sendGlobalNotification(message);
            logger.info("WebSocket notification sent: {}", message);
        } catch (Exception e) {
            logger.error("Error sending WebSocket notification: {}", e.getMessage());
        }
        
        // Send via SSE (fallback method) 
        if (emitters.isEmpty()) {
            logger.warn("No active SSE emitters to send notification.");
        } else {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(message);
                    logger.info("SSE notification sent: {}", message);
                } catch (IOException e) {
                    logger.error("Error sending SSE notification: {}", e.getMessage());
                    emitters.remove(emitter);
                }
            }
        }
    }
}
