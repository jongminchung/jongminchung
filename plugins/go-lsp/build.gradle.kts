import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
    id("org.jetbrains.intellij.platform")
}

group = "kr.jamie.golsp"
version = "0.3.0"

kotlin {
    jvmToolchain(21)
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
    }
}

dependencies {
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation("junit:junit:4.13.2")

    intellijPlatform {
        intellijIdea("2025.3.5")
        testFramework(TestFrameworkType.Platform)
    }
}

intellijPlatform {
    pluginConfiguration {
        name = "Go LSP"
        version = project.version.toString()

        ideaVersion {
            sinceBuild = "253"
        }
    }

    pluginVerification {
        ides {
            create(IntelliJPlatformType.IntellijIdea, "2025.3.5")
            create(IntelliJPlatformType.IntellijIdea, "2026.1.4")
            create(IntelliJPlatformType.IntellijIdea, "2026.2")
        }
    }
}

intellijPlatformTesting.runIde.register("runIde2025_3") {
    type = IntelliJPlatformType.IntellijIdea
    version = "2025.3.5"
}

intellijPlatformTesting.runIde.register("runIde2026_1") {
    type = IntelliJPlatformType.IntellijIdea
    version = "2026.1.4"
}

intellijPlatformTesting.runIde.register("runIde2026_2") {
    type = IntelliJPlatformType.IntellijIdea
    version = "2026.2"
}

tasks.register("verifyCompatibility") {
    group = "verification"
    description = "Runs plugin tests and compatibility checks against all supported IDE releases."
    dependsOn(
        "test",
        "buildPlugin",
        "verifyPlugin",
        "verifyPluginProjectConfiguration",
        "verifyPluginStructure",
    )
}
