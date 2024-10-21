import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
} from 'react';
import { Play, Square } from 'lucide-react';
import FFmpegDownloader from './FFmpegDownloader';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

const commandTemplates = [
  {
    name: 'Convert video (H.264)',
    command:
      '-i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
    description: 'Convert video to H.264 with good quality and compression.',
  },
  {
    name: 'Convert video (H.265/HEVC)',
    command:
      '-i input.mp4 -c:v libx265 -preset medium -crf 28 -c:a aac -b:a 128k output.mp4',
    description:
      'Convert video to H.265/HEVC for better compression at the same quality.',
  },
  {
    name: 'Extract audio',
    command: '-i input.mp4 -vn -c:a libmp3lame -b:a 192k output.mp3',
    description: 'Extract audio from video and save as MP3 with good quality.',
  },
  {
    name: 'Resize video (720p)',
    command:
      '-i input.mp4 -vf "scale=-1:720" -c:v libx264 -crf 23 -c:a copy output_720p.mp4',
    description: 'Resize video to 720p while maintaining aspect ratio.',
  },
  {
    name: 'Trim video',
    command: '-ss 00:00:10 -i input.mp4 -t 00:00:30 -c copy output_trimmed.mp4',
    description:
      'Trim video from 10 seconds to 40 seconds (30 seconds duration).',
  },
  {
    name: 'Convert to GIF',
    command:
      '-i input.mp4 -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif output.gif',
    description: 'Convert video to GIF with optimized palette.',
  },
  {
    name: 'High Quality GIF with Palette',
    command: `-i input.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" output.gif`,
    description:
      'Create a high quality GIF using palette generation for optimal colors and dithering.',
  },
  {
    name: 'Add subtitles',
    command:
      '-i input.mp4 -i subtitles.srt -c copy -c:s mov_text output_with_subtitles.mp4',
    description: 'Add subtitles to a video file.',
  },
  {
    name: 'Compress video',
    command:
      '-i input.mp4 -vf "scale=iw*0.5:ih*0.5" -c:v libx264 -crf 28 -preset slower -c:a aac -b:a 96k output_compressed.mp4',
    description: 'Compress video by reducing resolution and bitrate.',
  },
  {
    name: 'Fast Compress Video',
    command:
      '-i input.mp4 -c:v libx264 -tag:v avc1 -movflags faststart -crf 30 -preset superfast -c:a aac -b:a 128k output_fast_compressed.mp4',
    description:
      'Quickly compress video with good balance between speed, file size, and quality. Suitable for fast processing needs.',
  },
  {
    name: 'Convert to WebM',
    command:
      '-i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -c:a libopus output.webm',
    description: 'Convert video to WebM format (VP9 + Opus) for web use.',
  },
  {
    name: 'Create video thumbnail',
    command: '-i input.mp4 -ss 00:00:05 -vframes 1 thumbnail.jpg',
    description: 'Create a thumbnail image from the video at 5 seconds.',
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

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCommand(e.target.value);
  };

  // 检查 FFmpeg 状态
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
            className="block font-semibold text-gray-700 mb-2"
          >
            Command Template
          </label>
          <select
            id="command-template"
            onChange={handleTemplateChange}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Select a template</option>
            {commandTemplates.map((template, index) => (
              <option
                key={index}
                value={template.command}
                title={template.description}
              >
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label
            htmlFor="ffmpeg-command"
            className="block font-semibold text-gray-700 mb-2"
          >
            FFmpeg Command
          </label>
          <textarea
            id="ffmpeg-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            placeholder="Enter FFmpeg command or drag & drop files here"
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
            Start
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
            Stop
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
                Clear
              </button>
              <button
                disabled={!logs?.length}
                onClick={() => {
                  navigator.clipboard.writeText(logs);
                }}
                className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-300"
              >
                Copy
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
