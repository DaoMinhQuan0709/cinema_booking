# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY src/main src/main
RUN --mount=type=cache,target=/root/.m2 \
    sh mvnw --batch-mode --no-transfer-progress -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre-jammy
RUN command -v curl \
    && groupadd --system cinema \
    && useradd --system --gid cinema cinema
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
USER cinema
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
