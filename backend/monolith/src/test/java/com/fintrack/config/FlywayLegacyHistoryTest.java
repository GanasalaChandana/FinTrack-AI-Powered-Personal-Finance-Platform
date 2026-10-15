package com.fintrack.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.exception.FlywayValidateException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Reproduces the production startup failure: a history row for version 1 with checksum 0
 * (left by the old empty placeholder migration) must not stop the app from starting.
 */
@DisplayName("Flyway with the legacy empty V1 in its history")
class FlywayLegacyHistoryTest {

    @Test
    @DisplayName("fails validation without the repair, starts with it, and does not hide other changes")
    void legacyChecksumIsRealigned() {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:h2:mem:legacyhistory;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL", "sa", "");
        Flyway flyway = Flyway.configure()
                .dataSource(ds)
                .locations("classpath:db/migration")
                .placeholders(Map.of("text_type", "VARCHAR(1000000)"))
                .load();
        flyway.migrate();

        JdbcTemplate jdbc = new JdbcTemplate(ds);
        jdbc.update("UPDATE flyway_schema_history SET checksum = 0 WHERE version = '1'");

        assertThrows(FlywayValidateException.class, flyway::migrate);

        FlywayConfig.repairLegacyPlaceholderIfPresent(flyway, ds);
        flyway.migrate(); // must not throw now

        Integer zero = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND checksum = 0", Integer.class);
        assertEquals(0, zero.intValue());

        // A different checksum is a genuine edit and must still be rejected.
        jdbc.update("UPDATE flyway_schema_history SET checksum = 12345 WHERE version = '1'");
        FlywayConfig.repairLegacyPlaceholderIfPresent(flyway, ds);
        assertThrows(FlywayValidateException.class, flyway::migrate);
    }
}
