package com.fintrack.config;

import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Two instances asking for the same job lock: only the first gets it. */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:shedlocktest;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;"
                + "MODE=PostgreSQL;NON_KEYWORDS=MONTH,VALUE,YEAR,USER",
        "spring.flyway.enabled=true",
        "spring.flyway.placeholders.text_type=VARCHAR(1000000)",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@DisplayName("Scheduled-job lock (ShedLock)")
class SchedulerLockTest {

    @Autowired
    private LockProvider lockProvider;

    @Test
    @DisplayName("a held lock can't be taken again until it is released")
    void onlyOneHolder() {
        LockConfiguration config = new LockConfiguration(
                Instant.now(), "testJob", Duration.ofMinutes(5), Duration.ZERO);

        Optional<SimpleLock> first = lockProvider.lock(config);
        Optional<SimpleLock> second = lockProvider.lock(config);

        assertThat(first).isPresent();
        assertThat(second).isEmpty();

        first.get().unlock();
        Optional<SimpleLock> third = lockProvider.lock(config);
        assertThat(third).isPresent();
        third.get().unlock();
    }
}
