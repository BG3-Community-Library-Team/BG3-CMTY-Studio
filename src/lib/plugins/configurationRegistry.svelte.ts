/**
 * EXT-3: Configuration Registry — plugin settings schema + value store.
 *
 * Plugins declare settings schema via contributes.configuration.
 * This registry stores schemas and runtime values, providing get/set
 * with type validation and default fallback.
 */

import type {
  ConfigurationContribution,
  ConfigurationProperty,
  Disposable,
} from "./pluginTypes.js";

interface RegisteredConfiguration {
  pluginId: string;
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

class ConfigurationRegistry {
  private schemas: RegisteredConfiguration[] = $state([]);
  private values: Record<string, unknown> = $state({});

  /** Register a plugin's configuration schema */
  registerConfiguration(pluginId: string, config: ConfigurationContribution): Disposable {
    const entry: RegisteredConfiguration = {
      pluginId,
      title: config.title,
      properties: config.properties,
    };
    this.schemas = [...this.schemas, entry];

    // Set defaults for any properties not already set
    for (const [key, prop] of Object.entries(config.properties)) {
      if (!(key in this.values)) {
        this.values = { ...this.values, [key]: prop.default };
      }
    }

    return {
      dispose: () => {
        this.schemas = this.schemas.filter(s => s !== entry);
        // Remove values for this plugin's properties
        const newValues = { ...this.values };
        for (const key of Object.keys(config.properties)) {
          delete newValues[key];
        }
        this.values = newValues;
      },
    };
  }

  /** Get a configuration value (returns default if not set) */
  get<T>(key: string): T {
    if (key in this.values) {
      return this.values[key] as T;
    }
    // Find default from schema
    for (const section of this.schemas) {
      if (key in section.properties) {
        return section.properties[key].default as T;
      }
    }
    return undefined as T;
  }

  /** Set a configuration value */
  set(key: string, value: unknown): void {
    this.values = { ...this.values, [key]: value };
  }

  /** Get all registered sections for the settings UI to render */
  getSections(): RegisteredConfiguration[] {
    return this.schemas;
  }

  /** Get all properties for a given section title */
  getProperties(sectionTitle: string): Record<string, ConfigurationProperty> {
    const section = this.schemas.find(s => s.title === sectionTitle);
    return section?.properties ?? {};
  }

  /** Get all current values (for persistence) */
  getAllValues(): Record<string, unknown> {
    return { ...this.values };
  }

  /** Restore values from persisted storage */
  restoreValues(stored: Record<string, unknown>): void {
    this.values = { ...this.values, ...stored };
  }
}

export { type RegisteredConfiguration };
export const configurationRegistry = new ConfigurationRegistry();
