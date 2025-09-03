package com.campuseats.location.dto;

import java.time.Instant;

public class BroadcastLocation {
  public String userId;
  public double latitude;
  public double longitude;
  public Double speed;
  public Double heading;
  public Instant serverTime;
  public String role;
  public String sessionId;
  public boolean stale; // last known (when outside or GPS off)
  public boolean nearBoundary;
}