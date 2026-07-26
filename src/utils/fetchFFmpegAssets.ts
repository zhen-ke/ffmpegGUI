import { ipcInvoke } from '../renderer/ipc/ipcTyped';

export interface FFmpegAsset {
  version: string;
  name: string;
  size: number;
  downloadUrl: string;
}

const WINDOWS_URL =
  'https://api.github.com/repos/GyanD/codexffmpeg/releases/latest';
const MAC_DOWNLOAD_URL = 'https://evermeet.cx/ffmpeg/getrelease/zip';

export async function fetchFFmpegAssets(
  platform: string,
): Promise<FFmpegAsset[]> {
  try {
    if (platform === 'win32') {
      // 用原生 fetch 取代 axios：GitHub API 返回 Access-Control-Allow-Origin: *，
      // 且 CSP 未限制 connect-src，可直连。少一个运行时依赖。
      const response = await fetch(WINDOWS_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: failed to fetch FFmpeg assets`);
      }
      const data = (await response.json()) as {
        tag_name: string;
        assets: { name: string; size: number; browser_download_url: string }[];
      };
      return data.assets.map((asset) => ({
        version: data.tag_name,
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browser_download_url,
      }));
    }
    if (platform === 'darwin') {
      // 通过主进程获取 HTML 内容
      const html = await ipcInvoke('fetch-osx-experts-html');

      const isArm64 = window.electron.arch === 'arm64'; // 使用从 preload 获取的架构信息

      if (isArm64) {
        const linkMatch = html.match(
          /href="(https:\/\/www\.osxexperts\.net\/ffmpeg.*?arm\.zip)"/,
        );
        if (!linkMatch) {
          throw new Error('Could not find FFmpeg ARM download link');
        }

        const versionMatch = html.match(
          /ffmpeg\s*(\d+\.\d+)\s*\(Apple Silicon\)/i,
        );
        const version = versionMatch ? versionMatch[1] : 'latest';

        return [
          {
            version: `${version} (OSXExperts)`,
            name: `ffmpeg-mac-arm-${version}.zip`,
            size: 0,
            downloadUrl: linkMatch[1],
          },
        ];
      }
      const osxExpertsLinkMatch = html.match(
        /href="(https:\/\/www\.osxexperts\.net\/ffmpeg\d+intel\.zip)"/,
      );

      const assets = [
        {
          version: 'latest (Evermeet)',
          name: 'ffmpeg-mac-intel.zip',
          size: 0,
          downloadUrl: MAC_DOWNLOAD_URL,
        },
      ];

      if (osxExpertsLinkMatch) {
        const versionMatch = html.match(/ffmpeg\s*(\d+\.\d+)\s*\(Intel\)/i);
        const version = versionMatch ? versionMatch[1] : 'latest';

        assets.push({
          version: `${version} (OSXExperts)`,
          name: `ffmpeg-mac-intel-${version}.zip`,
          size: 0,
          downloadUrl: osxExpertsLinkMatch[1],
        });
      }

      return assets;
    }
    throw new Error('Unsupported platform');
  } catch (error) {
    console.error('Error fetching FFmpeg assets:', error);
    throw error;
  }
}
