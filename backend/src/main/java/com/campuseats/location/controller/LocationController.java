package com.campuseats.location.controller;

import com.campuseats.location.dto.BroadcastLocation;
import com.campuseats.location.dto.ClientLocationUpdate;
import com.campuseats.location.service.GeofenceService;
import com.campuseats.location.service.LocationService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class LocationController {
  private final LocationService locationService;
  private final GeofenceService geofenceService;
  private final SimpMessagingTemplate template;

  private static final long MIN_INTERVAL_MS = 10_000; // 10 seconds
  private static final double SIGNIFICANT_MOVE_METERS = 15.0;

  private final Map<String, Instant> lastForward = new ConcurrentHashMap<>();
  private final Map<String, Position> lastPosition = new ConcurrentHashMap<>();
  private final Map<String, Boolean> wasOutside = new ConcurrentHashMap<>();
  private final Map<String, Set<UserRole>> sessionParticipants = new ConcurrentHashMap<>();

  record Position(double lat, double lng) {}
  record UserRole(String userId, String role) {}

  public LocationController(LocationService locationService, GeofenceService geofenceService, SimpMessagingTemplate template) {
    this.locationService = locationService;
    this.geofenceService = geofenceService;
    this.template = template;
  }

  private boolean hasGeofenceBypass(String userId) {
    return userId != null && userId.endsWith("-ADMIN");
  }

  private double distanceMeters(Position a, Position b) {
    if (a == null || b == null) return Double.MAX_VALUE;
    double R = 6371000;
    double dLat = Math.toRadians(b.lat - a.lat);
    double dLon = Math.toRadians(b.lng - a.lng);
    double la1 = Math.toRadians(a.lat);
    double la2 = Math.toRadians(b.lat);
    double h = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)*Math.sin(dLon/2);
    double c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
    return R * c;
  }

  private Set<UserRole> getSessionSet(String sessionId) {
    return sessionParticipants.computeIfAbsent(sessionId, k -> Collections.synchronizedSet(new HashSet<>()));
  }

  private void notifyCounterpart(String sessionId, String sourceRole, String type, String message) {
    for (UserRole ur : getSessionSet(sessionId)) {
      if (!ur.role.equals(sourceRole)) {
        template.convertAndSendToUser(ur.userId, "/queue/notifications", Map.of("type", type, "message", message));
      }
    }
  }

  @MessageMapping("/track")
  public void receive(@Payload ClientLocationUpdate update) {
    if (update == null || update.latitude == null || update.longitude == null || update.sessionId == null || update.userId == null) return;

    // Register participant
    getSessionSet(update.sessionId).add(new UserRole(update.userId, update.role));

    boolean bypass = hasGeofenceBypass(update.userId);
    var eval = geofenceService.evaluate(update.latitude, update.longitude);
    boolean outside = eval.outside() && !bypass;

    boolean previouslyOutside = wasOutside.getOrDefault(update.userId, false);

    // Hard enforcement: if outside and not bypass -> block send, send notifications once
    if (outside) {
      if (!previouslyOutside) {
        // user self notification
        template.convertAndSendToUser(update.userId, "/queue/notifications", Map.of(
            "type", "GEOFENCE_OUTSIDE_BLOCK",
            "message", "You are outside the allowed area. Move back inside to resume tracking."
        ));
        // counterpart notice
        if ("user".equals(update.role)) {
          notifyCounterpart(update.sessionId, update.role, "USER_OUT_OF_GEOFENCE", "Customer left the geofenced area.");
        } else if ("dasher".equals(update.role)) {
          notifyCounterpart(update.sessionId, update.role, "DASHER_OUT_OF_GEOFENCE", "Dasher left the geofenced area.");
        }
      }
      wasOutside.put(update.userId, true);
      return; // do not broadcast or persist
    }

    // If re-entering
    if (previouslyOutside && !outside) {
      template.convertAndSendToUser(update.userId, "/queue/notifications", Map.of(
          "type", "GEOFENCE_RESUMED", "message", "You are back inside the allowed area. Tracking resumed."
      ));
      if ("user".equals(update.role)) {
        notifyCounterpart(update.sessionId, update.role, "USER_BACK_IN_GEOFENCE", "Customer re-entered geofence.");
      } else if ("dasher".equals(update.role)) {
        notifyCounterpart(update.sessionId, update.role, "DASHER_BACK_IN_GEOFENCE", "Dasher re-entered geofence.");
      }
    }
    wasOutside.put(update.userId, false);

    // Throttle logic
    Instant now = Instant.now();
    Position current = new Position(update.latitude, update.longitude);
    Position lastPos = lastPosition.get(update.userId);
    Instant lastTime = lastForward.get(update.userId);
    double moveDist = distanceMeters(lastPos, current);

    if (lastTime != null) {
      long elapsed = now.toEpochMilli() - lastTime.toEpochMilli();
      if (elapsed < MIN_INTERVAL_MS && moveDist < SIGNIFICANT_MOVE_METERS) {
        return; // skip trivial update
      }
    }

    BroadcastLocation b = locationService.saveInsideLocation(update, bypass);
    b.nearBoundary = eval.nearEdge();
    template.convertAndSend("/topic/locations/" + update.sessionId, b);

    if (eval.nearEdge() && !bypass) {
      template.convertAndSendToUser(update.userId, "/queue/notifications", Map.of(
          "type", "GEOFENCE_NEAR", "message", "Approaching boundary."
      ));
    }

    lastForward.put(update.userId, now);
    lastPosition.put(update.userId, current);
  }
}