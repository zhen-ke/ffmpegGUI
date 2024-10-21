import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
} from 'react';
import { Play, Square } from 'lucide-react';
import FFmpegDownloader from './components/FFmpegDownloader';
import { useLanguage } from './LanguageContext';
import Dropdown, { DropdownOption } from './components/Dropdown';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

const commandTemplates = [
  {
    name: {
      en: 'Convert video (H.264)',
      zh: '转换视频（H.264）',
    },
    command:
      '-i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
    description: {
      en: 'Convert video to H.264 with good quality and compression.',
      zh: '将视频转换为 H.264 格式，具有良好的质量和压缩比。',
    },
  },
  {
    name: {
      en: 'Convert video (H.265/HEVC)',
      zh: '转换视频（H.265/HEVC）',
    },
    command:
      '-i input.mp4 -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k output.mp4',
    description: {
      en: 'Convert video to H.265/HEVC for better compression at the same quality.',
      zh: '将视频转换为 H.265/HEVC 格式，在相同质量下获得更好的压缩效果。',
    },
  },
  {
    name: {
      en: 'Extract audio',
      zh: '提取音频',
    },
    command: '-i input.mp4 -vn -c:a libmp3lame -b:a 192k output.mp3',
    description: {
      en: 'Extract audio from video and save as MP3 with good quality.',
      zh: '从视频中提取音频并保存为高质量的 MP3 格式。',
    },
  },
  {
    name: {
      en: 'Resize video (720p)',
      zh: '调整视频尺寸（720p）',
    },
    command:
      '-i input.mp4 -vf "scale=-1:720" -c:v libx264 -crf 23 -c:a copy output_720p.mp4',
    description: {
      en: 'Resize video to 720p while maintaining aspect ratio.',
      zh: '将视频调整为 720p 分辨率，同时保持原有的宽高比。',
    },
  },
  {
    name: {
      en: 'Trim video',
      zh: '剪辑视频',
    },
    command: '-ss 00:00:10 -i input.mp4 -t 00:00:30 -c copy output_trimmed.mp4',
    description: {
      en: 'Trim video from 10 seconds to 40 seconds (30 seconds duration).',
      zh: '剪辑视频，从第 10 秒开始，持续 30 秒（到第 40 秒结束）。',
    },
  },
  {
    name: {
      en: 'Convert to GIF',
      zh: '转换为 GIF',
    },
    command:
      '-i input.mp4 -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif output.gif',
    description: {
      en: 'Convert video to GIF with optimized settings.',
      zh: '将视频转换为 GIF 格式，使用优化的设置。',
    },
  },
  {
    name: {
      en: 'High Quality GIF with Palette',
      zh: '高质量 GIF（使用调色板）',
    },
    command:
      '-i input.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" output.gif',
    description: {
      en: 'Create a high quality GIF using palette generation for optimal colors and dithering.',
      zh: '创建高质量 GIF，使用调色板生成技术以获得最佳颜色和抖动效果。',
    },
  },
  {
    name: {
      en: 'Add subtitles',
      zh: '添加字幕',
    },
    command:
      '-i input.mp4 -i subtitles.srt -c copy -c:s mov_text output_with_subtitles.mp4',
    description: {
      en: 'Add subtitles to a video file.',
      zh: '为视频文件添加字幕。',
    },
  },
  {
    name: {
      en: 'Compress video',
      zh: '压缩视频',
    },
    command:
      '-i input.mp4 -vf "scale=iw*0.5:ih*0.5" -c:v libx264 -crf 28 -preset slower -c:a aac -b:a 96k output_compressed.mp4',
    description: {
      en: 'Compress video by reducing resolution and bitrate.',
      zh: '通过降低分辨率和比特率来压缩视频。',
    },
  },
  {
    name: {
      en: 'Fast Compress Video',
      zh: '快速压缩视频',
    },
    command:
      '-i input.mp4 -c:v libx264 -tag:v avc1 -movflags faststart -crf 30 -preset superfast -c:a aac -b:a 128k output_fast_compressed.mp4',
    description: {
      en: 'Quickly compress video with good balance between speed, file size, and quality. Suitable for fast processing needs.',
      zh: '快速压缩视频，在处理速度、文件大小和质量之间取得良好平衡。适用于需要快速处理的场景。',
    },
  },
  {
    name: {
      en: 'Convert to WebM',
      zh: '转换为 WebM',
    },
    command:
      '-i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -c:a libopus output.webm',
    description: {
      en: 'Convert video to WebM format (VP9 + Opus) for web use.',
      zh: '将视频转换为 WebM 格式（VP9 视频编码 + Opus 音频编码），适用于网页使用。',
    },
  },
  {
    name: {
      en: 'Create video thumbnail',
      zh: '创建视频缩略图',
    },
    command: '-i input.mp4 -ss 00:00:05 -vframes 1 thumbnail.jpg',
    description: {
      en: 'Create a thumbnail image from the video at 5 seconds.',
      zh: '从视频的第 5 秒处创建一个缩略图。',
    },
  },
  {
    name: {
      en: 'High Quality H.264 Encoding',
      zh: '高质量 H.264 编码',
    },
    command:
      '-i input.mp4 -c:v libx264 -crf 23 -preset slow -qcomp 0.5 -psy-rd 0.3:0 -aq-mode 2 -aq-strength 0.8 -b:a 256k output.mp4',
    description: {
      en: 'High quality H.264 encoding with optimized settings.',
      zh: '使用优化设置的高质量 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.264 Encoding with Intel Hardware Acceleration',
      zh: 'H.264 编码（Intel 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v h264_qsv -preset slow -qp 23 -b:a 256k output.mp4',
    description: {
      en: 'H.264 encoding using Intel QuickSync hardware acceleration.',
      zh: '使用 Intel QuickSync 硬件加速的 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.264 Encoding with AMD Hardware Acceleration',
      zh: 'H.264 编码（AMD 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v h264_amf -quality quality -qp_i 23 -qp_p 25 -b:a 256k output.mp4',
    description: {
      en: 'H.264 encoding using AMD hardware acceleration.',
      zh: '使用 AMD 硬件加速的 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.264 Encoding with NVIDIA Hardware Acceleration',
      zh: 'H.264 编码（NVIDIA 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v h264_nvenc -preset slow -cq 23 -b:a 256k output.mp4',
    description: {
      en: 'H.264 encoding using NVIDIA hardware acceleration.',
      zh: '使用 NVIDIA 硬件加速的 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.264 Encoding with Mac Hardware Acceleration',
      zh: 'H.264 编码（Mac 硬件加速）',
    },
    command: '-i input.mp4 -c:v h264_videotoolbox -q:v 65 -b:a 256k output.mp4',
    description: {
      en: 'H.264 encoding using Mac VideoToolbox hardware acceleration.',
      zh: '使用 Mac VideoToolbox 硬件加速的 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.265 Encoding',
      zh: 'H.265 编码',
    },
    command:
      '-i input.mp4 -c:v libx265 -crf 28 -preset medium -b:a 256k output.mp4',
    description: {
      en: 'H.265 (HEVC) encoding for better compression efficiency.',
      zh: 'H.265 (HEVC) 编码，提供更高的压缩效率。',
    },
  },
  {
    name: {
      en: 'H.265 Encoding with Intel Hardware Acceleration',
      zh: 'H.265 编码（Intel 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v hevc_qsv -preset slow -global_quality 23 -b:a 256k output.mp4',
    description: {
      en: 'H.265 encoding using Intel QuickSync hardware acceleration.',
      zh: '使用 Intel QuickSync 硬件加速的 H.265 编码。',
    },
  },
  {
    name: {
      en: 'H.265 Encoding with AMD Hardware Acceleration',
      zh: 'H.265 编码（AMD 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v hevc_amf -quality quality -qp_i 23 -qp_p 25 -b:a 256k output.mp4',
    description: {
      en: 'H.265 encoding using AMD hardware acceleration.',
      zh: '使用 AMD 硬件加速的 H.265 编码。',
    },
  },
  {
    name: {
      en: 'H.265 Encoding with NVIDIA Hardware Acceleration',
      zh: 'H.265 编码（NVIDIA 硬件加速）',
    },
    command:
      '-i input.mp4 -c:v hevc_nvenc -preset slow -cq 23 -b:a 256k output.mp4',
    description: {
      en: 'H.265 encoding using NVIDIA hardware acceleration.',
      zh: '使用 NVIDIA 硬件加速的 H.265 编码。',
    },
  },
  {
    name: {
      en: 'H.265 Encoding with Mac Hardware Acceleration',
      zh: 'H.265 编码（Mac 硬件加速）',
    },
    command: '-i input.mp4 -c:v hevc_videotoolbox -q:v 65 -b:a 256k output.mp4',
    description: {
      en: 'H.265 encoding using Mac VideoToolbox hardware acceleration.',
      zh: '使用 Mac VideoToolbox 硬件加速的 H.265 编码。',
    },
  },
  {
    name: {
      en: 'H.264 Encoding with Target Bitrate 6000k',
      zh: 'H.264 编码（目标比特率 6000k）',
    },
    command:
      '-i input.mp4 -c:v libx264 -b:v 6000k -maxrate 6600k -bufsize 8000k -b:a 256k output.mp4',
    description: {
      en: 'H.264 encoding with a target video bitrate of 6000k.',
      zh: 'H.264 编码，视频目标比特率为 6000k。',
    },
  },
  {
    name: {
      en: 'H.264 Two-Pass Encoding with Target Bitrate 2000k',
      zh: 'H.264 二次编码（目标比特率 2000k）',
    },
    command:
      '-i input.mp4 -c:v libx264 -b:v 2000k -maxrate 2200k -bufsize 3000k -pass 2 -preset slow -b:a 256k output.mp4',
    description: {
      en: 'H.264 two-pass encoding with a target video bitrate of 2000k.',
      zh: 'H.264 二次编码，视频目标比特率为 2000k。',
    },
  },
  {
    name: {
      en: 'Copy Video Stream to MP4 Container',
      zh: '复制视频流到 MP4 容器',
    },
    command: '-i input.mp4 -c:v copy -c:a aac -b:a 256k output.mp4',
    description: {
      en: 'Copy the video stream without re-encoding and package it into an MP4 container.',
      zh: '不重新编码，直接复制视频流并打包到 MP4 容器中。',
    },
  },
  {
    name: {
      en: 'Package Input File to MKV Container',
      zh: '将输入文件打包到 MKV 容器',
    },
    command: '-i input.mp4 -c copy output.mkv',
    description: {
      en: 'Copy all streams without re-encoding and package them into an MKV container.',
      zh: '不重新编码，直接复制所有流并打包到 MKV 容器中。',
    },
  },
  {
    name: {
      en: 'Double Video Speed',
      zh: '视频两倍速',
    },
    command:
      '-i input.mp4 -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2[a]" -map "[v]" -map "[a]" output.mp4',
    description: {
      en: 'Double the speed of both video and audio.',
      zh: '将视频和音频的速度加快一倍。',
    },
  },
  {
    name: {
      en: 'Double Audio Speed',
      zh: '音频两倍速',
    },
    command: '-i input.mp3 -filter:a "atempo=2.0" output.mp3',
    description: {
      en: 'Double the speed of audio without affecting video.',
      zh: '将音频速度加快一倍，不影响视频。',
    },
  },
  {
    name: {
      en: 'Half Video Speed with 60fps Interpolation',
      zh: '视频半速 + 60帧插值',
    },
    command:
      '-i input.mp4 -filter_complex "[0:v]setpts=2*PTS,minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60\'[v];[0:a]atempo=0.5[a]" -map "[v]" -map "[a]" output.mp4',
    description: {
      en: 'Slow down video to half speed and interpolate to 60fps using motion estimation.',
      zh: '将视频速度减半，并使用运动估计插值到 60fps。',
    },
  },
  {
    name: {
      en: '60fps Interpolation',
      zh: '60帧插值',
    },
    command:
      '-i input.mp4 -filter_complex "[0:v]minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60\'" output.mp4',
    description: {
      en: 'Interpolate video to 60fps using motion estimation.',
      zh: '使用运动估计将视频插值到 60fps。',
    },
  },
  {
    name: {
      en: 'Reverse Video',
      zh: '视频倒放',
    },
    command: '-i input.mp4 -vf reverse -af areverse output_reversed.mp4',
    description: {
      en: 'Reverse both video and audio.',
      zh: '将视频和音频都倒放。',
    },
  },
  {
    name: {
      en: 'Reverse Audio',
      zh: '音频倒放',
    },
    command: '-i input.mp3 -af areverse output_reversed.mp3',
    description: {
      en: 'Reverse audio without affecting video.',
      zh: '将音频倒放，不影响视频。',
    },
  },
  {
    name: {
      en: 'Set Aspect Ratio',
      zh: '设置画面比例',
    },
    command: '-i input.mp4 -aspect 16:9 output.mp4',
    description: {
      en: 'Set the aspect ratio of the video (e.g., to 16:9).',
      zh: '设置视频的宽高比（例如：16:9）。',
    },
  },
  {
    name: {
      en: 'Video Stream Timestamp Offset',
      zh: '视频流时间戳偏移',
    },
    command: '-itsoffset 1 -i input.mp4 -c copy -map 0:v -map 1:a output.mp4',
    description: {
      en: 'Offset video stream timestamp to synchronize audio and video.',
      zh: '偏移视频流时间戳以同步音频和视频。',
    },
  },
  {
    name: {
      en: 'Extract Frames from Video',
      zh: '从视频提取帧',
    },
    command: '-i input.mp4 -vf fps=1 -q:v 2 output_%03d.jpg',
    description: {
      en: 'Extract frames from video at 1 frame per second.',
      zh: '每秒从视频中提取一帧。',
    },
  },
  {
    name: {
      en: 'Capture Specific Number of Frames',
      zh: '捕获指定数量的帧',
    },
    command: '-i input.mp4 -vframes 5 output_%03d.jpg',
    description: {
      en: 'Capture a specific number of frames from the video.',
      zh: '从视频中捕获指定数量的帧。',
    },
  },
  {
    name: {
      en: 'Create Video from Still Image',
      zh: '静态图像制作视频',
    },
    command:
      '-loop 1 -i image.jpg -i audio.mp3 -c:v libx264 -tune stillimage -c:a aac -shortest output.mp4',
    description: {
      en: 'Create a video from a still image and audio.',
      zh: '使用静态图像和音频创建视频。',
    },
  },
  {
    name: {
      en: 'Crop Video',
      zh: '裁剪视频',
    },
    command: '-i input.mp4 -filter:v "crop=w:h:x:y" output_cropped.mp4',
    description: {
      en: 'Crop the video frame to specified dimensions. Replace w, h, x, y with actual values.',
      zh: '将视频帧裁剪到指定尺寸。使用时请替换 w, h, x, y 为实际值。',
    },
  },
  {
    name: {
      en: 'Rotate Video',
      zh: '旋转视频',
    },
    command: '-i input.mp4 -vf "transpose=1" output_rotated.mp4',
    description: {
      en: 'Rotate the video 90 degrees clockwise.',
      zh: '将视频顺时针旋转90度。',
    },
  },
  {
    name: {
      en: 'Horizontal Flip',
      zh: '水平翻转',
    },
    command: '-i input.mp4 -vf "hflip" output_hflipped.mp4',
    description: {
      en: 'Flip the video horizontally.',
      zh: '水平翻转视频画面。',
    },
  },
  {
    name: {
      en: 'Vertical Flip',
      zh: '垂直翻转',
    },
    command: '-i input.mp4 -vf "vflip" output_vflipped.mp4',
    description: {
      en: 'Flip the video vertically.',
      zh: '垂直翻转视频画面。',
    },
  },
  {
    name: {
      en: 'Scale and Pad to Specific Resolution',
      zh: '缩放并填充到指定分辨率',
    },
    command:
      '-i input.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" output_scaled_padded.mp4',
    description: {
      en: 'Scale the video to 1920x1080 and add black padding if necessary.',
      zh: '将视频缩放到1920x1080，必要时添加黑色填充。',
    },
  },
  {
    name: {
      en: 'Add Cover Image to Video or Audio',
      zh: '为视频或音频添加封面图片',
    },
    command:
      '-i input.mp4 -i cover.jpg -map 0 -map 1 -c copy -c:v:1 png -disposition:v:1 attached_pic output_with_cover.mp4',
    description: {
      en: 'Add a cover image to a video or audio file.',
      zh: '为视频或音频文件添加封面图片。',
    },
  },
  {
    name: {
      en: 'Normalize Audio Loudness',
      zh: '音频响度标准化',
    },
    command:
      '-i input.mp4 -filter:a loudnorm=I=-23:LRA=7:TP=-2 -c:v copy output_normalized.mp4',
    description: {
      en: 'Normalize audio loudness to broadcast standards.',
      zh: '将音频响度标准化到广播标准。',
    },
  },
  {
    name: {
      en: 'Adjust Audio Volume',
      zh: '调整音量',
    },
    command:
      '-i input.mp4 -filter:a "volume=1.5" -c:v copy output_volume_adjusted.mp4',
    description: {
      en: 'Adjust the volume of the audio. 1.5 means increasing volume by 50%.',
      zh: '调整音频的音量。1.5表示增加50%的音量。',
    },
  },
  {
    name: {
      en: 'Mute Specific Audio Channel',
      zh: '静音特定音频通道',
    },
    command:
      '-i input.mp4 -af "pan=stereo|c0=c0|c1=0*c1" -c:v copy output_right_channel_muted.mp4',
    description: {
      en: 'Mute the right channel (c1) while keeping the left channel (c0).',
      zh: '静音右声道（c1），保留左声道（c0）。',
    },
  },
  {
    name: {
      en: 'Remove Audio',
      zh: '移除音频',
    },
    command: '-i input.mp4 -c:v copy -an output_no_audio.mp4',
    description: {
      en: 'Remove all audio streams from the video.',
      zh: '移除视频中的所有音频流。',
    },
  },
  {
    name: {
      en: 'Swap Left and Right Audio Channels',
      zh: '交换左右音频通道',
    },
    command:
      '-i input.mp4 -af "pan=stereo|c0=c1|c1=c0" -c:v copy output_swapped_channels.mp4',
    description: {
      en: 'Swap the left and right audio channels.',
      zh: '交换左右音频通道。',
    },
  },
  {
    name: {
      en: 'Merge Two Audio Streams',
      zh: '合并两个音频流',
    },
    command:
      '-i input1.mp3 -i input2.mp3 -filter_complex "[0:a][1:a]amerge=inputs=2[a]" -map "[a]" output_merged.mp3',
    description: {
      en: 'Merge two audio streams into a single file.',
      zh: '将两个音频流合并到一个文件中。',
    },
  },
];

function App() {
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState('');
  const [progress, setProgress] = useState(0);
  const logsRef = useRef<HTMLDivElement>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [ffmpegExists, setFfmpegExists] = useState<boolean | null>(null);
  const { language, setLanguage, t } = useLanguage();
  const [selectedTemplate, setSelectedTemplate] =
    useState<DropdownOption | null>(null);

  const updateProgress = useCallback(
    (currentTime: number) => {
      if (totalDuration > 0) {
        const progressPercentage = (currentTime / totalDuration) * 100;
        setProgress(Math.min(100, progressPercentage));
      }
    },
    [totalDuration],
  );

  const addLog = useCallback(
    (type: 'info' | 'error' | 'success', message: string) => {
      setLogs(
        (prevLogs) =>
          prevLogs +
          message
            .split('\n')
            .map(
              (line) =>
                `<div class="log-entry log-${type} mb-1"><span class="log-icon">${type === 'info' ? '➡️' : type === 'error' ? '😧' : '😺'}</span>${line}</div>`,
            )
            .join(''),
      );
    },
    [],
  );

  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const filePaths = files.map((file) => `"${file.path}"`).join(' ');

    // 将文件路径插入到当前光标位置或追加到命令末尾
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentCommand = command;
    const newCommand =
      currentCommand.substring(0, start) +
      filePaths +
      currentCommand.substring(end);

    setCommand(newCommand);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleTemplateChange = (template: DropdownOption) => {
    setSelectedTemplate(template);
    setCommand(template.command);
  };

  const checkFFmpegStatus = async () => {
    const exists = await window.electron.ipcRenderer.invoke(
      'check-ffmpeg-status',
    );
    setFfmpegExists(exists);
  };

  useEffect(() => {
    checkFFmpegStatus();

    const removeFFmpegIsExistsListener = window.electron.ipcRenderer.on(
      'ffmpeg-status',
      (exists: boolean) => {
        setFfmpegExists(exists);
      },
    );

    const removeFFmpegDurationListener = window.electron.ipcRenderer.on(
      'ffmpeg-duration',
      (data: { duration: number }) => {
        setTotalDuration(data.duration);
      },
    );

    const removeFFmpegProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-progress',
      (data: { time: number }) => {
        updateProgress(data.time);
      },
    );

    const removeFFmpegOutputListener = window.electron.ipcRenderer.on(
      'ffmpeg-output',
      (data: string) => {
        addLog('info', data);
      },
    );

    const removeFFmpegErrorListener = window.electron.ipcRenderer.on(
      'ffmpeg-error',
      (error: string) => {
        addLog('error', `Error: ${error}`);
        setIsRunning(false);
      },
    );

    const removeFFmpegCompleteListener = window.electron.ipcRenderer.on(
      'ffmpeg-complete',
      () => {
        setProgress(100);
        setIsRunning(false);
        addLog('success', 'FFmpeg process completed successfully.');
      },
    );

    return () => {
      removeFFmpegIsExistsListener();
      removeFFmpegDurationListener();
      removeFFmpegProgressListener();
      removeFFmpegOutputListener();
      removeFFmpegErrorListener();
      removeFFmpegCompleteListener();
    };
  }, [updateProgress, addLog]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleStart = () => {
    setIsRunning(true);
    setLogs('');
    setProgress(0);
    setTotalDuration(0);
    window.electron.ipcRenderer.sendMessage('start-ffmpeg', command);
  };

  const handleStop = () => {
    window.electron.ipcRenderer.sendMessage('stop-ffmpeg');
    setIsRunning(false);
  };

  if (!ffmpegExists) {
    return <FFmpegDownloader />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden pt-[35px]">
      <div className="flex-shrink-0 bg-white shadow-md p-4">
        <div className="mb-4">
          <label
            htmlFor="command-template"
            className="flex items-center justify-between block font-semibold text-gray-700 mb-2"
          >
            {t('Command Template')}
            <span
              onClick={toggleLanguage}
              className="text-xs text-gray-500 ml-2 cursor-pointer"
            >
              {language === 'en' ? 'CN' : 'EN'}
            </span>
          </label>
          <Dropdown
            options={commandTemplates.map((template) => ({
              ...template,
              name: template.name[language],
              description: template.description[language],
            }))}
            onChange={handleTemplateChange}
            value={selectedTemplate}
            placeholder={t('Select a template')}
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="ffmpeg-command"
            className="block font-semibold text-gray-700 mb-2"
          >
            {t('FFmpeg Command')}
          </label>
          <textarea
            id="ffmpeg-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            placeholder={t('Enter FFmpeg command or drag & drop files here')}
            className="w-full p-2 border border-gray-300 rounded resize-none font-mono text-sm"
            rows={3}
            spellCheck="false"
            style={{ minHeight: '4.5rem' }}
          />
        </div>
        <div className="flex justify-between">
          <button
            onClick={handleStart}
            disabled={isRunning || !command}
            className={`flex items-center px-4 py-2 rounded ${
              isRunning || !command
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <Play size={18} className="mr-2" />
            {t('Start')}
          </button>
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className={`flex items-center px-4 py-2 rounded ${
              !isRunning
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <Square size={18} className="mr-2" />
            {t('Stop')}
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col overflow-hidden">
        {isRunning && progress > 0 && (
          <div className="flex-shrink-0 bg-white p-4">
            <div className="mb-2 font-semibold text-gray-700">Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-right text-sm text-gray-600">
              {progress.toFixed(2)}%
            </div>
          </div>
        )}

        <div className="flex-grow overflow-hidden bg-white p-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg text-blue-400">Logs</h2>
            <div className="flex space-x-2">
              <button
                disabled={!logs?.length}
                onClick={() => setLogs('')}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-300"
              >
                {t('Clear')}
              </button>
              <button
                disabled={!logs?.length}
                onClick={() => {
                  navigator.clipboard.writeText(logs);
                }}
                className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-300"
              >
                {t('Copy')}
              </button>
            </div>
          </div>
          <div
            ref={logsRef}
            className="h-full overflow-y-auto font-mono text-sm bg-gray-100 p-4 rounded whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: logs }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
