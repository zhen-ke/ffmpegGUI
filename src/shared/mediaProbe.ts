export interface MediaProbeResult {
  path: string;
  formatName: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  bitRate: number | null;
  videoStreams: Array<{
    codec: string;
    width: number | null;
    height: number | null;
    frameRate: number | null;
  }>;
  audioStreams: Array<{
    codec: string;
    channels: number | null;
    sampleRate: number | null;
  }>;
  subtitleStreams: Array<{
    codec: string;
    language: string | null;
  }>;
}
