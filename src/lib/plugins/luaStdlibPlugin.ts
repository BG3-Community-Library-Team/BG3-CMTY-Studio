import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const LUA_GLOBALS: CompletionItem[] = [
  { label: 'print', insertText: 'print()', detail: 'Print to stdout', kind: 'function' },
  { label: 'type', insertText: 'type()', detail: 'Get type of value', kind: 'function' },
  { label: 'tostring', insertText: 'tostring()', detail: 'Convert to string', kind: 'function' },
  { label: 'tonumber', insertText: 'tonumber()', detail: 'Convert to number', kind: 'function' },
  { label: 'pairs', insertText: 'pairs()', detail: 'Iterate key-value pairs', kind: 'function' },
  { label: 'ipairs', insertText: 'ipairs()', detail: 'Iterate integer keys', kind: 'function' },
  { label: 'require', insertText: 'require("")', detail: 'Load a module', kind: 'function' },
  { label: 'error', insertText: 'error("")', detail: 'Throw an error', kind: 'function' },
  { label: 'pcall', insertText: 'pcall()', detail: 'Protected call', kind: 'function' },
  { label: 'xpcall', insertText: 'xpcall()', detail: 'Extended protected call', kind: 'function' },
  { label: 'select', insertText: 'select()', detail: 'Select from arguments', kind: 'function' },
  { label: 'unpack', insertText: 'unpack()', detail: 'Unpack table', kind: 'function' },
  { label: 'setmetatable', insertText: 'setmetatable()', detail: 'Set metatable', kind: 'function' },
  { label: 'getmetatable', insertText: 'getmetatable()', detail: 'Get metatable', kind: 'function' },
  { label: 'rawget', insertText: 'rawget()', detail: 'Raw table get', kind: 'function' },
  { label: 'rawset', insertText: 'rawset()', detail: 'Raw table set', kind: 'function' },
  { label: 'rawlen', insertText: 'rawlen()', detail: 'Raw length', kind: 'function' },
  { label: 'assert', insertText: 'assert()', detail: 'Assert condition', kind: 'function' },
  { label: 'next', insertText: 'next()', detail: 'Next table key', kind: 'function' },
  { label: 'collectgarbage', insertText: 'collectgarbage()', detail: 'Garbage collection', kind: 'function' },
];

const TABLE_LIB: CompletionItem[] = [
  { label: 'table.insert', insertText: 'table.insert()', detail: 'Insert into table', kind: 'function' },
  { label: 'table.remove', insertText: 'table.remove()', detail: 'Remove from table', kind: 'function' },
  { label: 'table.sort', insertText: 'table.sort()', detail: 'Sort table in-place', kind: 'function' },
  { label: 'table.concat', insertText: 'table.concat()', detail: 'Concatenate table to string', kind: 'function' },
  { label: 'table.move', insertText: 'table.move()', detail: 'Move elements between tables', kind: 'function' },
  { label: 'table.unpack', insertText: 'table.unpack()', detail: 'Unpack table values', kind: 'function' },
  { label: 'table.pack', insertText: 'table.pack()', detail: 'Pack values into table', kind: 'function' },
];

const STRING_LIB: CompletionItem[] = [
  { label: 'string.format', insertText: 'string.format()', detail: 'Format string', kind: 'function' },
  { label: 'string.find', insertText: 'string.find()', detail: 'Find pattern', kind: 'function' },
  { label: 'string.gsub', insertText: 'string.gsub()', detail: 'Global substitution', kind: 'function' },
  { label: 'string.sub', insertText: 'string.sub()', detail: 'Substring', kind: 'function' },
  { label: 'string.upper', insertText: 'string.upper()', detail: 'Uppercase', kind: 'function' },
  { label: 'string.lower', insertText: 'string.lower()', detail: 'Lowercase', kind: 'function' },
  { label: 'string.len', insertText: 'string.len()', detail: 'String length', kind: 'function' },
  { label: 'string.rep', insertText: 'string.rep()', detail: 'Repeat string', kind: 'function' },
  { label: 'string.byte', insertText: 'string.byte()', detail: 'String to byte', kind: 'function' },
  { label: 'string.char', insertText: 'string.char()', detail: 'Byte to character', kind: 'function' },
  { label: 'string.match', insertText: 'string.match()', detail: 'Pattern match', kind: 'function' },
  { label: 'string.gmatch', insertText: 'string.gmatch()', detail: 'Global pattern match', kind: 'function' },
  { label: 'string.reverse', insertText: 'string.reverse()', detail: 'Reverse string', kind: 'function' },
];

