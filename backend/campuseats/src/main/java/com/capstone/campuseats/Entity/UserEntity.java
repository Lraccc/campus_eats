package com.capstone.campuseats.Entity;

import java.util.Date;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Document(collection = "users")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class UserEntity {
    @Id
    private String id;
    private String username;
    private String password;
    private String email;
    private boolean isVerified;
    private String accountType;
    private Date dateCreated;
    private String firstname;
    private String lastname;
    private String phone;
    private String dob;
    private String courseYear;
    private String schoolIdNum;

    // Fields for OAuth / Provider tracking
    private String provider; // e.g., "local", "azure"
    private String providerId; // Unique ID from the provider (e.g., Azure OID)

    @Builder.Default
    private int offenses = 0;

    @Builder.Default
    private boolean isBanned = false;

}
