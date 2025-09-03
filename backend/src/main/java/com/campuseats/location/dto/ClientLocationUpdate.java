package com.campuseats.location.dto;

public class ClientLocationUpdate {
  public String userId;
  public Double latitude;
  public Double longitude;
  public Double speed;
  public Double heading;
  public String timestamp;
  public String sessionId;
  public String role; // user | dasher | shop
}