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
    implementation("io.quarkus:quarkus-smallrye-openapi")
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

// API contract: the OpenAPI schema generated at build time is normalized (stable
// formatting, UTF-8) and compared with the committed ../contract/openapi.json.
val committedContract = rootDir.resolve("../contract/openapi.json")
val generatedContract = layout.buildDirectory.file("contract/openapi.json")

val generateContract by tasks.registering {
    description = "Generates the normalized OpenAPI schema into build/contract."
    dependsOn(tasks.quarkusBuild)
    val source = layout.buildDirectory.file("openapi/openapi.json")
    inputs.file(source)
    outputs.file(generatedContract)
    doLast {
        val parsed = groovy.json.JsonSlurper().parse(source.get().asFile)
        val generator = groovy.json.JsonGenerator.Options().disableUnicodeEscaping().build()
        val target = generatedContract.get().asFile
        target.parentFile.mkdirs()
        target.writeText(groovy.json.JsonOutput.prettyPrint(generator.toJson(parsed)) + "\n")
    }
}

val updateContract by tasks.registering {
    group = "verification"
    description = "Rewrites contract/openapi.json from the current code."
    dependsOn(generateContract)
    doLast {
        committedContract.parentFile.mkdirs()
        generatedContract.get().asFile.copyTo(committedContract, overwrite = true)
    }
}

val checkContract by tasks.registering {
    group = "verification"
    description = "Fails if contract/openapi.json differs from the schema generated by the code."
    dependsOn(generateContract)
    doLast {
        val generated = generatedContract.get().asFile.readText()
        if (!committedContract.isFile || committedContract.readText() != generated) {
            throw GradleException(
                "contract/openapi.json is out of date. Run ./gradlew updateContract and commit it.",
            )
        }
    }
}

tasks.check {
    dependsOn(checkContract)
}
