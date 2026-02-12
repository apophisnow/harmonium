import './harmonium/dark.css';
import './harmonium/light.css';
import './crayon/dark.css';
import './crayon/light.css';
import './crayon/effects.css';
import './oled/dark.css';
import './oled/light.css';

import { harmoniumTheme } from './harmonium/index.js';
import { crayonTheme } from './crayon/index.js';
import { oledTheme } from './oled/index.js';

export type Mode = 'dark' | 'light';

export interface ThemeDefinition {
  id: string;
  name: string;
  supportedModes: Mode[];
}

export const themes: ThemeDefinition[] = [harmoniumTheme, crayonTheme, oledTheme];

export const DEFAULT_THEME = 'harmonium';
export const DEFAULT_MODE: Mode = 'dark';
