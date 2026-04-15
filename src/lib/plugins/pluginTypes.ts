/** Unique plugin identifier (reverse-domain: "cmty.git", "cmty.forge") */
export type PluginId = string;

/** Plugin manifest — declarative description of what a plugin contributes */
export interface PluginManifest {
  id: PluginId;
  name: string;
  description?: string;
  version?: string;
  activationEvents: ActivationEvent[];
  contributes: PluginContributions;
}

/** Activation event strings — when the plugin should be loaded */
export type ActivationEvent =
  | "*"
  | `onCommand:${string}`
  | `onView:${string}`
  | "onStartupFinished"
  | `onContext:${string}`;

/** All contribution types a plugin can declare */
export interface PluginContributions {
  commands?: CommandContribution[];
  configuration?: ConfigurationContribution;
  views?: Record<string, ViewContribution[]>;
  viewsContainers?: ViewContainerContribution[];
  statusBarItems?: StatusBarItemContribution[];
  menus?: MenuContributions;
  keybindings?: KeybindingContribution[];
}

/** Single command contribution */
export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
}

/** Configuration contribution (settings) */
export interface ConfigurationContribution {
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  type: "string" | "boolean" | "number" | "array" | "object";
  default: unknown;
  description: string;
  enum?: unknown[];
  enumDescriptions?: string[];
  scope?: "application" | "workspace";
  order?: number;
}

/** View contributed to a view container */
export interface ViewContribution {
  id: string;
  name: string;
  when?: string;
  icon?: string;
}

/** View container (Activity Bar / sidebar section) */
export interface ViewContainerContribution {
  id: string;
  title: string;
  icon: string;
  iconComponent?: import("svelte").Component;
  location: "sidebar" | "panel";
}

/** Status bar item contribution */
export interface StatusBarItemContribution {
  id: string;
  alignment: "left" | "right";
  priority?: number;
  when?: string;
}

/** Menu contributions — which menus a command appears in */
export interface MenuContributions {
  commandPalette?: MenuEntry[];
  "editor/context"?: MenuEntry[];
  "view/title"?: MenuEntry[];
  "view/item/context"?: MenuEntry[];
}

export interface MenuEntry {
  command: string;
  when?: string;
  group?: string;
  order?: number;
}

/** Keybinding contribution */
export interface KeybindingContribution {
  command: string;
  key: string;
  when?: string;
}

/** Context passed to activate() */
export interface PluginContext {
  pluginId: PluginId;
  subscriptions: Disposable[];
}

/** Cleanup handle */
export interface Disposable {
  dispose(): void;
}

/** Plugin module — the runtime object a plugin exports */
export interface PluginModule {
  manifest: PluginManifest;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
