const { spawnSync } = require('child_process');

// npm 12 currently forwards a user-level allow-scripts setting into lifecycle
// children as an environment setting. A nested project-scoped `npm rebuild`
// then rejects it with EALLOWSCRIPTS before Sharp can run. Let the child npm
// read the reviewed package.json policy instead.
const env = {
  ...process.env,
  SHARP_IGNORE_GLOBAL_LIBVIPS: '1',
};

for (const key of Object.keys(env)) {
  if (key.toLowerCase() === 'npm_config_allow_scripts') {
    delete env[key];
  }
}

const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = npmExecPath
  ? [npmExecPath, 'rebuild', 'sharp']
  : ['rebuild', 'sharp'];

const result = spawnSync(command, args, {
  cwd: require('path').resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
