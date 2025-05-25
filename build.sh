#!/bin/bash
# Navigate to backend directory
cd backend/campuseats

# Make Maven wrapper executable
chmod +x ./mvnw

# Run Maven build
./mvnw clean package -DskipTests
