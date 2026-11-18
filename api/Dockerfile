FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Wrapper and build files first: the dependency layer only rebuilds when they change.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon help

COPY src src
COPY config config
RUN --mount=type=cache,target=/root/.gradle ./gradlew quarkusBuild -x test --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /deployments

COPY --from=build /workspace/build/quarkus-app/lib/ lib/
COPY --from=build /workspace/build/quarkus-app/*.jar ./
COPY --from=build /workspace/build/quarkus-app/app/ app/
COPY --from=build /workspace/build/quarkus-app/quarkus/ quarkus/

USER 185
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /deployments/quarkus-run.jar"]
