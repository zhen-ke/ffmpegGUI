import { LocalizedString } from '../constants/commandTemplates';

export interface Template {
  id: string;
  name: LocalizedString;
  command: string;
  description: LocalizedString;
  isCustom?: boolean;
}

export interface TemplateGroup {
  builtin: Template[];
  custom: Template[];
}
