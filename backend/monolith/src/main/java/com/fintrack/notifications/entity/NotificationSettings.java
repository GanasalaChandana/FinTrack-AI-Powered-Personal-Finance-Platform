package com.fintrack.notifications.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "notification_settings")
public class NotificationSettings {

    @Id
    @Column(length = 128)
    private String userId;

    @Builder.Default
    private boolean emailEnabled = true;
    @Builder.Default
    private boolean pushEnabled = true;
    @Builder.Default
    private boolean budgetAlertsEnabled = true;
    @Builder.Default
    private boolean transactionAlertsEnabled = true;
    @Builder.Default
    private boolean systemNotificationsEnabled = true;
}
