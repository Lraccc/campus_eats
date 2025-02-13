package com.capstone.campuseats.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Document(collection = "dashers")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DasherEntity {
    @Id
    private String id;
    private LocalTime availableStartTime; // Available time start
    private LocalTime availableEndTime;
    private List<String> daysAvailable;
    private String status;
    private String schoolId;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private double wallet;
}
