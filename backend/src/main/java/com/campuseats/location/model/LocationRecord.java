package com.campuseats.location.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "locations")
public class LocationRecord {
  @Id
  private String userId;
  @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
  private GeoJsonPoint point;
  private Instant lastUpdate;
  private String sessionId;
  private boolean geofenceBypass;
  private String role; // user | dasher | shop

  public LocationRecord() {}

  public LocationRecord(String userId, GeoJsonPoint point, Instant lastUpdate, String sessionId, boolean geofenceBypass, String role) {
    this.userId = userId;
    this.point = point;
    this.lastUpdate = lastUpdate;
    this.sessionId = sessionId;
    this.geofenceBypass = geofenceBypass;
    this.role = role;
  }

  public String getUserId() { return userId; }
  public GeoJsonPoint getPoint() { return point; }
  public Instant getLastUpdate() { return lastUpdate; }
  public String getSessionId() { return sessionId; }
  public boolean isGeofenceBypass() { return geofenceBypass; }
  public String getRole() { return role; }

  public void setPoint(GeoJsonPoint point) { this.point = point; }
  public void setLastUpdate(Instant lastUpdate) { this.lastUpdate = lastUpdate; }
  public void setSessionId(String sessionId) { this.sessionId = sessionId; }
  public void setGeofenceBypass(boolean geofenceBypass) { this.geofenceBypass = geofenceBypass; }
  public void setRole(String role) { this.role = role; }
}