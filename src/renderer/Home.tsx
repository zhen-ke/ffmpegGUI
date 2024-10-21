import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
} from 'react';
import { Play, Square } from 'lucide-react';
import FFmpegDownloader from './FFmpegDownloader';
import { useLanguage } from './LanguageContext';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

const commandTemplates = [
  {
    name: {
      en: 'High Quality H.264 Encoding',
      zh: '高质量 H.264 编码',
    },
    command:
      '-c:v libx264 -crf 23 -preset slow -qcomp 0.5 -psy-rd 0.3:0 -aq-mode 2 -aq-strength 0.8 -b:a 256k',
    description: {
      en: 'High quality H.264 encoding.',
      zh: '高质量 H.264 编码。',
    },
  },
  {
    name: {
      en: 'Intel QuickSync H.264 Encoding',
      zh: 'Intel QuickSync 硬件加速 H.264 编码',
    },
    command: '-c:v h264_qsv -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated H.264 encoding using Intel QuickSync.',
      zh: '使用 Intel QuickSync 硬件加速 H.264 编码。',
    },
  },
  {
    name: {
      en: 'AMD AMF H.264 Encoding',
      zh: 'AMD AMF 硬件加速 H.264 编码',
    },
    command: '-c:v h264_amf -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated H.264 encoding using AMD AMF.',
      zh: '使用 AMD AMF 硬件加速 H.264 编码。',
    },
  },
  {
    name: {
      en: 'NVIDIA NVENC H.264 Encoding',
      zh: 'NVIDIA NVENC 硬件加速 H.264 编码',
    },
    command: '-c:v h264_nvenc -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated H.264 encoding using NVIDIA NVENC.',
      zh: '使用 NVIDIA NVENC 硬件加速 H.264 编码。',
    },
  },
  {
    name: {
      en: 'Apple VideoToolbox H.264 Encoding',
      zh: 'Apple VideoToolbox 硬件加速 H.264 编码',
    },
    command: '-c:v h264_videotoolbox -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated H.264 encoding using Apple VideoToolbox.',
      zh: '使用 Apple VideoToolbox 硬件加速 H.264 编码。',
    },
  },
  {
    name: {
      en: 'H.265/HEVC Encoding',
      zh: 'H.265/HEVC 编码',
    },
    command: '-c:v libx265 -crf 28 -b:a 256k',
    description: {
      en: 'High-efficiency H.265/HEVC encoding.',
      zh: '高效率 H.265/HEVC 编码。',
    },
  },
  {
    name: {
      en: 'Intel QuickSync HEVC Encoding',
      zh: 'Intel QuickSync 硬件加速 HEVC 编码',
    },
    command: '-c:v hevc_qsv -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated HEVC encoding using Intel QuickSync.',
      zh: '使用 Intel QuickSync 硬件加速 HEVC 编码。',
    },
  },
  {
    name: {
      en: 'AMD AMF HEVC Encoding',
      zh: 'AMD AMF 硬件加速 HEVC 编码',
    },
    command: '-c:v hevc_amf -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated HEVC encoding using AMD AMF.',
      zh: '使用 AMD AMF 硬件加速 HEVC 编码。',
    },
  },
  {
    name: {
      en: 'NVIDIA NVENC HEVC Encoding',
      zh: 'NVIDIA NVENC 硬件加速 HEVC 编码',
    },
    command: '-c:v hevc_nvenc -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated HEVC encoding using NVIDIA NVENC.',
      zh: '使用 NVIDIA NVENC 硬件加速 HEVC 编码。',
    },
  },
  {
    name: {
      en: 'Apple VideoToolbox HEVC Encoding',
      zh: 'Apple VideoToolbox 硬件加速 HEVC 编码',
    },
    command: '-c:v hevc_videotoolbox -qscale 15 -b:a 256k',
    description: {
      en: 'Hardware-accelerated HEVC encoding using Apple VideoToolbox.',
      zh: '使用 Apple VideoToolbox 硬件加速 HEVC 编码。',
    },
  },
  {
    name: {
      en: 'Convert video (H.264)',
      zh: '转换视频 (H.264)',
    },
    command:
      '-i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
    description: {
      en: 'Convert video to H.264 with good quality and compression.',
      zh: '将视频转换为 H.264 格式，具有良好的质量和压缩率。',
    },
  },
  {
    name: {
      en: 'Convert video (H.265/HEVC)',
      zh: '转换视频 (H.265/HEVC)',
    },
    command:
      '-i input.mp4 -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k output.mp4',
    description: {
      en: 'Convert video to H.265/HEVC for better compression at the same quality.',
      zh: '将视频转换为 H.265/HEVC 格式，以在相同质量下获得更好的压缩率。',
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
      zh: '从视频中提取音频并保存为 MP3 格式，具有良好的质量。',
    },
  },
  {
    name: {
      en: 'Resize video (720p)',
      zh: '调整视频大小 (720p)',
    },
    command:
      '-i input.mp4 -vf "scale=-1:720" -c:v libx264 -crf 23 -c:a copy output_720p.mp4',
    description: {
      en: 'Resize video to 720p while maintaining aspect ratio.',
      zh: '调整视频大小为 720p，同时保持宽高比。',
    },
  },
  {
    name: {
      en: 'Trim video',
      zh: '修剪视频',
    },
    command: '-ss 00:00:10 -i input.mp4 -t 00:00:30 -c copy output_trimmed.mp4',
    description: {
      en: 'Trim video from 10 seconds to 40 seconds (30 seconds duration).',
      zh: '修剪视频从 10 秒到 40 秒（持续时间 30 秒）。',
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
      en: 'Convert video to GIF with optimized palette.',
      zh: '将视频转换为 GIF 格式，具有优化的调色板。',
    },
  },
  {
    name: {
      en: 'High Quality GIF with Palette',
      zh: '高质量 GIF 带调色板',
    },
    command: `-i input.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" output.gif`,
    description: {
      en: 'Create a high quality GIF using palette generation for optimal colors and dithering.',
      zh: '使用调色板生成创建高质量 GIF，使用优化颜色和抖动。',
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
      zh: '通过减少分辨率和比特率压缩视频。',
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
      zh: '快速压缩视频，在速度、文件大小和质量之间取得良好平衡。适合快速处理需求。',
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
      zh: '将视频转换为 WebM 格式（VP9 + Opus）用于网页使用。',
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
      zh: '从视频中创建 5 秒处的缩略图。',
    },
  },
  {
    name: {
      en: 'Copy Video Stream to MP4',
      zh: '复制视频流到 MP4',
    },
    command: '-c:v copy -b:a 256k',
    description: {
      en: 'Copy video stream to MP4 container without re-encoding.',
      zh: '复制视频流到 MP4 容器，不重新编码。',
    },
  },
  {
    name: {
      en: 'Package to MKV Container',
      zh: '打包到 MKV 容器',
    },
    command: '-c copy',
    description: {
      en: 'Package input file to MKV container without re-encoding.',
      zh: '将输入文件打包到 MKV 容器，不重新编码。',
    },
  },
  {
    name: {
      en: 'Convert to MP3',
      zh: '转换为 MP3',
    },
    command: '-vn -b:a 256k',
    description: {
      en: 'Convert input to MP3 audio format.',
      zh: '将输入转换为 MP3 音频格式。',
    },
  },
  {
    name: {
      en: 'Create GIF (15fps 480p)',
      zh: '创建 GIF (15fps 480p)',
    },
    command:
      '-filter_complex "[0:v] scale=480:-1, fps=15, split [a][b];[a] palettegen [p];[b][p] paletteuse"',
    description: {
      en: 'Create a high-quality GIF at 15fps and 480p resolution.',
      zh: '创建一个高质量的 GIF，分辨率为 15fps 和 480p。',
    },
  },
  {
    name: {
      en: 'Blur Region',
      zh: '模糊区域',
    },
    command:
      '-vf "split [main][tmp]; [tmp] crop=width:height:x:y, boxblur=luma_radius=25:luma_power=2:enable=\'between(t,start_second,end_second)\'[tmp]; [main][tmp] overlay=x:y"',
    description: {
      en: 'Apply blur to a specific region of the video.',
      zh: '对视频的特定区域应用模糊效果。',
    },
  },
  {
    name: {
      en: 'Double Video Speed',
      zh: '双倍视频速度',
    },
    command:
      '-filter_complex "[0:v]setpts=1/2*PTS[v];[0:a]atempo=2 [a]" -map "[v]" -map "[a]"',
    description: {
      en: 'Double the speed of both video and audio.',
      zh: '将视频和音频的速度加倍。',
    },
  },
  {
    name: {
      en: 'Double Audio Speed',
      zh: '双倍音频速度',
    },
    command: '-filter_complex "[0:a]atempo=2.0[a]" -map "[a]"',
    description: {
      en: 'Double the speed of audio only.',
      zh: '将音频的速度加倍。',
    },
  },
  {
    name: {
      en: 'Half Speed with Frame Interpolation',
      zh: '视频0.5倍速 + 光流法补帧到60帧',
    },
    command:
      '-filter_complex "[0:v]setpts=2*PTS[v];[0:a]atempo=1/2 [a];[v]minterpolate=\'mi_mode=mci:mc_mode=aobmc:me_mode=bidir:mb_size=16:vsbmc=1:fps=60\'[v]" -map "[v]" -map "[a]" -max_muxing_queue_size 1024',
    description: {
      en: 'Halve the speed of video and audio with frame interpolation.',
      zh: '使用帧插值将视频和音频的速度减半。',
    },
  },
  {
    name: {
      en: 'Frame Interpolation to 60fps',
      zh: '帧插值到 60fps',
    },
    command:
      '-filter_complex "[0:v]scale=-2:-2[v];[v]minterpolate=\'mi_mode=mci:mc_mode=aobmc:me_mode=bidir:mb_size=16:vsbmc=1:fps=60\'" -max_muxing_queue_size 1024',
    description: {
      en: 'Interpolate frames to achieve 60fps.',
      zh: '插值帧以实现 60fps。',
    },
  },
  {
    name: {
      en: 'Reverse Video and Audio',
      zh: '视频倒放',
    },
    command: '-vf reverse -af areverse',
    description: {
      en: 'Reverse both video and audio.',
      zh: '反转视频和音频。',
    },
  },
  {
    name: {
      en: 'Reverse Audio Only',
      zh: '音频倒放',
    },
    command: '-af areverse',
    description: {
      en: 'Reverse audio without affecting video.',
      zh: '反转音频，不影响视频。',
    },
  },
  {
    name: {
      en: 'Set Aspect Ratio',
      zh: '设置宽高比',
    },
    command: '-aspect:0 16:9',
    description: {
      en: 'Set the aspect ratio of the video to 16:9.',
      zh: '将视频的宽高比设置为 16:9。',
    },
  },
  {
    name: {
      en: 'Extract Frames as Images',
      zh: '提取帧为图像',
    },
    command: '-r 1 -q:v 2 -f image2 -target pal-dvcd-r',
    description: {
      en: 'Extract frames from video as image files.',
      zh: '从视频中提取帧作为图像文件。',
    },
  },
  {
    name: {
      en: 'Extract Specific Number of Frames',
      zh: '提取特定数量的帧保存为图片',
    },
    command: '-vframes 5',
    description: {
      en: 'Extract a specific number of frames (5 in this case) from the video.',
      zh: '从视频中提取特定数量的帧（在本例中为 5 帧）。',
    },
  },
  {
    name: {
      en: 'Create Video from Image',
      zh: '从图像创建视频',
    },
    command: '-c:v libx264 -tune stillimage -c:a aac -shortest',
    description: {
      en: 'Create a video from a still image, optimized for still image content.',
      zh: '从静态图像创建视频，优化用于静态图像内容。',
    },
  },
  {
    name: {
      en: 'Crop Video',
      zh: '裁剪视频',
    },
    command: '-strict -2 -vf crop=w:h:x:y',
    description: {
      en: 'Crop the video to specified dimensions and position.',
      zh: '裁剪视频到指定尺寸和位置。',
    },
  },
  {
    name: {
      en: 'Rotate Video Metadata',
      zh: '旋转视频 90 度',
    },
    command: '-c copy -metadata:s:v:0 rotate=90',
    description: {
      en: 'Rotate video by 90 degrees using metadata (no re-encoding).',
      zh: '使用元数据旋转视频 90 度（不重新编码）。',
    },
  },
  {
    name: {
      en: 'Flip Video Horizontally',
      zh: '水平翻转视频',
    },
    command: '-vf "hflip"',
    description: {
      en: 'Flip the video horizontally (mirror effect).',
      zh: '水平翻转视频（镜像效果）。',
    },
  },
  {
    name: {
      en: 'Flip Video Vertically',
      zh: '垂直翻转视频',
    },
    command: '-vf "vflip"',
    description: {
      en: 'Flip the video vertically.',
      zh: '垂直翻转视频。',
    },
  },
  {
    name: {
      en: 'Pad Video to 1920x1080',
      zh: '填充视频到 1920x1080',
    },
    command:
      '-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"',
    description: {
      en: 'Scale and pad video to 1920x1080 while maintaining aspect ratio.',
      zh: '缩放并填充视频到 1920x1080，同时保持宽高比。',
    },
  },
  {
    name: {
      en: 'Add Cover Art to Audio',
      zh: '为视频或音频文件添加艺术封面',
    },
    command: '-map 0 -map 1 -c copy -c:v:1 jpg -disposition:v:1 attached_pic',
    description: {
      en: 'Add cover art to an audio file.',
      zh: '为视频或音频文件添加艺术封面。',
    },
  },
  {
    name: {
      en: 'Normalize Audio Loudness',
      zh: '标准化音频响度',
    },
    command: '-af "loudnorm=i=-24.0:lra=7.0:tp=-2.0:" -c:v copy',
    description: {
      en: 'Normalize audio loudness without re-encoding video.',
      zh: '标准化音频响度，不重新编码视频。',
    },
  },
  {
    name: {
      en: 'Adjust Audio Volume',
      zh: '调整音频音量',
    },
    command: '-af "volume=1.0"',
    description: {
      en: 'Adjust the volume of the audio track.',
      zh: '调整音频音量。',
    },
  },
  {
    name: {
      en: 'Remove Audio',
      zh: '静音第一个声道',
    },
    command: '-map_channel -1 -map_channel 0.0.1',
    description: {
      en: 'Remove the audio track from the video.',
      zh: '静音第一个声道。',
    },
  },
  {
    name: {
      en: 'Keep Only Right Audio Channel',
      zh: '交换左右声道',
    },
    command: '-map_channel 0.0.1 -map_channel 0.0.0',
    description: {
      en: 'Keep only the right audio channel, copying it to both channels.',
      zh: '交换左右声道。',
    },
  },
  {
    name: {
      en: 'Merge Two Audio Tracks',
      zh: '合并两个音频轨道',
    },
    command: '-filter_complex "[0:1] [1:1] amerge" -c:v copy',
    description: {
      en: 'Merge two audio tracks into one.',
      zh: '合并两个音频轨道。',
    },
  },
  {
    name: {
      en: 'Set Specific Bitrates',
      zh: 'H264压制目标比特率6000k',
    },
    command: '-b:a 256k -b:v 6000k',
    description: {
      en: 'Set specific bitrates for audio and video.',
      zh: 'H264压制目标比特率6000k。',
    },
  },
  {
    name: {
      en: 'Two-Pass Encoding',
      zh: 'H264 二压 目标比特率2000k',
    },
    command: '-c:v libx264 -pass 2 -b:v 2000k -preset slow -b:a 256k',
    description: {
      en: 'Perform two-pass encoding for better quality at a specific bitrate.',
      zh: '执行两遍编码，以在特定比特率下获得更好的质量。',
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

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTemplate = commandTemplates.find(
      (template) => template.command === e.target.value,
    );
    if (selectedTemplate) {
      setCommand(selectedTemplate.command);
    }
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
              {language === 'en' ? 'CN' : 'En'}
            </span>
          </label>
          <select
            id="command-template"
            onChange={handleTemplateChange}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">{t('Select a template')}</option>
            {commandTemplates.map((template, index) => (
              <option
                key={index}
                value={template.command}
                title={template.description[language]}
              >
                {template.name[language]}
              </option>
            ))}
          </select>
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
