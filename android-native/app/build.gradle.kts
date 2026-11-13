plugins { id("com.android.application") }
android {
    namespace = "com.findaflatmate.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.findaflatmate.app"
        minSdk = 33
        targetSdk = 36
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
