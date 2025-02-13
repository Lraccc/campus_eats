package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.cglib.core.Local;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Document(collection = "cashouts")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class CashoutEntity {
    @Id
    private String id;
    private String status;
    private String gcashQr;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private double amount;
    private String referenceNumber;
    private LocalDateTime paidAt;
}
