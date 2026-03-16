import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const translations: Record<Language, Record<string, string>> = {
  en: {
    'Add Template': 'Add Template',
    Template: 'Template',
    'FFmpeg Tool': 'FFmpeg Tool',
    'Command Template': 'Command Template',
    'Select a template': 'Select a template',
    'FFmpeg Command': 'FFmpeg Command',
    'Enter FFmpeg command or drag & drop files here':
      'Enter FFmpeg command or drag & drop files here',
    Terminal: 'Terminal',
    Start: 'Start',
    Stop: 'Stop',
    'Stopping...': 'Stopping...',
    Progress: 'Progress',
    Logs: 'Logs',
    Clear: 'Clear',
    Copy: 'Copy',
    'Console Output': 'Console Output',
    'Copy raw text': 'Copy raw text',
    'Clear console': 'Clear console',
    'Ready to process...': 'Ready to process...',
    Paused: 'Paused',
    'Processing...': 'Processing...',
    'Waiting for progress...': 'Waiting for progress...',
    'Installing FFmpeg': 'Installing FFmpeg',
    Downloading: 'Downloading',
    Extracting: 'Extracting',
    'Loading FFmpeg assets...': 'Loading FFmpeg assets...',
    Error: 'Error',
    'Try Again': 'Try Again',
    'Download FFmpeg': 'Download FFmpeg',
    'FFmpeg is not detected on your system. Please download it to continue.':
      'FFmpeg is not detected on your system. Please download it to continue.',
    'Select a version:': 'Select a version:',
    'The latest version of FFmpeg will be downloaded automatically.':
      'The latest version of FFmpeg will be downloaded automatically.',
    'Download and Install FFmpeg': 'Download and Install FFmpeg',
    'Failed to fetch FFmpeg assets.': 'Failed to fetch FFmpeg assets.',
    'Edit Template': 'Edit Template',
    'Add New Template': 'Add New Template',
    'Name (English)': 'Name (English)',
    'Name (Chinese)': 'Name (Chinese)',
    Command: 'Command',
    'Description (English)': 'Description (English)',
    'Description (Chinese)': 'Description (Chinese)',
    Cancel: 'Cancel',
    Save: 'Save',
    'Select Input File': 'Select Input File',
    'Input File': 'Input File',
    'Select Output Folder': 'Select Output Folder',
    'Output Folder': 'Output Folder',
    'Selecting a template will replace the current command. Continue?':
      'Selecting a template will replace the current command. Continue?',
    'Delete this custom template?': 'Delete this custom template?',
    'This command has multiple input files; only the first -i is auto-bound from the input selector.':
      'This command has multiple input files; only the first -i is auto-bound from the input selector.',
    'Command copied to clipboard.': 'Command copied to clipboard.',
    'Log copied to clipboard.': 'Log copied to clipboard.',
    'Nothing to copy.': 'Nothing to copy.',
    'Failed to copy command.': 'Failed to copy command.',
    'Failed to copy logs.': 'Failed to copy logs.',
    'Failed to open terminal.': 'Failed to open terminal.',
    'Failed to select input file. Please try again.':
      'Failed to select input file. Please try again.',
    'Failed to select output folder. Please try again.':
      'Failed to select output folder. Please try again.',
    'Failed to save template. Please check your data.':
      'Failed to save template. Please check your data.',
    'Failed to delete template.': 'Failed to delete template.',
    'Failed to load templates.': 'Failed to load templates.',
    'Failed to check FFmpeg status.': 'Failed to check FFmpeg status.',
    'Please provide at least one name and description, and a command.':
      'Please provide at least one name and description, and a command.',
    'Drag & drop files or type manually': 'Drag & drop files or type manually',
    characters: 'characters',
    'Select a template or enter a command to begin':
      'Select a template or enter a command to begin',
  },
  zh: {
    'Add Template': '添加模板',
    Template: '模板',
    'FFmpeg Tool': 'FFmpeg 工具',
    Terminal: '终端',
    'Command Template': '命令模板',
    'Select a template': '选择模板',
    'FFmpeg Command': 'FFmpeg 命令',
    'Enter FFmpeg command or drag & drop files here':
      '输入 FFmpeg 命令或拖放文件到这里',
    Start: '开始',
    Stop: '停止',
    'Stopping...': '停止中...',
    Progress: '进度',
    Logs: '日志',
    Clear: '清除',
    Copy: '复制',
    'Console Output': '控制台输出',
    'Copy raw text': '复制原始文本',
    'Clear console': '清空控制台',
    'Ready to process...': '准备就绪，等待处理...',
    'Select a template or enter a command to begin': '选择模板或输入命令以开始',
    Paused: '已暂停自动滚动',
    'Processing...': '处理中...',
    'Waiting for progress...': '等待进度...',
    'Installing FFmpeg': '正在安装 FFmpeg',
    Downloading: '下载中',
    Extracting: '解压中',
    'Loading FFmpeg assets...': '正在加载 FFmpeg 资源...',
    Error: '错误',
    'Try Again': '重试',
    'Download FFmpeg': '下载 FFmpeg',
    'FFmpeg is not detected on your system. Please download it to continue.':
      '系统未检测到 FFmpeg，请先下载后继续。',
    'Select a version:': '选择一个版本：',
    'The latest version of FFmpeg will be downloaded automatically.':
      '将自动下载最新版本的 FFmpeg。',
    'Download and Install FFmpeg': '下载并安装 FFmpeg',
    'Failed to fetch FFmpeg assets.': '获取 FFmpeg 资源失败。',
    'Edit Template': '编辑模板',
    'Add New Template': '添加新模板',
    'Name (English)': '名称（英文）',
    'Name (Chinese)': '名称（中文）',
    Command: '命令',
    'Description (English)': '描述（英文）',
    'Description (Chinese)': '描述（中文）',
    Cancel: '取消',
    Save: '保存',
    'Select Input File': '选择输入文件',
    'Input File': '输入文件',
    'Select Output Folder': '选择输出文件夹',
    'Output Folder': '输出文件夹',
    'Selecting a template will replace the current command. Continue?':
      '选择模板将覆盖当前命令，是否继续？',
    'Delete this custom template?': '确认删除该自定义模板吗？',
    'This command has multiple input files; only the first -i is auto-bound from the input selector.':
      '当前命令包含多个输入文件；输入选择器只会自动绑定第一个 -i，其余请手动调整。',
    'Command copied to clipboard.': '命令已复制到剪贴板。',
    'Log copied to clipboard.': '日志已复制到剪贴板。',
    'Nothing to copy.': '没有可复制的内容。',
    'Failed to copy command.': '复制命令失败。',
    'Failed to copy logs.': '复制日志失败。',
    'Failed to open terminal.': '打开终端失败。',
    'Failed to select input file. Please try again.':
      '选择输入文件失败，请重试。',
    'Failed to select output folder. Please try again.':
      '选择输出文件夹失败，请重试。',
    'Failed to save template. Please check your data.':
      '保存模板失败，请检查输入内容。',
    'Failed to delete template.': '删除模板失败。',
    'Failed to load templates.': '加载模板失败。',
    'Failed to check FFmpeg status.': '检查 FFmpeg 状态失败。',
    'Please provide at least one name and description, and a command.':
      '请至少填写一侧名称和描述，并提供命令。',
    'Drag & drop files or type manually': '拖拽文件或手动输入',
    characters: '个字符',
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language') as Language | null;
    return savedLanguage || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      return translations[language][key] || key;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
