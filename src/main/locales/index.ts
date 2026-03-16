import { app } from 'electron';

type Locale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'ru'
  | 'pt';

interface LocaleMessages {
  [key: string]: string;
}

const locales: Record<Locale, LocaleMessages> = {
  en: {
    confirmOverwrite: 'Confirm Overwrite',
    fileAlreadyExists: "File '{filename}' already exists. Overwrite?",
    yes: 'Yes',
    no: 'No',
    operationCancelled: 'Operation cancelled: file was not overwritten.',
    cannotConfirmOverwrite:
      'Cannot confirm overwrite because the main window is unavailable.',
  },
  'zh-CN': {
    confirmOverwrite: '确认覆盖',
    fileAlreadyExists: "文件 '{filename}' 已存在。是否覆盖？",
    yes: '是',
    no: '否',
    operationCancelled: '操作已取消：文件未被覆盖。',
    cannotConfirmOverwrite: '无法确认覆盖，因为主窗口不可用。',
  },
  'zh-TW': {
    confirmOverwrite: '確認覆蓋',
    fileAlreadyExists: "檔案 '{filename}' 已存在。是否覆蓋？",
    yes: '是',
    no: '否',
    operationCancelled: '操作已取消：檔案未被覆蓋。',
    cannotConfirmOverwrite: '無法確認覆蓋，因為主視窗不可用。',
  },
  ja: {
    confirmOverwrite: '上書きの確認',
    fileAlreadyExists:
      "ファイル '{filename}' は既に存在します。上書きしますか？",
    yes: 'はい',
    no: 'いいえ',
    operationCancelled:
      '操作がキャンセルされました：ファイルは上書きされませんでした。',
    cannotConfirmOverwrite:
      'メインウィンドウが利用できないため、上書きを確認できません。',
  },
  ko: {
    confirmOverwrite: '덮어쓰기 확인',
    fileAlreadyExists:
      "파일 '{filename}'이(가) 이미 존재합니다. 덮어쓰시겠습니까?",
    yes: '예',
    no: '아니오',
    operationCancelled:
      '작업이 취소되었습니다: 파일이 덮어쓰여지지 않았습니다.',
    cannotConfirmOverwrite:
      '기본 창을 사용할 수 없어 덮어쓰기를 확인할 수 없습니다.',
  },
  es: {
    confirmOverwrite: 'Confirmar sobrescritura',
    fileAlreadyExists: "El archivo '{filename}' ya existe. ¿Sobrescribir?",
    yes: 'Sí',
    no: 'No',
    operationCancelled: 'Operación cancelada: el archivo no fue sobrescrito.',
    cannotConfirmOverwrite:
      'No se puede confirmar la sobrescritura porque la ventana principal no está disponible.',
  },
  fr: {
    confirmOverwrite: "Confirmer l'écrasement",
    fileAlreadyExists: "Le fichier '{filename}' existe déjà. Écraser ?",
    yes: 'Oui',
    no: 'Non',
    operationCancelled: "Opération annulée : le fichier n'a pas été écrasé.",
    cannotConfirmOverwrite:
      "Impossible de confirmer l'écrasement car la fenêtre principale n'est pas disponible.",
  },
  de: {
    confirmOverwrite: 'Überschreiben bestätigen',
    fileAlreadyExists:
      "Die Datei '{filename}' existiert bereits. Überschreiben?",
    yes: 'Ja',
    no: 'Nein',
    operationCancelled:
      'Vorgang abgebrochen: Die Datei wurde nicht überschrieben.',
    cannotConfirmOverwrite:
      'Überschreiben kann nicht bestätigt werden, da das Hauptfenster nicht verfügbar ist.',
  },
  ru: {
    confirmOverwrite: 'Подтвердить перезапись',
    fileAlreadyExists: "Файл '{filename}' уже существует. Перезаписать?",
    yes: 'Да',
    no: 'Нет',
    operationCancelled: 'Операция отменена: файл не был перезаписан.',
    cannotConfirmOverwrite:
      'Невозможно подтвердить перезапись, так как главное окно недоступно.',
  },
  pt: {
    confirmOverwrite: 'Confirmar sobrescrita',
    fileAlreadyExists: "O arquivo '{filename}' já existe. Sobrescrever?",
    yes: 'Sim',
    no: 'Não',
    operationCancelled: 'Operação cancelada: o arquivo não foi sobrescrito.',
    cannotConfirmOverwrite:
      'Não é possível confirmar a sobrescrita porque a janela principal não está disponível.',
  },
};

function getLocale(): Locale {
  const systemLocale = app.getLocale();

  if (systemLocale.startsWith('zh')) {
    if (systemLocale === 'zh-TW' || systemLocale === 'zh-HK') {
      return 'zh-TW';
    }
    return 'zh-CN';
  }

  const supportedLocales: Locale[] = [
    'en',
    'ja',
    'ko',
    'es',
    'fr',
    'de',
    'ru',
    'pt',
  ];
  const lang = systemLocale.split('-')[0] as Locale;

  if (supportedLocales.includes(lang)) {
    return lang;
  }

  return 'en';
}

let currentLocale: Locale | null = null;

export function initLocale(): Locale {
  currentLocale = getLocale();
  return currentLocale;
}

export function t(key: string, params?: Record<string, string>): string {
  if (!currentLocale) {
    currentLocale = getLocale();
  }

  const messages = locales[currentLocale];
  let message = messages[key] || locales['en'][key] || key;

  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      message = message
        .replace(`{${paramKey}}`, value)
        .replace(`{${paramKey}}`, value)
        .replace(`'{${paramKey}}'`, value);
    });
  }

  return message;
}

export function getCurrentLocale(): Locale {
  if (!currentLocale) {
    currentLocale = getLocale();
  }
  return currentLocale;
}
