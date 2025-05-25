FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Copy the entire context (which should be the backend/campuseats directory)
COPY . .
RUN mvn clean package -DskipTests

FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=build /app/target/campuseats-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Dserver.port=${PORT}", "-jar", "app.jar"]
