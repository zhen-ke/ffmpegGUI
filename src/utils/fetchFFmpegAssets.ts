import axios from 'axios';

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
      const response = await axios.get(WINDOWS_URL);
      const data = response.data;

      return data.assets.map((asset: any) => ({
        version: data.tag_name,
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browser_download_url,
      }));
    } else if (platform === 'darwin') {
      // For Mac, we don't need to fetch any data
      return [
        {
          version: 'latest', // We don't know the exact version without making a request
          name: 'ffmpeg-mac.zip',
          size: 0, // We don't know the size without making a request
          downloadUrl: MAC_DOWNLOAD_URL,
        },
      ];
    } else {
      throw new Error('Unsupported platform');
    }
  } catch (error) {
    console.error('Error fetching FFmpeg assets:', error);
    throw error;
  }
}
