/** Shared syntax highlighting utilities for file preview and editor views. */

export type HlType = 'key' | 'string' | 'comment' | 'bool' | 'num' | 'punct' | 'keyword' | 'attr' | 'text';

export type ScriptLanguage = "lua" | "osiris" | "khn" | "anubis" | "constellations" | "json" | "yaml" | "xml";

/** Escape HTML entities for safe rendering. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Wrap raw text in a highlight span, escaping HTML entities.
 * 'text' type returns escaped text without a span wrapper.
 */
export function hl(text: string, type: HlType): string {
  const e = esc(text);
  return type === 'text' ? e : `<span class="hl-${type}">${e}</span>`;
}

export function highlightYaml(raw: string): string {
  if (/^\s*#/.test(raw)) return hl(raw, 'comment');
  const kvMatch = raw.match(/^(\s*)([\w\-]+)(:)(.*)/);
  if (kvMatch) {
    const [, indent, key, colon, rest] = kvMatch;
    let valHtml = esc(rest).replace(/"[^"]*"/g, m => `<span class="hl-string">${m}</span>`);
    valHtml = valHtml.replace(/\b(true|false)\b/gi, '<span class="hl-bool">$1</span>');
    return `${esc(indent)}${hl(key, 'key')}${hl(colon, 'punct')}${valHtml}`;
  }
  const listMatch = raw.match(/^(\s*)(- )(.*)/);
  if (listMatch) {
    const [, indent, dash, val] = listMatch;
    let valHtml = esc(val).replace(/"[^"]*"/g, m => `<span class="hl-string">${m}</span>`);
    return `${esc(indent)}${hl(dash, 'punct')}${valHtml}`;
  }
  return esc(raw);
}

/**
 * Tokenize-and-render JSON. Processes raw text in one pass to avoid
 * self-corruption from sequential regex replacements.
 */
export function highlightJson(raw: string): string {
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|([{}\[\]:,])/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) result += esc(raw.slice(pos, m.index));
    if (m[1] !== undefined) {
      result += m[2] !== undefined
        ? hl(m[1], 'key') + hl(m[2], 'punct')
        : hl(m[1], 'string');
    } else if (m[3] !== undefined) {
      result += hl(m[3], 'bool');
    } else if (m[4] !== undefined) {
      result += hl(m[4], 'num');
    } else if (m[5] !== undefined) {
      result += hl(m[5], 'punct');
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) result += esc(raw.slice(pos));
  return result;
}

/**
 * Tokenize-and-render Lua. Processes raw text in one pass.
 * Supports SE API (Ext.*), Osiris bridge (Osi.*), and same-line
 * multi-line strings ([[...]]) and block comments (--[[...]]).
 * NOTE: True multi-line tracking across lines is a known limitation —
 * the editor highlights line-by-line via highlightLine().
 */
export function highlightLua(raw: string): string {
  if (/^\s*--/.test(raw)) return hl(raw, 'comment');
  const re = /--\[\[.*?\]\]|--.*$|(\[\[.*?\]\])|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(Ext\.\w+(?:\.\w+)*)|(Osi\.\w+(?:\.\w+)*)|\b(local|function|end|if|then|else|elseif|do|while|for|in|repeat|until|return|break|not|and|or|nil|true|false|goto)\b|\b(\d+(?:\.\d+)?)\b/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) result += esc(raw.slice(pos, m.index));
    const full = m[0];
    if (full.startsWith('--')) {
      result += hl(full, 'comment');
    } else if (m[1] !== undefined) {
      result += hl(m[1], 'string');
    } else if (m[2] !== undefined) {
      result += hl(m[2], 'string');
    } else if (m[3] !== undefined) {
      result += hl(m[3], 'attr');
    } else if (m[4] !== undefined) {
      result += hl(m[4], 'key');
    } else if (m[5] !== undefined) {
      result += hl(m[5], 'keyword');
    } else if (m[6] !== undefined) {
      result += hl(m[6], 'num');
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) result += esc(raw.slice(pos));
  return result;
}

