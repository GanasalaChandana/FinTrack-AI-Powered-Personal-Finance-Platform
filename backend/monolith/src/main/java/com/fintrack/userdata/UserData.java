package com.fintrack.userdata;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

/** One piece of a user's app data, stored as the JSON the browser saved. */
@Entity
@Table(name = "user_data")
@IdClass(UserData.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UserData {

    @Id @Column(name = "user_id", length = 64)
    private String userId;

    @Id @Column(name = "data_key", length = 100)
    private String key;

    @Column(name = "data_value", nullable = false, columnDefinition = "TEXT")
    private String value;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private String userId;
        private String key;
    }
}
