package com.campuseats.location.task;

import com.campuseats.location.repo.LocationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class InactivityTask {
  private final LocationRepository repo;
  private final SimpMessagingTemplate template;

  private static final long INACTIVITY_MS = 40L * 60L * 1000L; // 40 minutes

  public InactivityTask(LocationRepository repo, SimpMessagingTemplate template) {
    this.repo = repo;
    this.template = template;
  }

  @Scheduled(fixedRate = 60_000)
  public void check() {
    Instant now = Instant.now();
    repo.findAll().forEach(r -> {
      if (now.toEpochMilli() - r.getLastUpdate().toEpochMilli() > INACTIVITY_MS) {
        template.convertAndSendToUser(r.getUserId(), "/queue/notifications", java.util.Map.of(
            "type", "INACTIVITY_WARNING", "message", "No movement detected for 40 minutes."));
      }
    });
  }
}