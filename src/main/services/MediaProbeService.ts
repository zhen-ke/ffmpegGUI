import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { MediaProbeResult } from '../../shared/mediaProbe';
import { getFfmpegSearchDirs, resolveFfmpegPath } from '../utils/pathUtils';

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

function buildProbeEnv() {
  return {
    ...process.env,
    PATH: [...getFfmpegSearchDirs(), process.env.PATH ?? '']
      .filter(Boolean)
      .join(path.delimiter),
  };
}

function canExecute(filePath: string): Promise<boolean> {
  return fs.promises
    .access(
      filePath,
      process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK,
    )
    .then(() => true)
    .catch(() => false);
}

function probeExecutableExists(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = execFile(executable, ['-version'], {
      timeout: 5_000,
      windowsHide: true,
      env: buildProbeEnv(),
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
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
  const ffmpegPath = await resolveFfmpegPath();
  const localCandidate = ffmpegPath
    ? path.join(path.dirname(ffmpegPath), FFPROBE_BIN)
    : null;

  if (
    localCandidate &&
    (await canExecute(localCandidate)) &&
    (await probeExecutableExists(localCandidate))
  ) {
    return localCandidate;
  }

  const candidates = [
    FFPROBE_BIN,
    ...getFfmpegSearchDirs().map((dir) => path.join(dir, FFPROBE_BIN)),
  ];

  return findFirstAvailableCandidate([...new Set(candidates)]);
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
