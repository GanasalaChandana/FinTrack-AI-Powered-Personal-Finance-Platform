package com.fintrack.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the Flyway rollout:
 *  1. On a brand-new database, V1 builds a schema that Hibernate's strict validation
 *     (ddl-auto=validate) accepts, i.e. the baseline matches the JPA entities.
 *  2. On an existing database (like production, built by Hibernate), Flyway only
 *     baselines at version 1 and never runs V1 against it.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:flywaybaseline;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;"
                + "MODE=PostgreSQL;NON_KEYWORDS=MONTH,VALUE,YEAR,USER",
        "spring.flyway.enabled=true",
        // H2 maps TEXT to a CLOB, which Hibernate's validator rejects for a String; use a big VARCHAR here.
        "spring.flyway.placeholders.text_type=VARCHAR(1000000)",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@DisplayName("Flyway baseline")
class FlywayBaselineTest {

    @Autowired
    private Flyway flyway;

    @Test
    @DisplayName("fresh database: V1 creates a schema that matches the entities")
    void freshDatabase_baselineMatchesEntities() {
        // If V1 disagreed with the entities, this Spring context would not have started
        // (ddl-auto=validate), so reaching here already proves the match.
        MigrationInfo current = flyway.info().current();
        assertEquals("1", current.getVersion().getVersion());
        assertTrue(current.getState().isApplied());
        assertEquals(MigrationType.SQL, current.getType());
    }

    @Test
    @DisplayName("existing database: baselined at V1, baseline script is not run")
    void existingDatabase_isBaselinedNotMigrated() {
        DriverManagerDataSource legacy = new DriverManagerDataSource(
                "jdbc:h2:mem:legacydb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL", "sa", "");
        JdbcTemplate jdbc = new JdbcTemplate(legacy);
        // A non-empty schema without a Flyway history table, like production today.
        jdbc.execute("CREATE TABLE users (id UUID PRIMARY KEY)");

        Flyway legacyFlyway = Flyway.configure()
                .dataSource(legacy)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .placeholders(Map.of("text_type", "TEXT"))
                .load();
        legacyFlyway.migrate();

        MigrationInfo current = legacyFlyway.info().current();
        assertEquals(MigrationType.BASELINE, current.getType());
        assertEquals("1", current.getVersion().getVersion());

        Integer alertsTables = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE UPPER(table_name) = 'ALERTS'",
                Integer.class);
        assertEquals(0, alertsTables, "V1 must not run against an already-populated database");
    }
}
