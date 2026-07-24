const fs = require("fs")
const path = require("path")
const { withDangerousMod } = require("@expo/config-plugins")

const insertionMarker = "\n\n    # This is necessary for Xcode 14"
const compatibilityBlock = `

    # fmt 11.0.2 does not compile as C++20 with Apple Clang in Xcode 26.5.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end`

const withFmtXcode26Compatibility = (config) =>
  withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      )
      const podfile = await fs.promises.readFile(podfilePath, "utf8")

      if (podfile.includes("target.name == 'fmt'")) {
        return modConfig
      }

      if (!podfile.includes(insertionMarker)) {
        throw new Error("Unable to add the fmt Xcode compatibility setting")
      }

      await fs.promises.writeFile(
        podfilePath,
        podfile.replace(
          insertionMarker,
          `${compatibilityBlock}${insertionMarker}`,
        ),
      )

      return modConfig
    },
  ])

module.exports = withFmtXcode26Compatibility
