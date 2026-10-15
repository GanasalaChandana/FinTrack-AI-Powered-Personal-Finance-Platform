package com.fintrack.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * Earlier versions of this project shipped an empty placeholder {@code V1__create_users_table.sql}
 * and Flyway was run against production once, which left a history row for version 1 with
 * checksum 0. The real baseline script now lives in V1, so its checksum no longer matches and
 * startup fails with "Migration checksum mismatch for migration version 1".
 *
 * <p>That one row is safe to realign: the old V1 changed nothing and the schema was built by
 * Hibernate. We repair <b>only</b> in exactly that situation, so Flyway's checksum protection
 * stays active for every later migration.
 */
@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    @Bean
    public FlywayMigrationStrategy legacyAwareMigrationStrategy(DataSource dataSource) {
        return flyway -> {
            repairLegacyPlaceholderIfPresent(flyway, dataSource);
            flyway.migrate();
        };
    }

    static void repairLegacyPlaceholderIfPresent(Flyway flyway, DataSource dataSource) {
        if (hasLegacyEmptyV1(dataSource)) {
            log.warn("Found legacy empty V1 in flyway_schema_history (checksum 0); realigning it with the baseline script");
            flyway.repair();
        }
    }

    private static boolean hasLegacyEmptyV1(DataSource dataSource) {
        try {
            Integer n = new JdbcTemplate(dataSource).queryForObject(
                    "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND checksum = 0",
                    Integer.class);
            return n != null && n > 0;
        } catch (Exception e) {
            // No history table yet (fresh database) or it can't be read: nothing to repair.
            return false;
        }
    }
}
