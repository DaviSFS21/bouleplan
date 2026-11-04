plugins {
    java
    jacoco
    checkstyle
    pmd
    id("io.quarkus")
}

repositories {
    mavenCentral()
}

val quarkusPlatformGroupId: String by project
val quarkusPlatformArtifactId: String by project
val quarkusPlatformVersion: String by project

dependencies {
    implementation(enforcedPlatform("$quarkusPlatformGroupId:$quarkusPlatformArtifactId:$quarkusPlatformVersion"))
    implementation("io.quarkus:quarkus-rest-jackson")
    implementation("io.quarkus:quarkus-hibernate-orm-panache")
    implementation("io.quarkus:quarkus-jdbc-postgresql")
    implementation("io.quarkus:quarkus-flyway")
    implementation("io.quarkus:quarkus-smallrye-health")
    implementation("io.quarkus:quarkus-arc")

    testImplementation("io.quarkus:quarkus-junit5")
    testImplementation("io.quarkus:quarkus-jacoco")
    testImplementation("io.rest-assured:rest-assured")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

// Checkstyle: Google Style, zero tolerance.
checkstyle {
    toolVersion = "13.4.0"
    configFile = layout.projectDirectory.file("config/checkstyle/checkstyle.xml").asFile
    maxWarnings = 0
    maxErrors = 0
    isIgnoreFailures = false
    isShowViolations = true
}

// PMD: custom ruleset, zero tolerance.
pmd {
    toolVersion = "7.29.0"
    ruleSetFiles = files("config/pmd/ruleset.xml")
    ruleSets = emptyList()
    isIgnoreFailures = false
    isConsoleOutput = true
    rulesMinimumPriority = 5
}

// Coverage, as recommended by the Quarkus JaCoCo guide:
// - the Gradle JaCoCo agent measures plain unit tests. It skips the Quarkus
//   class loader, because classes loaded there are transformed and would not
//   match the compiled classes on disk;
// - the quarkus-jacoco extension measures code running inside @QuarkusTest,
//   reuses the agent's data file, and writes a single merged report to
//   build/jacoco-report/jacoco.xml (settings in application.properties).
// The Gradle jacocoTestReport task is therefore disabled.
jacoco {
    toolVersion = "0.8.14"
}

tasks.test {
    useJUnitPlatform()
    systemProperty("java.util.logging.manager", "org.jboss.logmanager.LogManager")
    extensions.configure<JacocoTaskExtension> {
        excludeClassLoaders = listOf("*QuarkusClassLoader")
        setDestinationFile(layout.buildDirectory.file("jacoco-quarkus.exec").get().asFile)
    }
}

tasks.jacocoTestReport {
    enabled = false
}
