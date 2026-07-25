import { v4 as uuidv4 } from 'uuid';
import { Template } from '../types/template';
import {
  readLocalStorage,
  writeLocalStorage,
} from '../utils/localStorageUtils';

const CUSTOM_TEMPLATES_KEY = 'custom_ffmpeg_templates';

export const templateService = {
  getCustomTemplates(): Template[] {
    return readLocalStorage<Template[]>(CUSTOM_TEMPLATES_KEY, []);
  },

  saveCustomTemplate(template: Omit<Template, 'id' | 'isCustom'>): Template {
    const customTemplates = this.getCustomTemplates();
    const newTemplate = {
      ...template,
      id: uuidv4(),
      isCustom: true,
    };

    customTemplates.push(newTemplate);
    writeLocalStorage(CUSTOM_TEMPLATES_KEY, customTemplates);
    return newTemplate;
  },

  updateCustomTemplate(template: Template): void {
    const customTemplates = this.getCustomTemplates();
    const index = customTemplates.findIndex((t) => t.id === template.id);
    if (index !== -1) {
      customTemplates[index] = template;
      writeLocalStorage(CUSTOM_TEMPLATES_KEY, customTemplates);
    }
  },

  deleteCustomTemplate(templateId: string): void {
    const customTemplates = this.getCustomTemplates();
    const filtered = customTemplates.filter((t) => t.id !== templateId);
    writeLocalStorage(CUSTOM_TEMPLATES_KEY, filtered);
  },
};
