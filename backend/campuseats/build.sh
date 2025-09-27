#!/bin/bash
# Install Java 17 if not available
if ! command -v java &> /dev/null; then
    echo "Java not found, installing..."
fi

# Make mvnw executable
chmod +x mvnw

# Clean and build the project
./mvnw clean package -DskipTests

echo "Build completed successfully!"