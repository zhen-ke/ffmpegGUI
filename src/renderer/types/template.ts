import { LocalizedString } from '../constants/commandTemplates';

export interface Template {
  id: string;
  name: LocalizedString;
  command: string;
  description: LocalizedString;
  isCustom?: boolean;
}
