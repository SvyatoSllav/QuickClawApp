module.exports = {
  expo: {
    name: "EasyClaw",
    slug: "easyclaw-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    scheme: "simpleclaw",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#07080A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.simpleclaw.app",
      usesAppleSignIn: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#07080A",
      },
      edgeToEdgeEnabled: true,
      package: "com.simpleclaw.app",
      targetSdkVersion: 35,
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    extra: {
      eas: {
        projectId: "9bbfa377-a122-43a1-ba67-1f365d423d9d",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      "expo-video",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.1568931022-4fn2jd2jttsd45r3ogii6j0n2dfmcgc4",
        },
      ],
    ],
  },
};
