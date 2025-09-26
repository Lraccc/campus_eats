package com.capstone.campuseats.Controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class WebSocketController {

    @MessageMapping("/test")
    @SendTo("/topic/test")
    public Map<String, Object> handleTestMessage(Map<String, Object> message) {
        return Map.of(
            "message", "Test message received: " + message.get("content"),
            "timestamp", System.currentTimeMillis()
        );
    }
}