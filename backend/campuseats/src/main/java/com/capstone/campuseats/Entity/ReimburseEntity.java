package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "reimbursements")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class ReimburseEntity {
    @Id
    private String id;
    private String orderId;
    private String dasherId;
    private String status;
    private String gcashQr;
    private String gcashName;
    private String gcashNumber;
    private LocalDateTime createdAt;
    private String referenceNumber;
    private String locationProof;
    private String noShowProof;
    private double amount;
    private LocalDateTime paidAt;
}
