const path = require("path")
const { getSentryExpoConfig } = require("@sentry/react-native/metro")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getSentryExpoConfig(projectRoot, {
  includeWebReplay: false,
})

config.watchFolders = [workspaceRoot]
config.resolver.unstable_enableSymlinks = true

module.exports = config
