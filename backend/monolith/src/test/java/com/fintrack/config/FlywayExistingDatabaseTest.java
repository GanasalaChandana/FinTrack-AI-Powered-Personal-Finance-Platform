package com.fintrack.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Production's database was created by Hibernate and has no Flyway history. Flyway must
 * baseline it at version 1 and must NOT run V1__baseline_schema.sql against it.
 */
@DisplayName("Flyway on an existing database")
class FlywayExistingDatabaseTest {

    @Test
    @DisplayName("is baselined at V1 and the baseline script is not run")
    void existingDatabase_isBaselinedNotMigrated() {
        DriverManagerDataSource existing = new DriverManagerDataSource(
                "jdbc:h2:mem:existingdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL", "sa", "");
        JdbcTemplate jdbc = new JdbcTemplate(existing);
        // A non-empty schema without a Flyway history table, like production today.
        jdbc.execute("CREATE TABLE users (id UUID PRIMARY KEY)");

        Flyway flyway = Flyway.configure()
                .dataSource(existing)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .placeholders(Map.of("text_type", "TEXT"))
                .load();
        flyway.migrate();

        MigrationInfo current = flyway.info().current();
        assertEquals("BASELINE", current.getType().name());
        assertEquals("1", current.getVersion().getVersion());

        Integer alertsTables = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE UPPER(table_name) = 'ALERTS'",
                Integer.class);
        assertEquals(0, alertsTables.intValue(), "V1 must not run against an already-populated database");
    }
}
