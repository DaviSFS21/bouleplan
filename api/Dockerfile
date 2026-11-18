FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Wrapper and build files first: this layer, with every dependency downloaded, only rebuilds
# when they change. A cache mount would keep the jars out of the layer and out of the CI cache.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN ./gradlew --no-daemon quarkusGoOffline

COPY src src
COPY config config
RUN ./gradlew --no-daemon quarkusBuild -x test

FROM eclipse-temurin:21-jre
WORKDIR /deployments

COPY --from=build /workspace/build/quarkus-app/lib/ lib/
COPY --from=build /workspace/build/quarkus-app/*.jar ./
COPY --from=build /workspace/build/quarkus-app/app/ app/
COPY --from=build /workspace/build/quarkus-app/quarkus/ quarkus/

USER 185
EXPOSE 8080
# The JVM reads this variable itself, so it stays overridable at run time.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/deployments/quarkus-run.jar"]
