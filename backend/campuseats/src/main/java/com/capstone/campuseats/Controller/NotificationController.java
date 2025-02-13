package com.capstone.campuseats.Controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
        if (emitters.isEmpty()) {
            logger.warn("No active emitters to send notification.");
            return; // Early return if no listeners are present
        }
        
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(message);
                logger.info("Notification sent: {}", message);
            } catch (IOException e) {
                logger.error("Error sending notification: {}", e.getMessage());
                emitters.remove(emitter);
            }
        }
    }
}
