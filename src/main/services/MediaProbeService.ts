import { execFile } from 'child_process';
import path from 'path';
import type { MediaProbeResult } from '../../shared/mediaProbe';
import {
  buildProbeEnv,
  canExecute,
  getFfmpegSearchDirs,
  probeExecutableExists,
  resolveFfmpegPath,
} from '../utils/pathUtils';

interface RawProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
  tags?: Record<string, string>;
}

interface RawProbeFormat {
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
}

interface RawProbeResult {
  streams?: RawProbeStream[];
  format?: RawProbeFormat;
}

const FFPROBE_BIN = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFrameRate(value: string | undefined): number | null {
  if (!value || value === '0/0') return null;

  const [numerator, denominator] = value.split('/');
  const num = Number(numerator);
  const den = Number(denominator);

  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return null;
  }

  return num / den;
}

// buildProbeEnv / canExecute / probeExecutableExists 复用自 pathUtils，
// 与 ffmpeg 探测逻辑保持单一实现，避免三处逐字重复。

/** ffprobe 路径探测结果缓存：undefined = 未探测，null = 确认不存在，string = 已确认路径 */
let _cachedFfprobePath: string | null | undefined = undefined;

/**
 * 使 ffprobe 路径缓存失效。在 FFmpeg 下载/更新后调用，确保下次重新探测。
 */
export function invalidateFfprobePathCache(): void {
  _cachedFfprobePath = undefined;
}

async function findFirstAvailableCandidate(
  candidates: string[],
  index = 0,
): Promise<string | null> {
  if (index >= candidates.length) {
    return null;
  }

  const candidate = candidates[index];
  const isAbsolute = path.isAbsolute(candidate);
  const canInspect = !isAbsolute || (await canExecute(candidate));

  if (canInspect && (await probeExecutableExists(candidate))) {
    return candidate;
  }

  return findFirstAvailableCandidate(candidates, index + 1);
}

async function resolveFfprobePath(): Promise<string | null> {
  // 快路径：缓存路径仍可用则直接返回
  if (typeof _cachedFfprobePath === 'string') {
    if (await canExecute(_cachedFfprobePath)) {
      return _cachedFfprobePath;
    }
    _cachedFfprobePath = undefined;
  }

  const ffmpegPath = await resolveFfmpegPath();
  const localCandidate = ffmpegPath
    ? path.join(path.dirname(ffmpegPath), FFPROBE_BIN)
    : null;

  if (
    localCandidate &&
    (await canExecute(localCandidate)) &&
    (await probeExecutableExists(localCandidate))
  ) {
    _cachedFfprobePath = localCandidate;
    return _cachedFfprobePath;
  }

  const candidates = [
    FFPROBE_BIN,
    ...getFfmpegSearchDirs().map((dir) => path.join(dir, FFPROBE_BIN)),
  ];

  _cachedFfprobePath = await findFirstAvailableCandidate([
    ...new Set(candidates),
  ]);
  return _cachedFfprobePath;
}

export async function isMediaProbeAvailable(): Promise<boolean> {
  return (await resolveFfprobePath()) !== null;
}

function mapProbeResult(
  filePath: string,
  result: RawProbeResult,
): MediaProbeResult {
  const streams = result.streams ?? [];

  return {
    path: filePath,
    formatName: result.format?.format_name ?? 'Unknown',
    durationSeconds: toNumber(result.format?.duration),
    sizeBytes: toNumber(result.format?.size),
    bitRate: toNumber(result.format?.bit_rate),
    videoStreams: streams
      .filter((stream) => stream.codec_type === 'video')
      .map((stream) => ({
        codec: stream.codec_name ?? 'Unknown',
        width: typeof stream.width === 'number' ? stream.width : null,
        height: typeof stream.height === 'number' ? stream.height : null,
        frameRate: parseFrameRate(stream.avg_frame_rate),
      })),
    audioStreams: streams
      .filter((stream) => stream.codec_type === 'audio')
      .map((stream) => ({
        codec: stream.codec_name ?? 'Unknown',
        channels: typeof stream.channels === 'number' ? stream.channels : null,
        sampleRate: toNumber(stream.sample_rate),
      })),
    subtitleStreams: streams
      .filter((stream) => stream.codec_type === 'subtitle')
      .map((stream) => ({
        codec: stream.codec_name ?? 'Unknown',
        language: stream.tags?.language ?? null,
      })),
  };
}

export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  const trimmedPath = filePath.trim();
  if (!trimmedPath) {
    throw new Error('Input file path is required.');
  }

  const ffprobePath = await resolveFfprobePath();
  if (!ffprobePath) {
    throw new Error('FFprobe is not available.');
  }

  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        trimmedPath,
      ],
      {
        timeout: 10_000,
        windowsHide: true,
        env: buildProbeEnv(),
      },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              `Failed to probe media file: ${error.message || 'Unknown error'}`,
            ),
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as RawProbeResult;
          resolve(mapProbeResult(trimmedPath, parsed));
        } catch {
          reject(new Error('Failed to parse media probe result.'));
        }
      },
    );
  });
}

export const mediaProbeService = {
  probe: probeMedia,
  isAvailable: isMediaProbeAvailable,
};
