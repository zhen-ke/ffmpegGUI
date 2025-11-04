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

  const addLog = useCallback((type: LogType, message: string) => {
    setLogs(
      (prevLogs) =>
        prevLogs +
        message
          .split('\n')
          .map(
            (line) =>
              `<div class="log-entry log-${type} mb-1"><span class="log-icon">${
                type === 'info' ? '➜' : type === 'error' ? '😡' : '😉'
              }</span>${line}</div>`,
          )
          .join(''),
    );
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
      const result = await window.electron.ipcRenderer.invoke('select-input-file');
      if (result && !result.canceled) {
        const filePath = result.filePaths[0];
        setInputFile(filePath);
        // 如果输出文件夹已选择，则自动更新命令
        if (outputFolder) {
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
      const result = await window.electron.ipcRenderer.invoke('select-output-folder');
      if (result && !result.canceled) {
        const folderPath = result.filePaths[0];
        setOutputFolder(folderPath);
        // 如果输入文件已选择，则自动更新命令
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
      newCommand = newCommand.replace(/-i\s+["']?[^"'\s]+["']?/g, `-i "${input}"`);
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
      if (lastPart && !lastPart.startsWith('-') && !lastPart.includes('input')) {
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
        newCommand = newCommand.replace(/-i\s+["']?[^"'\s]+["']?/g, `-i "${inputFile}"`);
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
        if (lastPart && !lastPart.startsWith('-') && !lastPart.includes('input')) {
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
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden pt-[35px] dark:bg-background-header ">
      <div className="flex-shrink-0 bg-white shadow-md p-4 dark:bg-background-dark">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <label className="font-semibold text-gray-700 mr-2 dark:text-text-dark">
                {t('Command Template')}
              </label>
              <button
                onClick={toggleLanguage}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors duration-200 dark:bg-background-textarea dark:text-text-lightDark dark:hover:bg-background-textarea focus:outline-none focus:shadow-outline"
              >
                {language === 'en' ? '中文' : 'EN'}
              </button>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(undefined);
                setIsTemplateDialogOpen(true);
              }}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors duration-200 dark:text-text-dark"
            >
              <PlusCircle size={16} className="mr-1" />
              {t('Add Template')}
            </button>
          </div>
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

        {/* 输入文件和输出文件夹选择 - 卡片式设计 */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 输入文件选择卡片 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border-2 border-dashed border-blue-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                    {t('Select Input File')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose your media file</p>
                </div>
              </div>
              {inputFile && (
                <button
                  onClick={() => setInputFile('')}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  title="Clear"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSelectInputFile}
              className="w-full flex items-center justify-center px-4 py-2.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {inputFile ? 'Change File' : t('Select Input File')}
            </button>
            {inputFile && (
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selected:</p>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate" title={inputFile}>
                  {inputFile.split('/').pop()}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1" title={inputFile}>
                  {inputFile.substring(0, inputFile.lastIndexOf('/'))}
                </p>
              </div>
            )}
          </div>

          {/* 输出文件夹选择卡片 */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border-2 border-dashed border-orange-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 transition-colors duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                    {t('Select Output Folder')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose destination folder</p>
                </div>
              </div>
              {outputFolder && (
                <button
                  onClick={() => setOutputFolder('')}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  title="Clear"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSelectOutputFolder}
              className="w-full flex items-center justify-center px-4 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors duration-200 shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {outputFolder ? 'Change Folder' : t('Select Output Folder')}
            </button>
            {outputFolder && (
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selected:</p>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate" title={outputFolder}>
                  {outputFolder.split('/').pop()}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1" title={outputFolder}>
                  {outputFolder}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FFmpeg 命令输入区域 - 现代化设计 */}
        <div className="mb-4">
          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shadow-md">
                <Terminal size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                  {t('FFmpeg Command')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enter your command or drag & drop files here
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 复制按钮 */}
              <button
                onClick={() => {
                  if (command) navigator.clipboard.writeText(command);
                }}
                disabled={!command}
                className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                  command
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    : 'bg-gray-50 cursor-not-allowed text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                }`}
                title="Copy command"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
              {/* 清空按钮 */}
              <button
                onClick={() => setCommand('')}
                disabled={!command}
                className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                  command
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                    : 'bg-gray-50 cursor-not-allowed text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                }`}
                title="Clear command"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
              {/* 终端按钮 */}
              <button
                onClick={handleOpenTerminal}
                className="flex items-center px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-md transition-all duration-200 shadow-sm"
                title={t('Open Terminal at FFmpeg location')}
              >
                <Terminal size={16} className="mr-1.5" />
                {t('Terminal')}
              </button>
            </div>
          </div>

          {/* 命令输入框 */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg blur-sm transition-opacity duration-300 group-hover:opacity-100 opacity-50"></div>
            <div className="relative">
              <textarea
                id="ffmpeg-command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={t('Enter FFmpeg command or drag & drop files here')}
                className="relative w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg resize-none font-mono text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-gray-800 dark:text-gray-200 transition-all duration-200 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 hover:border-gray-300 dark:hover:border-gray-600"
                rows={4}
                spellCheck="false"
                autoComplete="off"
                style={{ minHeight: '6rem' }}
              />
              {/* 拖拽提示 */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-center px-2 py-1 bg-blue-500 text-white text-xs rounded-md">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Drop files here
                </div>
              </div>
            </div>
          </div>

          {/* 命令统计信息 */}
          {command && (
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {command.split(' ').length} words
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {command.length} characters
              </div>
              {command.includes('-i') && (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Has input file
                </div>
              )}
            </div>
          )}
        </div>

        {/* 控制按钮区域 - 现代化设计 */}
        <div className="mt-6">
          {/* 状态指示器 */}
          {isRunning && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    FFmpeg is running...
                  </span>
                </div>
                {progress > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {progress.toFixed(1)}%
                  </div>
                )}
              </div>
              {progress > 0 && (
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="h-full w-full bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 主要控制按钮 */}
          <div className="flex items-center justify-center gap-4">
            {/* 开始按钮 */}
            <button
              onClick={handleStart}
              disabled={isRunning || !command}
              className={`group relative flex items-center justify-center px-8 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 transform ${
                isRunning || !command
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700 scale-95'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 hover:shadow-xl active:scale-95'
              }`}
            >
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Play
                size={20}
                className={`mr-3 transition-transform duration-300 ${
                  !isRunning && command ? 'group-hover:scale-110' : ''
                }`}
              />
              <span className="text-base">{t('Start')}</span>
              {!command && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>

            {/* 分隔线 */}
            <div className="h-12 w-px bg-gray-300 dark:bg-gray-600"></div>

            {/* 停止按钮 */}
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className={`group relative flex items-center justify-center px-8 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 transform ${
                !isRunning
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700 scale-95'
                  : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:scale-105 hover:shadow-xl active:scale-95'
              }`}
            >
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Square
                size={20}
                className={`mr-3 transition-transform duration-300 ${
                  isRunning ? 'group-hover:scale-110' : ''
                }`}
              />
              <span className="text-base">{t('Stop')}</span>
              {!isRunning && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7zM12 7a1 1 0 012 0v6a1 1 0 11-2 0V7z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          </div>

          {/* 按钮底部提示信息 */}
          <div className="mt-4 text-center">
            {!isRunning && !command && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {!command
                  ? '⚠️ Please enter an FFmpeg command to start'
                  : 'Ready to start processing'}
              </p>
            )}
            {isRunning && (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Processing your media file... Please wait
              </p>
            )}
          </div>
        </div>
      </div>

      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => {
          setIsTemplateDialogOpen(false);
          setEditingTemplate(undefined);
        }}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      <div className="flex-grow flex flex-col overflow-hidden">
        {isRunning && progress > 0 && (
          <div className="flex-shrink-0 bg-white p-4 dark:bg-background-dark">
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

        <div className="flex-grow overflow-hidden bg-white p-4 pb-6 dark:bg-background-dark">
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
            className="border dark:border-border-dark h-full overflow-y-auto font-mono text-sm bg-gray-100 p-4 rounded whitespace-pre-wrap dark:bg-background-textarea dark:text-text-lightDark"
            dangerouslySetInnerHTML={{ __html: logs }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
