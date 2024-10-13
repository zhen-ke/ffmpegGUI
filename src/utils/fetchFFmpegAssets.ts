import axios from 'axios';

export interface FFmpegAsset {
  version: string;
  name: string;
  size: number;
  downloadUrl: string;
}

export async function fetchFFmpegAssets(): Promise<FFmpegAsset[]> {
  try {
    const response = await axios.get(
      'https://api.github.com/repos/GyanD/codexffmpeg/releases/latest',
    );
    const data = response.data;

    const assets: FFmpegAsset[] = data.assets.map((asset: any) => ({
      version: data.tag_name,
      name: asset.name,
      size: asset.size,
      downloadUrl: asset.browser_download_url,
    }));

    return assets;
  } catch (error) {
    console.error('Error fetching FFmpeg assets:', error);
    throw error;
  }
}
