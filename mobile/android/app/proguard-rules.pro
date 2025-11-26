# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ========================================
# AGGRESSIVE OPTIMIZATION FOR SMALLER APK
# ========================================
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification
-dontpreverify
-repackageclasses ''
-keepattributes *Annotation*

# ========================================
# REACT NATIVE
# ========================================
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ========================================
# AGORA SDK - OPTIMIZED
# ========================================
# Keep only essential Agora classes
-keep class io.agora.rtc.** { *; }
-keep class io.agora.rtc2.** { *; }
-keep interface io.agora.rtc.** { *; }
-keep interface io.agora.rtc2.** { *; }

# Remove Agora's optional features we don't use
-dontwarn io.agora.base.**
-dontwarn io.agora.utils.**

# Agora JNI
-keepclasseswithmembernames class * {
    native <methods>;
}

# ========================================
# EXPO MODULES
# ========================================
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }

# ========================================
# REMOVE DEBUG & LOGGING (MAJOR SIZE REDUCTION)
# ========================================
# Remove all logging in production
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Remove console.log equivalents
-assumenosideeffects class * {
    void println(...);
    void print(...);
}

# ========================================
# GENERAL OPTIMIZATIONS
# ========================================
# Remove unused resources at build time
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Kotlin
-dontwarn kotlin.**
-dontnote kotlin.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# ========================================
# KEEP ESSENTIAL CLASSES
# ========================================
# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep setters/getters
-keepclassmembers public class * extends android.view.View {
   void set*(***);
   *** get*();
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelables
-keep class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator *;
}
