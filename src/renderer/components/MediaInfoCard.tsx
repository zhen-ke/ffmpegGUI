/**
 * MediaInfoCard — 媒体信息卡片组件
 *
 * 从 Home.tsx 提取，展示 ffprobe 探针结果（格式、时长、大小、码率、流信息）。
 */

import { ChevronDown, Loader2 } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { MediaProbeResult } from '../../shared/mediaProbe';
import { useLanguage } from '../LanguageContext';

// ── 格式化工具 ────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatBitRate(bitRate: number | null): string {
  if (bitRate === null || !Number.isFinite(bitRate) || bitRate <= 0) return '—';
  if (bitRate >= 1_000_000) return `${(bitRate / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bitRate / 1000)} kbps`;
}

// ── 静态 card 样式 ────────────────────────────────────────

const statCardCls =
  'col-span-12 md:col-span-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3';
const streamCardCls =
  'col-span-12 md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3';
const labelCls = 'text-[11px] font-medium text-slate-500 dark:text-slate-400';
const valueCls =
  'mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200';

// ── Props ─────────────────────────────────────────────────

interface MediaInfoCardProps {
  mediaInfo: MediaProbeResult | null;
  isLoading: boolean;
  hasError: boolean;
  primaryInputPath: string;
}

// ── Component ─────────────────────────────────────────────

function MediaInfoCardImpl({
  mediaInfo,
  isLoading,
  hasError,
  primaryInputPath,
}: MediaInfoCardProps) {
  const { t } = useLanguage();

  // ── 折叠态：默认收起，首次探测到媒体信息时自动展开一次 ──
  const [isOpen, setIsOpen] = useState(false);
  const hasArrivedRef = useRef(false);
  useEffect(() => {
    if (mediaInfo && !hasArrivedRef.current) {
      hasArrivedRef.current = true;
      setIsOpen(true);
    }
    if (!mediaInfo) hasArrivedRef.current = false;
  }, [mediaInfo]);
  const toggleOpen = () => setIsOpen((v) => !v);

  const primaryVideoStream = mediaInfo?.videoStreams[0] ?? null;
  const primaryAudioStream = mediaInfo?.audioStreams[0] ?? null;
  const primarySubtitleStream = mediaInfo?.subtitleStreams[0] ?? null;

  // 折叠时的一行摘要
  const collapsedSummary = mediaInfo
    ? [
        mediaInfo.formatName,
        formatDuration(mediaInfo.durationSeconds),
        primaryVideoStream?.width && primaryVideoStream?.height
          ? `${primaryVideoStream.width}×${primaryVideoStream.height}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  // 内容区
  let content = (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {t('No media details yet')}
    </p>
  );

  if (hasError) {
    content = (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t('Failed to read media details.')}
      </p>
    );
  } else if (mediaInfo) {
    content = (
      <div className="grid grid-cols-12 gap-3">
        {/* 顶部四格统计 */}
        <div className={statCardCls}>
          <p className={labelCls}>{t('Format')}</p>
          <p className={valueCls}>{mediaInfo.formatName}</p>
        </div>
        <div className={statCardCls}>
          <p className={labelCls}>{t('Duration')}</p>
          <p className={valueCls}>
            {formatDuration(mediaInfo.durationSeconds)}
          </p>
        </div>
        <div className={statCardCls}>
          <p className={labelCls}>{t('Size')}</p>
          <p className={valueCls}>{formatBytes(mediaInfo.sizeBytes)}</p>
        </div>
        <div className={statCardCls}>
          <p className={labelCls}>{t('Bitrate')}</p>
          <p className={valueCls}>{formatBitRate(mediaInfo.bitRate)}</p>
        </div>

        {/* 视频流 */}
        <div className={streamCardCls}>
          <p className={labelCls}>{t('Video')}</p>
          {primaryVideoStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primaryVideoStream.codec}</p>
              <p>
                {t('Resolution')}:{' '}
                {primaryVideoStream.width && primaryVideoStream.height
                  ? `${primaryVideoStream.width}×${primaryVideoStream.height}`
                  : '—'}
              </p>
              <p>
                {t('Frame Rate')}:{' '}
                {primaryVideoStream.frameRate
                  ? `${primaryVideoStream.frameRate.toFixed(2)} fps`
                  : '—'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>

        {/* 音频流 */}
        <div className={streamCardCls}>
          <p className={labelCls}>{t('Audio')}</p>
          {primaryAudioStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primaryAudioStream.codec}</p>
              <p>
                {t('Channels')}: {primaryAudioStream.channels ?? '—'}
              </p>
              <p>
                {t('Sample Rate')}:{' '}
                {primaryAudioStream.sampleRate
                  ? `${Math.round(primaryAudioStream.sampleRate)} Hz`
                  : '—'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>

        {/* 字幕流 */}
        <div className={streamCardCls}>
          <p className={labelCls}>{t('Subtitles')}</p>
          {primarySubtitleStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primarySubtitleStream.codec}</p>
              <p>
                {t('Tracks')}: {mediaInfo.subtitleStreams.length}
              </p>
              <p>{primarySubtitleStream.language ?? '—'}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/40 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-controls="media-info-content"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown
            size={14}
            className={`flex-shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${
              isOpen ? '' : '-rotate-90'
            }`}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('Media Details')}
            </h2>
            <p
              className="text-xs text-slate-500 dark:text-slate-400 truncate"
              title={
                primaryInputPath ||
                t('Select a first input file to inspect it here.')
              }
            >
              {primaryInputPath ||
                t('Select a first input file to inspect it here.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isOpen && collapsedSummary && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {collapsedSummary}
            </span>
          )}
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              <span className="hidden sm:inline">
                {t('Reading media details...')}
              </span>
            </div>
          )}
        </div>
      </button>
      {isOpen && (
        <div id="media-info-content" className="px-4 pb-4">
          {content}
        </div>
      )}
    </div>
  );
}

export const MediaInfoCard = memo(MediaInfoCardImpl);
