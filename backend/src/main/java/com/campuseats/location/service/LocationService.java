package com.campuseats.location.service;

import com.campuseats.location.dto.BroadcastLocation;
import com.campuseats.location.dto.ClientLocationUpdate;
import com.campuseats.location.model.LocationRecord;
import com.campuseats.location.repo.LocationRepository;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LocationService {
  private final LocationRepository repo;
  private final GeofenceService geofenceService;

  public LocationService(LocationRepository repo, GeofenceService geofenceService) {
    this.repo = repo;
    this.geofenceService = geofenceService;
  }

  public BroadcastLocation saveInsideLocation(ClientLocationUpdate in, boolean geofenceBypass) {
    var record = new LocationRecord(
        in.userId,
        new GeoJsonPoint(in.longitude, in.latitude),
        Instant.now(),
        in.sessionId,
        geofenceBypass,
        in.role
    );
    repo.save(record);

    BroadcastLocation b = new BroadcastLocation();
    b.userId = in.userId;
    b.latitude = in.latitude;
    b.longitude = in.longitude;
    b.speed = in.speed;
    b.heading = in.heading;
    b.serverTime = Instant.now();
    b.role = in.role;
    b.sessionId = in.sessionId;
    b.stale = false;
    return b;
  }

  public List<BroadcastLocation> getSession(String sessionId) {
    return repo.findBySessionId(sessionId).stream().map(r -> {
      BroadcastLocation b = new BroadcastLocation();
      b.userId = r.getUserId();
      b.latitude = r.getPoint().getY();
      b.longitude = r.getPoint().getX();
      b.serverTime = r.getLastUpdate();
      b.role = r.getRole();
      b.sessionId = r.getSessionId();
      b.stale = false;
      return b;
    }).collect(Collectors.toList());
  }
}