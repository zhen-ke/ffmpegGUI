import fs from 'fs';
import path from 'path';
import webpackPaths from '../configs/webpack.paths';

const { srcNodeModulesPath } = webpackPaths;
const { appNodeModulesPath } = webpackPaths;

if (!fs.existsSync(appNodeModulesPath)) {
  process.exit(0);
}

const expectedTarget = path.normalize(fs.realpathSync(appNodeModulesPath));

if (fs.existsSync(srcNodeModulesPath)) {
  const srcStat = fs.lstatSync(srcNodeModulesPath);

  if (srcStat.isSymbolicLink()) {
    const currentTarget = path.normalize(fs.realpathSync(srcNodeModulesPath));
    if (currentTarget === expectedTarget) {
      process.exit(0);
    }
    fs.unlinkSync(srcNodeModulesPath);
  } else {
    console.warn(
      `[link-modules] Skip relink: ${srcNodeModulesPath} exists and is not a symlink.`,
    );
    process.exit(0);
  }
}

fs.symlinkSync(appNodeModulesPath, srcNodeModulesPath, 'junction');
