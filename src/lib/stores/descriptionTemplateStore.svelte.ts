export interface DescriptionTemplate {
  id: string;
  name: string;
  platform: "nexus" | "modio" | "both";
  /** Template content with {placeholders} */
  content: string;
}

const BUILTIN_TEMPLATES: DescriptionTemplate[] = [
  {
    id: "basic-nexus",
    name: "Basic Nexus Description",
    platform: "nexus",
    content: `# {mod_name}

**Version:** {version}
**Author:** {author}

## Description
{description}

## Requirements
{dependencies}

## Installation
1. Download the file
2. Extract to your BG3 Mods folder
3. Enable in your mod manager

## Changelog
### v{version}
- Initial release`,
  },
  {
    id: "basic-modio",
    name: "Basic mod.io Description",
    platform: "modio",
    content: `<h1>{mod_name}</h1>
<p><strong>Version:</strong> {version}<br>
<strong>Author:</strong> {author}</p>

<h2>Description</h2>
<p>{description}</p>

<h2>Requirements</h2>
{dependencies}

<h2>Installation</h2>
<ol>
<li>Subscribe to this mod</li>
<li>Enable in your mod manager</li>
</ol>`,
  },
  {
    id: "detailed-nexus",
    name: "Detailed Nexus Description",
    platform: "nexus",
    content: `# {mod_name}

> {summary}

**Version:** {version} | **Author:** {author}

## Overview
{description}

## Features
- Feature 1
- Feature 2

## Requirements
{dependencies}

## Compatibility
- Compatible with Patch 8+
- Load order: After dependencies

## Installation
### Manual
1. Download the main file
2. Extract the .pak file to \`%LocalAppData%/Larian Studios/Baldur's Gate 3/Mods\`
3. Add to modsettings.lsx or use a mod manager

### Mod Manager
1. Download and install through your preferred mod manager

## FAQ
**Q: Is this compatible with X?**
A: Yes / No / See compatibility section

## Credits
- Credit 1

## Changelog
### v{version}
- Initial release`,
  },
];

class DescriptionTemplateStore {
  templates: DescriptionTemplate[] = $state(BUILTIN_TEMPLATES);

  /**
   * Fill a template with values from provided overrides.
   */
  fillTemplate(templateId: string, overrides: Record<string, string> = {}): string | null {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return null;

    const values: Record<string, string> = {
      mod_name: overrides.mod_name ?? "",
      version: overrides.version ?? "",
      author: overrides.author ?? "",
      description: overrides.description ?? "",
      summary: overrides.summary ?? "",
      dependencies: overrides.dependencies ?? "None",
      ...overrides,
    };

    return template.content.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
  }
}

export const descriptionTemplateStore = new DescriptionTemplateStore();
