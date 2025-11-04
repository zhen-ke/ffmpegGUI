import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
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
    'Command Template': 'Command Template',
    'Select a template': 'Select a template',
    'FFmpeg Command': 'FFmpeg Command',
    'Enter FFmpeg command or drag & drop files here':
      'Enter FFmpeg command or drag & drop files here',
    Start: 'Start',
    Stop: 'Stop',
    Progress: 'Progress',
    Logs: 'Logs',
    Clear: 'Clear',
    Copy: 'Copy',
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
    'Select Output Folder': 'Select Output Folder',
  },
  zh: {
    'Add Template': '添加模板',
    Terminal: '终端',
    'Command Template': '命令模板',
    'Select a template': '选择模板',
    'FFmpeg Command': 'FFmpeg 命令',
    'Enter FFmpeg command or drag & drop files here':
      '输入 FFmpeg 命令或拖放文件到这里',
    Start: '开始',
    Stop: '停止',
    Progress: '进度',
    Logs: '日志',
    Clear: '清除',
    Copy: '复制',
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
    'Select Output Folder': '选择输出文件夹',
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

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

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
