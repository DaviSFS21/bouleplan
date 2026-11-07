plugins {
    java
    jacoco
    checkstyle
    pmd
    alias(libs.plugins.quarkus)
    alias(libs.plugins.spotless)
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(enforcedPlatform(libs.quarkus.bom))
    implementation("io.quarkus:quarkus-rest-jackson")
    implementation("io.quarkus:quarkus-hibernate-orm-panache")
    implementation("io.quarkus:quarkus-jdbc-postgresql")
    implementation("io.quarkus:quarkus-flyway")
    implementation("io.quarkus:quarkus-smallrye-health")
    implementation("io.quarkus:quarkus-arc")

    testImplementation("io.quarkus:quarkus-junit5")
    testImplementation("io.quarkus:quarkus-jacoco")
    testImplementation("io.rest-assured:rest-assured")
    testImplementation(libs.assertj.core)
    testImplementation(libs.archunit.junit5)
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

// Dev mode: database credentials come from the repository root .env (shared
// with Docker Compose and git-ignored). Each KEY=value line becomes an
// environment variable of quarkusDev; blank lines and # comments are skipped.
// A missing file is fine here: Quarkus then fails with a clear message naming
// the unresolved ${DB_...} property.
tasks.quarkusDev {
    val envFile = rootDir.resolve("../.env")
    if (envFile.isFile) {
        environmentVariables.set(
            envFile.readLines()
                .map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
                .associate { it.substringBefore("=").trim() to it.substringAfter("=").trim() },
        )
    }
}

// Checkstyle: Google Style, zero tolerance.
checkstyle {
    toolVersion = libs.versions.checkstyle.get()
    configFile = layout.projectDirectory.file("config/checkstyle/checkstyle.xml").asFile
    maxWarnings = 0
    maxErrors = 0
    isIgnoreFailures = false
    isShowViolations = true
}

// Spotless: google-java-format is the single source of truth for formatting.
// `check` depends on spotlessCheck, so unformatted code fails the build;
// run `./gradlew spotlessApply` to fix it.
spotless {
    java {
        target("src/main/java/**/*.java", "src/test/java/**/*.java")
        googleJavaFormat(libs.versions.google.java.format.get())
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}

// PMD: custom ruleset, zero tolerance.
pmd {
    toolVersion = libs.versions.pmd.get()
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
    toolVersion = libs.versions.jacoco.get()
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
