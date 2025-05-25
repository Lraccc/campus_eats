FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy the Maven wrapper and POM
COPY .mvn/ .mvn/
COPY mvnw mvnw.cmd ./
COPY pom.xml ./

# Make the Maven wrapper executable
RUN chmod +x mvnw

# Copy source code
COPY src/ src/

# Build the application
RUN ./mvnw clean package -DskipTests

# Run the application
EXPOSE 8080
ENTRYPOINT ["java", "-Dserver.port=${PORT}", "-jar", "target/campuseats-0.0.1-SNAPSHOT.jar"]
