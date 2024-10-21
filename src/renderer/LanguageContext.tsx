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
  },
  zh: {
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
