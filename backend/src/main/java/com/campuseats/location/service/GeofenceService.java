package com.campuseats.location.service;

import org.springframework.stereotype.Service;

@Service
public class GeofenceService {
  private static final double CENTER_LAT = 10.295349085857447;
  private static final double CENTER_LNG = 123.88070205149705;
  private static final double RADIUS_METERS = 370.0;
  private static final double NEAR_THRESHOLD_METERS = 35.0; // updated margin

  public record GeofenceEval(boolean outside, boolean nearEdge, double distance) {}

  public GeofenceEval evaluate(double lat, double lng) {
    double d = distanceMeters(CENTER_LAT, CENTER_LNG, lat, lng);
    boolean outside = d > RADIUS_METERS;
    boolean near = !outside && d > (RADIUS_METERS - NEAR_THRESHOLD_METERS);
    return new GeofenceEval(outside, near, d);
  }

  public double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    double R = 6371000;
    double dLat = Math.toRadians(lat2 - lat1);
    double dLon = Math.toRadians(lon2 - lon1);
    double a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(Math.toRadians(lat1))*Math.cos(Math.toRadians(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public double getRadius() { return RADIUS_METERS; }
  public double getCenterLat() { return CENTER_LAT; }
  public double getCenterLng() { return CENTER_LNG; }
  public double getNearThreshold() { return NEAR_THRESHOLD_METERS; }
}