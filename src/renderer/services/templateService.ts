import { Template } from '../types/template';
import { v4 as uuidv4 } from 'uuid';

const CUSTOM_TEMPLATES_KEY = 'custom_ffmpeg_templates';

export const templateService = {
  getCustomTemplates(): Template[] {
    try {
      const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveCustomTemplate(template: Omit<Template, 'id' | 'isCustom'>): Template {
    const customTemplates = this.getCustomTemplates();
    const newTemplate = {
      ...template,
      id: uuidv4(),
      isCustom: true,
    };

    customTemplates.push(newTemplate);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customTemplates));
    return newTemplate;
  },

  updateCustomTemplate(template: Template): void {
    const customTemplates = this.getCustomTemplates();
    const index = customTemplates.findIndex((t) => t.id === template.id);
    if (index !== -1) {
      customTemplates[index] = template;
      localStorage.setItem(
        CUSTOM_TEMPLATES_KEY,
        JSON.stringify(customTemplates),
      );
    }
  },

  deleteCustomTemplate(templateId: string): void {
    const customTemplates = this.getCustomTemplates();
    const filtered = customTemplates.filter((t) => t.id !== templateId);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(filtered));
  },
};
