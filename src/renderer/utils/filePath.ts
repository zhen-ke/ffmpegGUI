/**
 * 从文件路径中提取所在目录（兼容 `/` 和 `\` 分隔符）。
 *
 * 注：renderer 进程无法直接使用 Node.js path 模块，
 * 此处用字符串操作替代 path.dirname，逻辑与主进程保持一致。
 * 抽出为单一实现，避免各 hook 各自复制一份。
 */
export function getFileDirectory(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
}

export default getFileDirectory;
