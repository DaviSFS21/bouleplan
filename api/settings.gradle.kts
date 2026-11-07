pluginManagement {
    val quarkusPluginVersion = providers.gradleProperty("quarkusPluginVersion").get()
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("io.quarkus") version quarkusPluginVersion
    }
}
rootProject.name = "bouleplan-api"