const MATH_LIB: CompletionItem[] = [
  { label: 'math.floor', insertText: 'math.floor()', detail: 'Floor', kind: 'function' },
  { label: 'math.ceil', insertText: 'math.ceil()', detail: 'Ceiling', kind: 'function' },
  { label: 'math.abs', insertText: 'math.abs()', detail: 'Absolute value', kind: 'function' },
  { label: 'math.max', insertText: 'math.max()', detail: 'Maximum', kind: 'function' },
  { label: 'math.min', insertText: 'math.min()', detail: 'Minimum', kind: 'function' },
  { label: 'math.random', insertText: 'math.random()', detail: 'Random number', kind: 'function' },
  { label: 'math.randomseed', insertText: 'math.randomseed()', detail: 'Seed random', kind: 'function' },
  { label: 'math.sqrt', insertText: 'math.sqrt()', detail: 'Square root', kind: 'function' },
  { label: 'math.sin', insertText: 'math.sin()', detail: 'Sine', kind: 'function' },
  { label: 'math.cos', insertText: 'math.cos()', detail: 'Cosine', kind: 'function' },
  { label: 'math.pi', insertText: 'math.pi', detail: 'Pi constant', kind: 'property' },
  { label: 'math.huge', insertText: 'math.huge', detail: 'Infinity', kind: 'property' },
];

const LUA_KEYWORDS: CompletionItem[] = [
  { label: 'local', insertText: 'local ', detail: 'Local variable', kind: 'keyword' },
  { label: 'function', insertText: 'function', detail: 'Function declaration', kind: 'keyword' },
  { label: 'if', insertText: 'if', detail: 'Conditional', kind: 'keyword' },
  { label: 'then', insertText: 'then', detail: 'Then clause', kind: 'keyword' },
  { label: 'else', insertText: 'else', detail: 'Else clause', kind: 'keyword' },
  { label: 'elseif', insertText: 'elseif', detail: 'Elseif clause', kind: 'keyword' },
  { label: 'end', insertText: 'end', detail: 'End block', kind: 'keyword' },
  { label: 'for', insertText: 'for', detail: 'For loop', kind: 'keyword' },
  { label: 'while', insertText: 'while', detail: 'While loop', kind: 'keyword' },
  { label: 'repeat', insertText: 'repeat', detail: 'Repeat loop', kind: 'keyword' },
  { label: 'until', insertText: 'until', detail: 'Until condition', kind: 'keyword' },
  { label: 'do', insertText: 'do', detail: 'Do block', kind: 'keyword' },
  { label: 'return', insertText: 'return', detail: 'Return statement', kind: 'keyword' },
  { label: 'break', insertText: 'break', detail: 'Break loop', kind: 'keyword' },
  { label: 'nil', insertText: 'nil', detail: 'Nil value', kind: 'keyword' },
  { label: 'true', insertText: 'true', detail: 'Boolean true', kind: 'keyword' },
  { label: 'false', insertText: 'false', detail: 'Boolean false', kind: 'keyword' },
  { label: 'and', insertText: 'and', detail: 'Logical AND', kind: 'keyword' },
  { label: 'or', insertText: 'or', detail: 'Logical OR', kind: 'keyword' },
  { label: 'not', insertText: 'not', detail: 'Logical NOT', kind: 'keyword' },
  { label: 'in', insertText: 'in', detail: 'In iterator', kind: 'keyword' },
];

const SNIPPETS: CompletionItem[] = [
  { label: 'for i = ...', insertText: 'for i = 1, 10 do\n\t\nend', detail: 'Numeric for loop', kind: 'snippet' },
  { label: 'for k, v in pairs', insertText: 'for k, v in pairs() do\n\t\nend', detail: 'Pairs iteration', kind: 'snippet' },
  { label: 'for i, v in ipairs', insertText: 'for i, v in ipairs() do\n\t\nend', detail: 'IPairs iteration', kind: 'snippet' },
  { label: 'if then end', insertText: 'if  then\n\t\nend', detail: 'If block', kind: 'snippet' },
  { label: 'function ()', insertText: 'function()\n\t\nend', detail: 'Anonymous function', kind: 'snippet' },
  { label: 'local function', insertText: 'local function ()\n\t\nend', detail: 'Local function', kind: 'snippet' },
];

const ALL_ITEMS = [...LUA_GLOBALS, ...TABLE_LIB, ...STRING_LIB, ...MATH_LIB, ...LUA_KEYWORDS, ...SNIPPETS];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const luaStdlibPlugin: CompletionPlugin = {
  id: 'lua-stdlib',
  name: 'Lua Standard Library',
  languages: ['lua'],
  priority: 200,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    // Dot-prefixed: table.*, string.*, math.*
    if (prefix.startsWith('table.')) return filterByPrefix(TABLE_LIB, prefix);
    if (prefix.startsWith('string.')) return filterByPrefix(STRING_LIB, prefix);
    if (prefix.startsWith('math.')) return filterByPrefix(MATH_LIB, prefix);

    // Generic
    return filterByPrefix(ALL_ITEMS, prefix);
  },
};
