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
    private String azureOid; // Azure AD Object ID for OAuth authentication
    private String profilePictureUrl; // URL to profile picture in Azure Blob Storage

    // For backward compatibility
    private String provider; // Authentication provider (e.g., "azure")
    private String providerId; // ID from the provider

    @Builder.Default
    private int offenses = 0;

    @Builder.Default
    private boolean isBanned = false;

    // Getters
    public String getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public String getEmail() {
        return email;
    }

    public boolean getIsVerified() {
        return isVerified;
    }

    public String getAccountType() {
        return accountType;
    }

    public Date getDateCreated() {
        return dateCreated;
    }

    public String getFirstname() {
        return firstname;
    }

    public String getLastname() {
        return lastname;
    }

    public String getPhone() {
        return phone;
    }

    public String getDob() {
        return dob;
    }

    public String getCourseYear() {
        return courseYear;
    }

    public String getSchoolIdNum() {
        return schoolIdNum;
    }

    public String getAzureOid() {
        return azureOid;
    }

    public String getProfilePictureUrl() {
        return profilePictureUrl;
    }

    public String getProvider() {
        return provider;
    }

    public String getProviderId() {
        return providerId;
    }

    public int getOffenses() {
        return offenses;
    }

    public boolean getIsBanned() {
        return isBanned;
    }

    public boolean isBanned() {
        return isBanned;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setIsVerified(boolean isVerified) {
        this.isVerified = isVerified;
    }

    public void setVerified(boolean verified) {
        this.isVerified = verified;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }

    public void setDateCreated(Date dateCreated) {
        this.dateCreated = dateCreated;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public void setDob(String dob) {
        this.dob = dob;
    }

    public void setCourseYear(String courseYear) {
        this.courseYear = courseYear;
    }

    public void setSchoolIdNum(String schoolIdNum) {
        this.schoolIdNum = schoolIdNum;
    }

    public void setAzureOid(String azureOid) {
        this.azureOid = azureOid;
    }

    public void setProfilePictureUrl(String profilePictureUrl) {
        this.profilePictureUrl = profilePictureUrl;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public void setOffenses(int offenses) {
        this.offenses = offenses;
    }

    public void setBanned(boolean banned) {
        this.isBanned = banned;
    }

    public void setIsBanned(boolean isBanned) {
        this.isBanned = isBanned;
    }

    public boolean isVerified() {
        return isVerified;
    }
}