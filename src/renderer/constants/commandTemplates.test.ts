import {
  containsUnsupportedShellOperators,
  parseFFmpegCommand,
} from '../../main/utils/commandParser';
import { commandTemplates } from './commandTemplates';

describe('commandTemplates', () => {
  it('ships only single-command built-in templates', () => {
    commandTemplates.forEach((template) => {
      const args = parseFFmpegCommand(template.command);
      expect(containsUnsupportedShellOperators(args)).toBe(false);
    });
  });
});
