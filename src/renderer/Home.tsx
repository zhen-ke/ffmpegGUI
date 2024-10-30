import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
} from 'react';
import { Play, Square, PlusCircle } from 'lucide-react';
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
    setCommand(template.command);
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
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors duration-200"
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
        <div className="mb-4">
          <label
            htmlFor="ffmpeg-command"
            className="block font-semibold text-gray-700 mb-2 dark:text-text-dark"
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
            className="w-full p-2 border border-gray-300 rounded resize-none font-mono text-sm dark:bg-background-textarea dark:border-border-dark dark:text-text-lightDark"
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
                ? 'bg-gray-300 cursor-not-allowed dark:bg-background-textarea'
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
                ? 'bg-gray-300 cursor-not-allowed dark:bg-background-textarea'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <Square size={18} className="mr-2" />
            {t('Stop')}
          </button>
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
