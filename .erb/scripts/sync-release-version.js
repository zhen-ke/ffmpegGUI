const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, content) {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

const rootPackagePath = path.resolve(__dirname, '../../package.json');
const releasePackagePath = path.resolve(__dirname, '../../release/app/package.json');
const releaseLockPath = path.resolve(
  __dirname,
  '../../release/app/package-lock.json',
);

const rootPackage = readJson(rootPackagePath);
const releasePackage = readJson(releasePackagePath);

const targetVersion = rootPackage.version;
let touched = false;

if (releasePackage.version !== targetVersion) {
  releasePackage.version = targetVersion;
  writeJson(releasePackagePath, releasePackage);
  touched = true;
}

if (fs.existsSync(releaseLockPath)) {
  const releaseLock = readJson(releaseLockPath);
  let lockTouched = false;

  if (releaseLock.version !== targetVersion) {
    releaseLock.version = targetVersion;
    lockTouched = true;
  }

  if (releaseLock.packages && releaseLock.packages['']) {
    if (releaseLock.packages[''].version !== targetVersion) {
      releaseLock.packages[''].version = targetVersion;
      lockTouched = true;
    }
  }

  if (lockTouched) {
    writeJson(releaseLockPath, releaseLock);
    touched = true;
  }
}

if (touched) {
  console.log(
    `[sync-release-version] Synced release/app version to ${targetVersion}`,
  );
} else {
  console.log('[sync-release-version] release/app version is already synced');
}
