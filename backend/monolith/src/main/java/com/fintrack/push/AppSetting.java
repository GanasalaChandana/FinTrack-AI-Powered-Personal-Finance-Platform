package com.fintrack.push;

import jakarta.persistence.*;
import lombok.*;

/** A small app-wide value that must survive restarts. */
@Entity
@Table(name = "app_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AppSetting {
    @Id @Column(name = "setting_key", length = 100)
    private String key;

    @Column(name = "setting_value", nullable = false, columnDefinition = "TEXT")
    private String value;
}
