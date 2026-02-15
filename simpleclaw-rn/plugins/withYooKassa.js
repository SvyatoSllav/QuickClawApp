const { withAppBuildGradle, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withYooKassaGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    const buildGradle = mod.modResults.contents;

    // Add YooKassa SDK dependency
    if (!buildGradle.includes('yookassa-android-sdk')) {
      mod.modResults.contents = buildGradle.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation("ru.yoomoney.sdk.kassa.payments:yookassa-android-sdk:6.5.0")`
      );
    }

    return mod;
  });
}

function withYooKassaMainApplication(config) {
  return withMainApplication(config, (mod) => {
    const contents = mod.modResults.contents;

    // Add import
    if (!contents.includes('YooKassaPackage')) {
      mod.modResults.contents = contents
        .replace(
          /(import com\.facebook\.react\.defaults\.DefaultReactNativeHost)/,
          'import com.simpleclaw.app.YooKassaPackage\n$1'
        );
    }

    // Add package to getPackages
    if (!contents.includes('YooKassaPackage()')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /(packages\.add\(MainReactPackage\(\)\))/,
        '$1\n              packages.add(YooKassaPackage())'
      );

      // Alternative pattern for newer Expo templates
      if (!mod.modResults.contents.includes('YooKassaPackage()')) {
        mod.modResults.contents = mod.modResults.contents.replace(
          /(override fun getPackages\(\).*?PackageList.*?\.packages.*?apply\s*\{)/s,
          '$1\n              add(YooKassaPackage())'
        );
      }
    }

    return mod;
  });
}

function withYooKassaNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const srcDir = path.join(projectRoot, 'android-native', 'java', 'com', 'simpleclaw', 'app');
      const destDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'simpleclaw',
        'app'
      );

      // Copy native module files
      const files = ['YooKassaModule.kt', 'YooKassaPackage.kt'];
      for (const file of files) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      }

      return mod;
    },
  ]);
}

module.exports = function withYooKassa(config) {
  config = withYooKassaGradle(config);
  config = withYooKassaMainApplication(config);
  config = withYooKassaNativeFiles(config);
  return config;
};