export function highlightMarkdown(raw: string): string {
  const escaped = esc(raw);
  if (/^#{1,6}\s/.test(raw)) return `<span class="hl-md-heading">${escaped}</span>`;
  let result = escaped.replace(/(\*\*|__)(.+?)\1/g, '<span class="hl-md-bold">$1$2$1</span>');
  result = result.replace(/(\*|_)(.+?)\1/g, '<span class="hl-md-italic">$1$2$1</span>');
  result = result.replace(/`([^`]+)`/g, '<span class="hl-md-code">`$1`</span>');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="hl-md-link">[$1]($2)</span>');
  return result;
}

/** Highlight XML attribute string (raw text between tag name and closing bracket). */
export function hlXmlAttrs(attrStr: string): string {
  if (!attrStr) return '';
  const re = /([\w:.-]+)(=)("(?:[^"\\]|\\.)*?")/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    if (m.index > pos) result += esc(attrStr.slice(pos, m.index));
    result += hl(m[1], 'attr') + hl(m[2], 'punct') + hl(m[3], 'string');
    pos = m.index + m[0].length;
  }
  if (pos < attrStr.length) result += esc(attrStr.slice(pos));
  return result;
}

/**
 * Tokenize-and-render XML. Processes raw text in one pass:
 * comments, PIs, tags (with attributes), and plain text.
 */
export function highlightXml(raw: string): string {
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[\w:.-]+(?:\s+[\w:.-]+\s*=\s*"[^"]*")*\s*\/?>|[^<]+|./g;
  let result = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const t = m[0];
    if (t.startsWith('<!--')) {
      result += hl(t, 'comment');
    } else if (t.startsWith('<?')) {
      const pi = t.match(/^(<\?)([\w:.-]+)([\s\S]*?)(\?>)$/);
      if (pi) {
        result += hl(pi[1], 'punct') + hl(pi[2], 'keyword') + hlXmlAttrs(pi[3]) + hl(pi[4], 'punct');
      } else {
        result += esc(t);
      }
    } else if (t.startsWith('<')) {
      const tag = t.match(/^(<\/?)([\w:.-]+)([\s\S]*?)(\/?>)$/);
      if (tag) {
        result += hl(tag[1], 'punct') + hl(tag[2], 'key') + hlXmlAttrs(tag[3]) + hl(tag[4], 'punct');
      } else {
        result += esc(t);
      }
    } else {
      result += esc(t);
    }
  }
  return result;
}

/**
 * Tokenize-and-render Osiris script. Processes raw text in one pass.
 */
export function highlightOsiris(raw: string): string {
  if (/^\s*\/\//.test(raw)) return hl(raw, 'comment');
  const re = /\/\/.*$|("(?:[^"\\]|\\.)*")|\b(Version|SubGoalCombiner|SGC_AND|INITSECTION|KBSECTION|EXITSECTION|ENDEXITSECTION|ParentTargetEdge|IF|THEN|AND|NOT|PROC|QRY|EVENTS)\b|\b(DB_\w+|PROC_\w+|QRY_\w+)\b|(\((?:INTEGER|INTEGER64|REAL|STRING|GUIDSTRING|CHARACTERGUID|ITEMGUID|TRIGGERGUID|CHARACTER|ITEM|TRIGGER|SPLINE|LEVELTEMPLATE|SPLINEGUID|LEVELTEMPLATEGUID)\))|\b(STRING|INTEGER|INTEGER64|REAL|GUIDSTRING|CHARACTERGUID|ITEMGUID|TRIGGERGUID|SPLINEGUID|LEVELTEMPLATEGUID|SPELLID|STATUSID|SURFACEID|LEVELTEMPLATEID|DIALOGRESOURCE|ACTION|PASSIVEID|TAG)\b|\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b|\b(\d+(?:\.\d+)?)\b/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) result += esc(raw.slice(pos, m.index));
    const full = m[0];
    if (full.startsWith('//')) {
      result += hl(full, 'comment');
    } else if (m[1] !== undefined) {
      result += hl(m[1], 'string');
    } else if (m[2] !== undefined) {
      result += hl(m[2], 'keyword');
    } else if (m[3] !== undefined) {
      result += hl(m[3], 'key');
    } else if (m[4] !== undefined) {
      result += hl(m[4], 'attr');
    } else if (m[5] !== undefined) {
      result += hl(m[5], 'attr');
    } else if (m[6] !== undefined) {
      result += hl(m[6], 'string');
    } else if (m[7] !== undefined) {
      result += hl(m[7], 'num');
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) result += esc(raw.slice(pos));
  return result;
}

/**
 * Tokenize-and-render Khonsu script. Extends Lua with condition function keywords
 * and bitwise operators.
 */
export function highlightKhonsu(raw: string): string {
  if (/^\s*--/.test(raw)) return hl(raw, 'comment');
  const re = /--.*$|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(context\.\w+(?:\.\w+)*)|\b(local|function|end|if|then|else|elseif|do|while|for|in|repeat|until|return|break|not|and|or|nil|true|false|goto)\b|\b(ConditionResult|HasPassive|HasStatus|HasSpell|IsClass|HasFlag|Tagged|GetDistanceTo|WieldingWeapon|SpellId|IsSpellOfSchool|HasSpellFlag|HasUseCosts|HasFunctor|Distance|Self|Ally|Enemy|Character|Item|Dead|HasActionResource|GetLevel|GetBaseAbility|StatusGetDescriptionParam|HasProficiency|GetAbilityModifier|GetProficiencyBonus)\b|([&|~]|<<|>>)|\b(\d+(?:\.\d+)?)\b/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) result += esc(raw.slice(pos, m.index));
    const full = m[0];
    if (full.startsWith('--')) {
      result += hl(full, 'comment');
    } else if (m[1] !== undefined) {
      result += hl(m[1], 'string');
    } else if (m[2] !== undefined) {
      result += hl(m[2], 'attr');
    } else if (m[3] !== undefined) {
      result += hl(m[3], 'keyword');
    } else if (m[4] !== undefined) {
      result += hl(m[4], 'key');
    } else if (m[5] !== undefined) {
      result += hl(m[5], 'punct');
    } else if (m[6] !== undefined) {
      result += hl(m[6], 'num');
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) result += esc(raw.slice(pos));
  return result;
}

/**
 * Tokenize-and-render framework Lua (Anubis/Constellations). Extends Lua with
 * framework-specific keywords.
 */
export function highlightFrameworkLua(raw: string): string {
  if (/^\s*--/.test(raw)) return hl(raw, 'comment');
  const re = /--.*$|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(local|function|end|if|then|else|elseif|do|while|for|in|repeat|until|return|break|not|and|or|nil|true|false|goto)\b|\b(State|Config|Proxy|Action|Event|Handler|Listener|OnCreate|OnDestroy|OnActivate|OnDeactivate|OnTurnStart|OnTurnEnd|Register|Unregister)\b|\b(\d+(?:\.\d+)?)\b/g;
  let result = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) result += esc(raw.slice(pos, m.index));
    const full = m[0];
    if (full.startsWith('--')) {
      result += hl(full, 'comment');
    } else if (m[1] !== undefined) {
      result += hl(m[1], 'string');
    } else if (m[2] !== undefined) {
      result += hl(m[2], 'keyword');
    } else if (m[3] !== undefined) {
      result += hl(m[3], 'key');
    } else if (m[4] !== undefined) {
      result += hl(m[4], 'num');
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) result += esc(raw.slice(pos));
  return result;
}

/** Dispatch highlighting based on file language/extension. */
export function highlightLine(line: string, language: string): string {
  switch (language) {
    case "yaml": case "yml": return highlightYaml(line);
    case "json": return highlightJson(line);
    case "lua": return highlightLua(line);
    case "md": return highlightMarkdown(line);
    case "xml": case "lsx": return highlightXml(line);
    case "osiris": return highlightOsiris(line);
    case "khn": return highlightKhonsu(line);
    case "anubis": case "constellations": return highlightFrameworkLua(line);
    default: return esc(line);
  }
}
