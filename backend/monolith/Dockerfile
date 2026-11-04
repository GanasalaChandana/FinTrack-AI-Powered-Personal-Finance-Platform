FROM maven:3.9.5-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Unpack the fat jar into plain jars on a classpath: faster to start than nested
# jars, and the layout the class-data cache (CDS) below needs.
RUN mkdir -p /app/out/lib \
 && cd /app/out \
 && jar xf /app/target/fintrack-monolith-0.0.1-SNAPSHOT.jar \
 && (cd BOOT-INF/classes && jar cf /app/out/app.jar .) \
 && mv BOOT-INF/lib/*.jar lib/ \
 && rm -rf BOOT-INF META-INF org

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# The commit this image was built from, reported by GET /api/auth/health
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY --from=build /app/out/ ./

# Startup is dominated by class loading and JIT on Render's small CPU share:
#  - TieredStopAtLevel=1: quick C1 compiler only (big win for a short-lived start)
#  - SerialGC: least overhead on a fraction of one CPU
#  - SharedArchiveFile: classes pre-parsed into a CDS archive at build time
ENV JAVA_OPTS="-XX:TieredStopAtLevel=1 -XX:+UseSerialGC -XX:MaxRAMPercentage=75 -XX:SharedArchiveFile=/app/app.jsa -Xlog:cds=off -Xlog:cds+dynamic=off"

# Training run for the CDS archive: start the app until the Spring context is
# refreshed, then dump the loaded classes. There's no database at build time, so
# the run stops at the connection attempt; the classes loaded until then are
# still archived (and the app falls back to normal loading if the archive is bad).
RUN JWT_SECRET=build-time-only-cds-training-secret-0123456789abcdef \
    DATABASE_URL=jdbc:postgresql://127.0.0.1:1/none DB_USERNAME=x DB_PASSWORD=x \
    java -XX:ArchiveClassesAtExit=/app/app.jsa -Dspring.context.exit=onRefresh \
         -XX:TieredStopAtLevel=1 -XX:+UseSerialGC \
         -cp "app.jar:lib/*" com.fintrack.FinTrackApplication > /dev/null 2>&1 || true; \
    test -s /app/app.jsa

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -cp 'app.jar:lib/*' com.fintrack.FinTrackApplication"]
