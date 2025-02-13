package com.capstone.campuseats.Entity;

import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ratings")
@Data
@AllArgsConstructor
@NoArgsConstructor
@SuperBuilder
@Setter
@Getter
public class RatingEntity {
    @Id
    private String id;
    private String dasherId;
    private String shopId;
    private String orderId;
    private int rate;
    private String comment;
    private String type;

}
