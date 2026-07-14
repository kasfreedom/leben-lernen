export type UiLocale = string;
export type UiDirection = "ltr" | "rtl";
export type UiMessages = Readonly<Record<string, string>>;

export interface UiLocaleOption {
  readonly id: UiLocale;
  readonly label: string;
  readonly direction: UiDirection;
  readonly messagesPath: string;
}

export interface UiManifest {
  readonly defaultLocale: UiLocale;
  readonly locales: readonly UiLocaleOption[];
}

export interface UiBundle {
  readonly manifest: UiManifest;
  readonly messages: Readonly<Record<UiLocale, UiMessages>>;
}

export type UiTranslate = (
  key: string,
  values?: Readonly<Record<string, string | number>>
) => string;
