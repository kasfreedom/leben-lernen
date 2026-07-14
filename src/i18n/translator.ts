import type { UiMessages, UiTranslate } from "./types";

const TOKEN_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/gu;

export function createUiTranslator(
  selectedMessages: UiMessages,
  fallbackMessages: UiMessages
): UiTranslate {
  return (key, values = {}) => {
    const template = selectedMessages[key] ?? fallbackMessages[key] ?? key;
    return template.replace(TOKEN_PATTERN, (token, name: string) => {
      const value = values[name];
      return value === undefined ? token : String(value);
    });
  };
}
