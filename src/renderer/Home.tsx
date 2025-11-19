import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
} from 'react';
import { Play, Square, PlusCircle, Terminal } from 'lucide-react';
import FFmpegDownloader from './components/FFmpegDownloader';
import { useLanguage } from './LanguageContext';
import Dropdown, { DropdownOption } from './components/Dropdown';
import {
  commandTemplates,
  CommandTemplate,
} from './constants/commandTemplates';
import { templateService } from './services/templateService';
import { TemplateDialog } from './components/TemplateDialog';
import { Template } from './types/template';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

interface ElectronHandler {
  ipcRenderer: {
    sendMessage(channel: string, args: any): void;
    on(channel: string, func: (...args: any[]) => void): () => void;
    invoke(channel: string, args?: any): Promise<any>;
  };
}

// 定义更具体的类型
type LogType = 'info' | 'error' | 'success';

interface TransformedTemplate extends Template {
  name: string;
  description: string;
}

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
    useState<TransformedTemplate | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    Template | undefined
  >();
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [inputFile, setInputFile] = useState<string>('');
  const [outputFolder, setOutputFolder] = useState<string>('');

  const updateProgress = useCallback(
    (currentTime: number) => {
      if (totalDuration > 0) {
        const progressPercentage = (currentTime / totalDuration) * 100;
        setProgress(Math.min(100, progressPercentage));
      }
    },
    [totalDuration],
  );

  // 优化后的日志生成函数：添加时间戳、图标和更好的样式结构
  const addLog = useCallback((type: LogType, message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });

    // 定义样式配置
    const config = {
      error: {
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20',
        icon: '✕',
      },
      success: {
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20',
        icon: '✓',
      },
      info: {
        color: 'text-slate-700 dark:text-slate-300',
        bg: 'hover:bg-gray-50 dark:hover:bg-white/5 border-transparent',
        icon: '➜',
      },
    };

    const style = config[type] || config.info;

    // 生成结构化的 HTML
    const logHtml = `
      <div class="group flex items-start gap-3 px-4 text-sm font-mono border-b border-dashed border-gray-200 dark:border-gray-800 last:border-0 transition-colors ${style.bg}">
        <span class="flex-shrink-0 w-5 text-center ${style.color} opacity-70 font-bold select-none">${style.icon}</span>
        <span class="flex-shrink-0 text-xs text-gray-400 select-none pt-0.5 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors">[${time}]</span>
        <span class="flex-1 break-all whitespace-pre-wrap leading-relaxed ${style.color}">${message}</span>
      </div>
    `;

    setLogs((prevLogs) => prevLogs + logHtml);
  }, []);

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

  // 处理输入文件选择
  const handleSelectInputFile = async () => {
    try {
      // 优化：传入当前的 inputFile，这样对话框打开时会直接定位到该文件所在的目录
      const result = await window.electron.ipcRenderer.invoke(
        'select-input-file',
        inputFile,
      );

      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setInputFile(filePath);

        // 智能联动：如果还没选输出目录，自动将输出目录设置为输入文件所在的目录
        if (!outputFolder) {
          // 提取目录路径 (简单处理，因为后端已经保证是正斜杠了)
          const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
          setOutputFolder(fileDir);
          updateCommandWithInputOutput(filePath, fileDir);
        } else {
          updateCommandWithInputOutput(filePath, outputFolder);
        }
      }
    } catch (error) {
      console.error('Failed to select input file:', error);
    }
  };

  // 处理输出文件夹选择
  const handleSelectOutputFolder = async () => {
    try {
      // 优化：传入当前的 outputFolder，方便用户修改
      const result = await window.electron.ipcRenderer.invoke(
        'select-output-folder',
        outputFolder,
      );

      if (result && !result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        setOutputFolder(folderPath);

        if (inputFile) {
          updateCommandWithInputOutput(inputFile, folderPath);
        }
      }
    } catch (error) {
      console.error('Failed to select output folder:', error);
    }
  };

  // 更新命令函数：替换输入和输出路径
  const updateCommandWithInputOutput = (input: string, output: string) => {
    let newCommand = command;

    // 替换输入文件路径
    if (input) {
      // 匹配并替换 -i 后的输入文件
      newCommand = newCommand.replace(
        /-i\s+["']?[^"'\s]+["']?/g,
        `-i "${input}"`,
      );
      // 如果命令中没有 -i 参数，则在开头添加
      if (!newCommand.includes('-i')) {
        newCommand = `-i "${input}" ${newCommand}`;
      }
    }

    // 替换输出文件路径
    if (output) {
      // 获取原命令的最后一个参数作为输出文件名模板
      const parts = newCommand.trim().split(/\s+/);
      let outputFileName = 'output.mp4'; // 默认输出文件名

      // 尝试从原命令中提取输出文件名
      const lastPart = parts[parts.length - 1];
      if (
        lastPart &&
        !lastPart.startsWith('-') &&
        !lastPart.includes('input')
      ) {
        // 提取文件名和扩展名
        const match = lastPart.match(/([^/\\]+\.[a-zA-Z0-9]+)$/);
        if (match) {
          outputFileName = match[1];
        }
      }

      const outputPath = `${output}/${outputFileName}`;

      // 替换最后一个不是参数的部分作为输出文件
      newCommand = newCommand.replace(/\s+[^-\s][^\s]*$/, ` "${outputPath}"`);
    }

    setCommand(newCommand);
  };

  // 修改 transformTemplate 函数
  const transformTemplate = useCallback(
    (template: Template | CommandTemplate): TransformedTemplate => {
      const isCommandTemplate =
        'name' in template &&
        typeof template.name === 'object' &&
        'en' in template.name;

      return {
        ...template,
        id: (template as Template).id || '', // 为内置模板提供空 id
        name: isCommandTemplate
          ? template.name[language]
          : (template as TransformedTemplate).name,
        description: isCommandTemplate
          ? template.description[language]
          : (template as TransformedTemplate).description,
        isCustom: !!(template as Template).isCustom,
      };
    },
    [language],
  );

  // 修改 handleTemplateChange 函数
  const handleTemplateChange = (template: TransformedTemplate) => {
    setSelectedTemplate(template);
    let newCommand = template.command;

    // 如果用户已经选择了输入文件和输出文件夹，则动态替换
    if (inputFile || outputFolder) {
      // 替换输入文件路径
      if (inputFile) {
        // 匹配并替换 -i 后的输入文件
        newCommand = newCommand.replace(
          /-i\s+["']?[^"'\s]+["']?/g,
          `-i "${inputFile}"`,
        );
        // 如果命令中没有 -i 参数，则在开头添加
        if (!newCommand.includes('-i')) {
          newCommand = `-i "${inputFile}" ${newCommand}`;
        }
      }

      // 替换输出文件路径
      if (outputFolder) {
        // 获取原命令的最后一个参数作为输出文件名模板
        const parts = newCommand.trim().split(/\s+/);
        let outputFileName = 'output.mp4'; // 默认输出文件名

        // 尝试从模板命令中提取输出文件名
        const lastPart = parts[parts.length - 1];
        if (
          lastPart &&
          !lastPart.startsWith('-') &&
          !lastPart.includes('input')
        ) {
          // 提取文件名和扩展名
          const match = lastPart.match(/([^/\\]+\.[a-zA-Z0-9]+)$/);
          if (match) {
            outputFileName = match[1];
          }
        }

        const outputPath = `${outputFolder}/${outputFileName}`;
        newCommand = newCommand.replace(/\s+[^-\s][^\s]*$/, ` "${outputPath}"`);
      }
    }

    setCommand(newCommand);
  };

  // 修改编辑处理函数
  const handleEdit = (template: Template) => {
    const originalTemplate = customTemplates.find((t) => t.id === template.id);
    if (originalTemplate) {
      setEditingTemplate(originalTemplate);
      setIsTemplateDialogOpen(true);
    }
  };

  const checkFFmpegStatus = async () => {
    const exists = await window.electron.ipcRenderer.invoke(
      'check-ffmpeg-status',
    );
    setFfmpegExists(exists);
  };

  const handleOpenTerminal = async () => {
    try {
      console.log('Opening terminal...');
      const result = await window.electron.ipcRenderer.invoke('open-terminal');
      console.log('Terminal open result:', result);
    } catch (error) {
      console.error('Failed to open terminal:', error);
    }
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

  useEffect(() => {
    // 加载自定义模板
    setCustomTemplates(templateService.getCustomTemplates());
  }, []);

  const handleSaveTemplate = (template: Omit<Template, 'id' | 'isCustom'>) => {
    if (editingTemplate) {
      // 更新现有模板
      templateService.updateCustomTemplate({
        ...template,
        id: editingTemplate.id,
        isCustom: true,
      });
      // 刷新自定义模板列表
      setCustomTemplates(templateService.getCustomTemplates());
      // 如果当前选中的是被编辑的模板，更新选中的模板
      if (selectedTemplate && selectedTemplate.id === editingTemplate.id) {
        const updatedTemplate = {
          ...template,
          id: editingTemplate.id,
          isCustom: true,
          name: template.name[language],
          description: template.description[language],
        };
        setSelectedTemplate(updatedTemplate);
        setCommand(updatedTemplate.command);
      }
    } else {
      // 添加新模板
      const newTemplate = templateService.saveCustomTemplate(template);
      setCustomTemplates(templateService.getCustomTemplates());
    }
    // 关闭对话框
    setIsTemplateDialogOpen(false);
    setEditingTemplate(undefined);
  };

  const handleDeleteTemplate = (templateId: string) => {
    templateService.deleteCustomTemplate(templateId);
    setCustomTemplates(templateService.getCustomTemplates());
    // 如果删除的是当前选中的模板，清除选中状态
    if (selectedTemplate && selectedTemplate.id === templateId) {
      setSelectedTemplate(null);
      setCommand('');
    }
  };

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
    window.electron.ipcRenderer.sendMessage('stop-ffmpeg', null);
    setIsRunning(false);
  };

  if (!ffmpegExists) {
    return <FFmpegDownloader />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
      {/* ================= 上半部分：控制区 (固定高度，不滚动) ================= */}
      <div className="flex-shrink-0 bg-white dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 shadow-sm z-20">
        <div className="max-w-7xl mx-auto w-full p-4 space-y-4">
          {/* Header Row: Title & Language & Add Template */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FFmpeg Tool
              </h1>
              <button
                onClick={toggleLanguage}
                className="px-2 py-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                {language === 'en' ? '中文' : 'EN'}
              </button>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(undefined);
                setIsTemplateDialogOpen(true);
              }}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              <PlusCircle size={16} className="mr-1.5" />
              {t('Add Template')}
            </button>
          </div>

          {/* Dropdown & File Inputs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 模板选择 (占满宽或占一部分) */}
            <div className="lg:col-span-4">
              <Dropdown
                options={[
                  ...customTemplates.map(transformTemplate),
                  ...commandTemplates.map(transformTemplate),
                ]}
                onChange={handleTemplateChange}
                value={selectedTemplate}
                placeholder={t('Select a template')}
                onEdit={handleEdit}
                onDelete={handleDeleteTemplate}
              />
            </div>

            {/* 输入文件 */}
            <div className="lg:col-span-4">
              <div className="relative flex items-center">
                <button
                  onClick={handleSelectInputFile}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-all duration-200 ${
                    inputFile
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-600 dark:bg-[#0d1117] dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  <span
                    className="truncate flex-1 text-left mr-2"
                    title={inputFile || t('Select Input File')}
                  >
                    {inputFile
                      ? inputFile.split(/[/\\]/).pop()
                      : t('Select Input File')}
                  </span>
                  {inputFile ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setInputFile('');
                      }}
                      className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full cursor-pointer"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                  ) : (
                    <svg
                      className="w-4 h-4 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 输出文件夹 */}
            <div className="lg:col-span-4">
              <div className="relative flex items-center">
                <button
                  onClick={handleSelectOutputFolder}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-all duration-200 ${
                    outputFolder
                      ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-600 dark:bg-[#0d1117] dark:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  <span
                    className="truncate flex-1 text-left mr-2"
                    title={outputFolder || t('Select Output Folder')}
                  >
                    {outputFolder
                      ? outputFolder.split(/[/\\]/).pop()
                      : t('Select Output Folder')}
                  </span>
                  {outputFolder ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setOutputFolder('');
                      }}
                      className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full cursor-pointer"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                  ) : (
                    <svg
                      className="w-4 h-4 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Command Input Area */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-20 transition duration-500 blur"></div>
            <div className="relative bg-white dark:bg-[#0d1117] rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 rounded-t-lg">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Terminal size={14} />
                  <span className="font-mono">FFmpeg Command</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      command && navigator.clipboard.writeText(command)
                    }
                    className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setCommand('')}
                    className="text-xs px-2 py-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleOpenTerminal}
                    className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    Terminal
                  </button>
                </div>
              </div>

              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={t(
                  'Enter FFmpeg command or drag & drop files here',
                )}
                className="w-full p-3 bg-transparent border-none resize-none font-mono text-sm text-gray-800 dark:text-gray-200 focus:ring-0 min-h-[5rem]"
                rows={3}
                spellCheck="false"
              />
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleStart}
              disabled={isRunning || !command}
              className={`min-w-[140px] px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center ${
                isRunning || !command
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              <Play
                size={16}
                className="mr-2"
                fill={isRunning || !command ? 'none' : 'currentColor'}
              />
              {t('Start')}
            </button>

            <button
              onClick={handleStop}
              disabled={!isRunning}
              className={`min-w-[140px] px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center ${
                !isRunning
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20'
              }`}
            >
              <Square
                size={16}
                className="mr-2"
                fill={isRunning ? 'currentColor' : 'none'}
              />
              {t('Stop')}
            </button>
          </div>
        </div>
      </div>

      {/* Template Dialog */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => {
          setIsTemplateDialogOpen(false);
          setEditingTemplate(undefined);
        }}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      {/* ================= 下半部分：Logs & Progress (自适应剩余空间) ================= */}
      {/* 关键修复：使用 min-h-0 允许子元素在 flex 容器内正确滚动 */}
      <div className="flex-1 flex flex-col min-h-0 relative bg-gray-100 dark:bg-black">
        {/* 1. 进度条 (作为 Logs 上方的独立块，不会被 Logs 滚动掩盖) */}
        <div
          className={`flex-shrink-0 transition-all duration-300 ease-in-out border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] ${isRunning && progress > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none absolute w-full'}`}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Processing...</span>
              </div>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Logs 终端窗口 (占据剩余所有空间) */}
        <div className="flex-1 relative flex flex-col max-w-7xl mx-auto w-full">
          {/* 终端 Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-[#161b22] border-b border-gray-300 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="ml-3 text-xs font-mono text-gray-600 dark:text-gray-400">
                Console Output
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  navigator.clipboard.writeText(logs.replace(/<[^>]+>/g, ''))
                }
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
                title="Copy raw text"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setLogs('')}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
                title="Clear console"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 终端内容 (滚动区域) */}
          <div className="flex-1 relative bg-white dark:bg-[#0d1117]">
            {/* absolute inset-0 确保滚动条只在这里出现 */}
            <div
              ref={logsRef}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
            >
              {logs ? (
                <div
                  className="pb-10"
                  dangerouslySetInnerHTML={{ __html: logs }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none select-none">
                  <Terminal
                    size={64}
                    className="text-gray-400 dark:text-gray-600 mb-4"
                  />
                  <p className="text-gray-500 dark:text-gray-500 font-mono text-sm">
                    Ready to process...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
