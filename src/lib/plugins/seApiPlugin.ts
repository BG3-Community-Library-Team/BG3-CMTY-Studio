import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

// ── Ext.* completions ──

const EXT_CORE: CompletionItem[] = [
  { label: 'Ext.Require', insertText: 'Ext.Require("")', detail: 'Load a Lua module (relative to ScriptExtender/Lua/)', kind: 'function' },
  { label: 'Ext.Dump', insertText: 'Ext.Dump()', detail: 'Dump value to console (hierarchical)', kind: 'function' },
  { label: 'Ext.DumpExport', insertText: 'Ext.DumpExport()', detail: 'Serialize object to string for export', kind: 'function' },
];

const EXT_UTILS: CompletionItem[] = [
  { label: 'Ext.Utils.Print', insertText: 'Ext.Utils.Print()', detail: 'Print to SE console', kind: 'function' },
  { label: 'Ext.Utils.PrintError', insertText: 'Ext.Utils.PrintError()', detail: 'Print error to SE console', kind: 'function' },
  { label: 'Ext.Utils.PrintWarning', insertText: 'Ext.Utils.PrintWarning()', detail: 'Print warning to SE console', kind: 'function' },
  { label: 'Ext.Utils.Version', insertText: 'Ext.Utils.Version()', detail: 'SE API version (int32)', kind: 'function' },
  { label: 'Ext.Utils.GameVersion', insertText: 'Ext.Utils.GameVersion()', detail: 'Game version string', kind: 'function' },
  { label: 'Ext.Utils.GetGameState', insertText: 'Ext.Utils.GetGameState()', detail: 'Current game state enum', kind: 'function' },
  { label: 'Ext.Utils.GetGlobalSwitches', insertText: 'Ext.Utils.GetGlobalSwitches()', detail: 'Global engine settings object', kind: 'function' },
  { label: 'Ext.Utils.GetCommandLineParams', insertText: 'Ext.Utils.GetCommandLineParams()', detail: 'CLI arguments used to launch game', kind: 'function' },
  { label: 'Ext.Utils.HandleToInteger', insertText: 'Ext.Utils.HandleToInteger()', detail: 'Convert handle to integer', kind: 'function' },
  { label: 'Ext.Utils.IntegerToHandle', insertText: 'Ext.Utils.IntegerToHandle()', detail: 'Convert integer to handle', kind: 'function' },
  { label: 'Ext.Utils.IsValidHandle', insertText: 'Ext.Utils.IsValidHandle()', detail: 'Check if handle is valid', kind: 'function' },
];

const EXT_ENTITY: CompletionItem[] = [
  { label: 'Ext.Entity.Get', insertText: 'Ext.Entity.Get()', detail: 'Get entity by UUID/handle', kind: 'function' },
  { label: 'Ext.Entity.Subscribe', insertText: 'Ext.Entity.Subscribe("", function(entity, component) end)', detail: 'Subscribe to component changes', kind: 'function' },
  { label: 'Ext.Entity.Unsubscribe', insertText: 'Ext.Entity.Unsubscribe()', detail: 'Unsubscribe from entity events', kind: 'function' },
  { label: 'Ext.Entity.OnChange', insertText: 'Ext.Entity.OnChange("", function(entity, component) end)', detail: 'Subscribe to component updates', kind: 'function' },
  { label: 'Ext.Entity.OnCreate', insertText: 'Ext.Entity.OnCreate("", function(entity, component) end)', detail: 'Subscribe to component creation', kind: 'function' },
  { label: 'Ext.Entity.OnDestroy', insertText: 'Ext.Entity.OnDestroy("", function(entity, component) end)', detail: 'Subscribe to component destruction', kind: 'function' },
  { label: 'Ext.Entity.OnCreateDeferred', insertText: 'Ext.Entity.OnCreateDeferred("", function(entity, component) end)', detail: 'Deferred create subscription', kind: 'function' },
  { label: 'Ext.Entity.OnDestroyDeferred', insertText: 'Ext.Entity.OnDestroyDeferred("", function(entity, component) end)', detail: 'Deferred destroy subscription', kind: 'function' },
  { label: 'Ext.Entity.OnSystemUpdate', insertText: 'Ext.Entity.OnSystemUpdate("", function() end)', detail: 'Subscribe to ECS system tick', kind: 'function' },
];

const EXT_OSIRIS: CompletionItem[] = [
  { label: 'Ext.Osiris.RegisterListener', insertText: 'Ext.Osiris.RegisterListener("", 1, "after", function()\n\t\nend)', detail: 'Register Osiris event listener (name, arity, "before"|"after", handler)', kind: 'function' },
  { label: 'Ext.Osiris.NewCall', insertText: 'Ext.Osiris.NewCall("", "")', detail: 'Register new Osiris call', kind: 'function' },
  { label: 'Ext.Osiris.NewQuery', insertText: 'Ext.Osiris.NewQuery("", "")', detail: 'Register new Osiris query', kind: 'function' },
  { label: 'Ext.Osiris.NewEvent', insertText: 'Ext.Osiris.NewEvent("", 1)', detail: 'Register new Osiris event', kind: 'function' },
];

const EXT_EVENTS: CompletionItem[] = [
  { label: 'Ext.Events.SessionLoading:Subscribe', insertText: 'Ext.Events.SessionLoading:Subscribe(function(e)\n\t\nend)', detail: 'Session loading event (stats available)', kind: 'function' },
  { label: 'Ext.Events.SessionLoaded:Subscribe', insertText: 'Ext.Events.SessionLoaded:Subscribe(function(e)\n\t\nend)', detail: 'Session loaded event (safe for init)', kind: 'function' },
  { label: 'Ext.Events.StatsLoaded:Subscribe', insertText: 'Ext.Events.StatsLoaded:Subscribe(function(e)\n\t\nend)', detail: 'All stats finalized event', kind: 'function' },
  { label: 'Ext.Events.GameStateChanged:Subscribe', insertText: 'Ext.Events.GameStateChanged:Subscribe(function(e)\n\t_P("State: " .. e.FromState .. " -> " .. e.ToState)\nend)', detail: 'Game state change event', kind: 'function' },
  { label: 'Ext.Events.Tick:Subscribe', insertText: 'Ext.Events.Tick:Subscribe(function(e)\n\t\nend)', detail: 'Game tick event (~30hz)', kind: 'function' },
  { label: 'Ext.Events.ResetCompleted:Subscribe', insertText: 'Ext.Events.ResetCompleted:Subscribe(function(e)\n\t\nend)', detail: 'Lua state reset event', kind: 'function' },
  { label: 'Ext.Events.ModuleLoadStarted:Subscribe', insertText: 'Ext.Events.ModuleLoadStarted:Subscribe(function(e)\n\t\nend)', detail: 'Module load started (for path overrides)', kind: 'function' },
  { label: 'Ext.OnNextTick', insertText: 'Ext.OnNextTick(function()\n\t\nend)', detail: 'Run on next game tick (one-shot)', kind: 'function' },
];

const EXT_STATS: CompletionItem[] = [
  { label: 'Ext.Stats.Get', insertText: 'Ext.Stats.Get("")', detail: 'Get stats entry by name', kind: 'function' },
  { label: 'Ext.Stats.GetAll', insertText: 'Ext.Stats.GetAll("")', detail: 'Get all stats of a type (SpellData, StatusData, etc.)', kind: 'function' },
  { label: 'Ext.Stats.GetStats', insertText: 'Ext.Stats.GetStats("")', detail: 'Get stat names by type', kind: 'function' },
  { label: 'Ext.Stats.Create', insertText: 'Ext.Stats.Create("", "")', detail: 'Create new stats entry (name, type, [template])', kind: 'function' },
  { label: 'Ext.Stats.GetStatsLoadedBefore', insertText: 'Ext.Stats.GetStatsLoadedBefore("", "")', detail: 'Get stats loaded before a mod', kind: 'function' },
  { label: 'Ext.Stats.ExtraData', insertText: 'Ext.Stats.ExtraData', detail: 'Data.txt extra data entries', kind: 'property' },
];

const EXT_NET: CompletionItem[] = [
  { label: 'Ext.Net.CreateChannel', insertText: 'Ext.Net.CreateChannel(ModuleUUID, "")', detail: 'Create a named network channel', kind: 'function' },
  { label: 'Ext.Net.IsHost', insertText: 'Ext.Net.IsHost()', detail: 'Is current client the host?', kind: 'function' },
];

const EXT_IO: CompletionItem[] = [
  { label: 'Ext.IO.LoadFile', insertText: 'Ext.IO.LoadFile("")', detail: 'Read file content (nil if missing)', kind: 'function' },
  { label: 'Ext.IO.SaveFile', insertText: 'Ext.IO.SaveFile("", "")', detail: 'Write content to file', kind: 'function' },
  { label: 'Ext.IO.AddPathOverride', insertText: 'Ext.IO.AddPathOverride("", "")', detail: 'Redirect game file access', kind: 'function' },
  { label: 'Ext.IO.GetPathOverride', insertText: 'Ext.IO.GetPathOverride("")', detail: 'Get active path override', kind: 'function' },
];

const EXT_TIMER: CompletionItem[] = [
  { label: 'Ext.Timer.WaitFor', insertText: 'Ext.Timer.WaitFor(1000, function()\n\t\nend)', detail: 'Timer using game clock (pauses with game)', kind: 'function' },
  { label: 'Ext.Timer.WaitForRealtime', insertText: 'Ext.Timer.WaitForRealtime(1000, function()\n\t\nend)', detail: 'Timer using OS clock', kind: 'function' },
  { label: 'Ext.Timer.WaitForPersistent', insertText: 'Ext.Timer.WaitForPersistent(1000, "", function()\n\t\nend)', detail: 'Persistent timer (survives save/load)', kind: 'function' },
  { label: 'Ext.Timer.Cancel', insertText: 'Ext.Timer.Cancel()', detail: 'Cancel a timer by handle', kind: 'function' },
  { label: 'Ext.Timer.Pause', insertText: 'Ext.Timer.Pause()', detail: 'Pause a timer', kind: 'function' },
  { label: 'Ext.Timer.Resume', insertText: 'Ext.Timer.Resume()', detail: 'Resume a paused timer', kind: 'function' },
  { label: 'Ext.Timer.MonotonicTime', insertText: 'Ext.Timer.MonotonicTime()', detail: 'Monotonic system time (ms) for profiling', kind: 'function' },
];

const EXT_JSON: CompletionItem[] = [
  { label: 'Ext.Json.Parse', insertText: 'Ext.Json.Parse("")', detail: 'Parse JSON string to table', kind: 'function' },
  { label: 'Ext.Json.Stringify', insertText: 'Ext.Json.Stringify(, { Beautify = true })', detail: 'Serialize to JSON string', kind: 'function' },
];

const EXT_LOCA: CompletionItem[] = [
  { label: 'Ext.Loca.GetTranslatedString', insertText: 'Ext.Loca.GetTranslatedString("")', detail: 'Get localized text by handle', kind: 'function' },
  { label: 'Ext.Loca.UpdateTranslatedString', insertText: 'Ext.Loca.UpdateTranslatedString("", "")', detail: 'Override translated text at runtime', kind: 'function' },
];

const EXT_VARS: CompletionItem[] = [
  { label: 'Ext.Vars.RegisterUserVariable', insertText: 'Ext.Vars.RegisterUserVariable("", {\n\tServer = true,\n\tClient = true,\n\tSyncToClient = true\n})', detail: 'Register persistent user variable', kind: 'function' },
  { label: 'Ext.Vars.RegisterModVariable', insertText: 'Ext.Vars.RegisterModVariable(ModuleUUID, "", {\n\tServer = true,\n\tClient = true,\n\tSyncToClient = true\n})', detail: 'Register persistent mod variable', kind: 'function' },
  { label: 'Ext.Vars.GetModVariables', insertText: 'Ext.Vars.GetModVariables(ModuleUUID)', detail: 'Get all variables for a mod', kind: 'function' },
  { label: 'Ext.Vars.SyncUserVariables', insertText: 'Ext.Vars.SyncUserVariables()', detail: 'Immediate sync of user variable changes', kind: 'function' },
  { label: 'Ext.Vars.SyncModVariables', insertText: 'Ext.Vars.SyncModVariables()', detail: 'Immediate sync of mod variable changes', kind: 'function' },
];

const EXT_MOD: CompletionItem[] = [
  { label: 'Ext.Mod.IsModLoaded', insertText: 'Ext.Mod.IsModLoaded("")', detail: 'Check if mod UUID is loaded', kind: 'function' },
  { label: 'Ext.Mod.GetLoadOrder', insertText: 'Ext.Mod.GetLoadOrder()', detail: 'Get loaded module UUID list', kind: 'function' },
  { label: 'Ext.Mod.GetMod', insertText: 'Ext.Mod.GetMod("")', detail: 'Get detailed mod info by UUID', kind: 'function' },
  { label: 'Ext.Mod.GetModManager', insertText: 'Ext.Mod.GetModManager()', detail: 'Access engine ModManager', kind: 'function' },
];

const EXT_TEMPLATE: CompletionItem[] = [
  { label: 'Ext.Template.GetTemplate', insertText: 'Ext.Template.GetTemplate("")', detail: 'Get template by ID', kind: 'function' },
  { label: 'Ext.Template.GetRootTemplate', insertText: 'Ext.Template.GetRootTemplate("")', detail: 'Get root template by ID', kind: 'function' },
  { label: 'Ext.Template.GetAllRootTemplates', insertText: 'Ext.Template.GetAllRootTemplates()', detail: 'Get all root templates', kind: 'function' },
];

const EXT_STATIC_DATA: CompletionItem[] = [
  { label: 'Ext.StaticData.Get', insertText: 'Ext.StaticData.Get("", "")', detail: 'Get static resource by GUID and type', kind: 'function' },
  { label: 'Ext.StaticData.GetAll', insertText: 'Ext.StaticData.GetAll("")', detail: 'Get all GUIDs of a resource type', kind: 'function' },
];

const EXT_RESOURCE: CompletionItem[] = [
  { label: 'Ext.Resource.Get', insertText: 'Ext.Resource.Get("", "")', detail: 'Get resource by ID and bank type', kind: 'function' },
  { label: 'Ext.Resource.GetAll', insertText: 'Ext.Resource.GetAll("")', detail: 'Get all resources of a bank type', kind: 'function' },
];

const EXT_UI: CompletionItem[] = [
  { label: 'Ext.UI.RegisterType', insertText: 'Ext.UI.RegisterType("", {})', detail: 'Register a Noesis ViewModel type', kind: 'function' },
  { label: 'Ext.UI.Instantiate', insertText: 'Ext.UI.Instantiate("")', detail: 'Instantiate a ViewModel', kind: 'function' },
  { label: 'Ext.UI.GetRoot', insertText: 'Ext.UI.GetRoot()', detail: 'Get root UI element', kind: 'function' },
  { label: 'Ext.UI.GetPickingHelper', insertText: 'Ext.UI.GetPickingHelper()', detail: 'Get cursor picking helper', kind: 'function' },
];

const EXT_IMGUI: CompletionItem[] = [
  { label: 'Ext.IMGUI.NewWindow', insertText: 'Ext.IMGUI.NewWindow("")', detail: 'Create new IMGUI window', kind: 'function' },
];

const EXT_ENUMS: CompletionItem[] = [
  { label: 'Ext.Enums', insertText: 'Ext.Enums.', detail: 'Access game enumerations', kind: 'module' },
];

const EXT_MATH: CompletionItem[] = [
  { label: 'Ext.Math.Add', insertText: 'Ext.Math.Add()', detail: 'Add vec/mat operands', kind: 'function' },
  { label: 'Ext.Math.Sub', insertText: 'Ext.Math.Sub()', detail: 'Subtract vec/mat operands', kind: 'function' },
  { label: 'Ext.Math.Mul', insertText: 'Ext.Math.Mul()', detail: 'Multiply vec/mat operands', kind: 'function' },
  { label: 'Ext.Math.Distance', insertText: 'Ext.Math.Distance()', detail: 'Distance between points', kind: 'function' },
  { label: 'Ext.Math.Dot', insertText: 'Ext.Math.Dot()', detail: 'Dot product', kind: 'function' },
  { label: 'Ext.Math.Cross', insertText: 'Ext.Math.Cross()', detail: 'Cross product', kind: 'function' },
  { label: 'Ext.Math.Normalize', insertText: 'Ext.Math.Normalize()', detail: 'Normalize vector', kind: 'function' },
  { label: 'Ext.Math.Lerp', insertText: 'Ext.Math.Lerp()', detail: 'Linear interpolation', kind: 'function' },
];

const EXT_AUDIO: CompletionItem[] = [
  { label: 'Ext.Audio.PostEvent', insertText: 'Ext.Audio.PostEvent()', detail: 'Post audio event', kind: 'function' },
  { label: 'Ext.Audio.SetSwitch', insertText: 'Ext.Audio.SetSwitch()', detail: 'Set audio switch', kind: 'function' },
  { label: 'Ext.Audio.SetState', insertText: 'Ext.Audio.SetState()', detail: 'Set audio state', kind: 'function' },
  { label: 'Ext.Audio.LoadBank', insertText: 'Ext.Audio.LoadBank("")', detail: 'Load sound bank', kind: 'function' },
];

const EXT_LEVEL: CompletionItem[] = [
  { label: 'Ext.Level.RaycastClosest', insertText: 'Ext.Level.RaycastClosest()', detail: 'Raycast for closest hit', kind: 'function' },
  { label: 'Ext.Level.RaycastAll', insertText: 'Ext.Level.RaycastAll()', detail: 'Raycast for all hits', kind: 'function' },
  { label: 'Ext.Level.GetHeightsAt', insertText: 'Ext.Level.GetHeightsAt()', detail: 'Get heights at position', kind: 'function' },
];

const EXT_TYPES: CompletionItem[] = [
  { label: 'Ext.Types.Serialize', insertText: 'Ext.Types.Serialize()', detail: 'Serialize an engine object', kind: 'function' },
  { label: 'Ext.Types.Unserialize', insertText: 'Ext.Types.Unserialize()', detail: 'Unserialize an engine object', kind: 'function' },
];

// Helper/aliased functions
const EXT_HELPERS: CompletionItem[] = [
  { label: '_P', insertText: '_P()', detail: 'Print (shorthand for Ext.Utils.Print)', kind: 'function' },
  { label: '_D', insertText: '_D()', detail: 'Dump (shorthand for Ext.Dump)', kind: 'function' },
  { label: '_C', insertText: '_C()', detail: 'Get host character entity (shorthand)', kind: 'function' },
];

const ALL_EXT = [
  ...EXT_CORE, ...EXT_UTILS, ...EXT_ENTITY, ...EXT_OSIRIS, ...EXT_EVENTS,
  ...EXT_STATS, ...EXT_NET, ...EXT_IO, ...EXT_TIMER, ...EXT_JSON,
  ...EXT_LOCA, ...EXT_VARS, ...EXT_MOD, ...EXT_TEMPLATE, ...EXT_STATIC_DATA,
  ...EXT_RESOURCE, ...EXT_UI, ...EXT_IMGUI, ...EXT_ENUMS, ...EXT_MATH,
  ...EXT_AUDIO, ...EXT_LEVEL, ...EXT_TYPES, ...EXT_HELPERS,
];

// ── Osi.* completions ──

const OSI_COMMON: CompletionItem[] = [
  // All Osi calls are server-side only
  { label: 'Osi.GetHostCharacter', insertText: 'Osi.GetHostCharacter()', detail: '[S] Get host character GUID', kind: 'function' },
  { label: 'Osi.GetPosition', insertText: 'Osi.GetPosition()', detail: '[S] Get x,y,z of entity', kind: 'function' },
  { label: 'Osi.ApplyStatus', insertText: 'Osi.ApplyStatus(target, "", duration, causee)', detail: '[S] Apply status to entity', kind: 'function' },
  { label: 'Osi.RemoveStatus', insertText: 'Osi.RemoveStatus(target, "")', detail: '[S] Remove status from entity', kind: 'function' },
  { label: 'Osi.CharacterResetCooldowns', insertText: 'Osi.CharacterResetCooldowns()', detail: '[S] Reset all cooldowns', kind: 'function' },
  { label: 'Osi.TeleportTo', insertText: 'Osi.TeleportTo(source, target)', detail: '[S] Teleport entity', kind: 'function' },
  { label: 'Osi.StoryEvent', insertText: 'Osi.StoryEvent(entity, "")', detail: '[S] Trigger story event', kind: 'function' },
  { label: 'Osi.CharacterGetLevel', insertText: 'Osi.CharacterGetLevel()', detail: '[S] Get character level', kind: 'function' },
  { label: 'Osi.IsInCombat', insertText: 'Osi.IsInCombat()', detail: '[S] Check if in combat', kind: 'function' },
  { label: 'Osi.IsTagged', insertText: 'Osi.IsTagged(entity, "")', detail: '[S] Check if entity has tag', kind: 'function' },
  { label: 'Osi.SetTag', insertText: 'Osi.SetTag(entity, "")', detail: '[S] Set tag on entity', kind: 'function' },
  { label: 'Osi.ClearTag', insertText: 'Osi.ClearTag(entity, "")', detail: '[S] Clear tag from entity', kind: 'function' },
  { label: 'Osi.TemplateAddTo', insertText: 'Osi.TemplateAddTo("", entity, 1)', detail: '[S] Add item template to inventory', kind: 'function' },
  { label: 'Osi.ItemGetOwner', insertText: 'Osi.ItemGetOwner()', detail: '[S] Get item owner', kind: 'function' },
  { label: 'Osi.AddGold', insertText: 'Osi.AddGold(entity, amount)', detail: '[S] Add gold to entity', kind: 'function' },
  { label: 'Osi.SetFaction', insertText: 'Osi.SetFaction(entity, "")', detail: '[S] Set entity faction', kind: 'function' },
  { label: 'Osi.CharacterAddAbility', insertText: 'Osi.CharacterAddAbility(entity, "", 1)', detail: '[S] Add ability score', kind: 'function' },
  { label: 'Osi.AddExplorationExperience', insertText: 'Osi.AddExplorationExperience(entity, amount)', detail: '[S] Add exploration XP', kind: 'function' },
  { label: 'Osi.CreateItemTemplateAtPosition', insertText: 'Osi.CreateItemTemplateAtPosition("", x, y, z)', detail: '[S] Spawn item at position', kind: 'function' },
  { label: 'Osi.PROC_CharacterFullRestore', insertText: 'Osi.PROC_CharacterFullRestore()', detail: '[S] Full restore (PROC)', kind: 'function' },
  // Database operations
  { label: 'Osi.DB_Players', insertText: 'Osi.DB_Players', detail: '[S] Players database', kind: 'property' },
];

// ── Osiris event names (for RegisterListener) ──
const OSIRIS_EVENTS: CompletionItem[] = [
  { label: 'EnteredCombat', insertText: '"EnteredCombat"', detail: 'Entity entered combat', kind: 'variable' },
  { label: 'LeftCombat', insertText: '"LeftCombat"', detail: 'Entity left combat', kind: 'variable' },
  { label: 'TurnStarted', insertText: '"TurnStarted"', detail: 'Combat turn started', kind: 'variable' },
  { label: 'TurnEnded', insertText: '"TurnEnded"', detail: 'Combat turn ended', kind: 'variable' },
  { label: 'Died', insertText: '"Died"', detail: 'Entity died', kind: 'variable' },
  { label: 'KilledBy', insertText: '"KilledBy"', detail: 'Entity killed by another', kind: 'variable' },
  { label: 'CastedSpell', insertText: '"CastedSpell"', detail: 'Spell cast event', kind: 'variable' },
  { label: 'StatusApplied', insertText: '"StatusApplied"', detail: 'Status applied to entity', kind: 'variable' },
  { label: 'StatusRemoved', insertText: '"StatusRemoved"', detail: 'Status removed from entity', kind: 'variable' },
  { label: 'DialogStarted', insertText: '"DialogStarted"', detail: 'Dialog started', kind: 'variable' },
  { label: 'DialogEnded', insertText: '"DialogEnded"', detail: 'Dialog ended', kind: 'variable' },
  { label: 'FlagSet', insertText: '"FlagSet"', detail: 'Global/dialog flag set', kind: 'variable' },
  { label: 'FlagCleared', insertText: '"FlagCleared"', detail: 'Global/dialog flag cleared', kind: 'variable' },
  { label: 'CharacterJoinedParty', insertText: '"CharacterJoinedParty"', detail: 'Character joined party', kind: 'variable' },
  { label: 'CharacterLeftParty', insertText: '"CharacterLeftParty"', detail: 'Character left party', kind: 'variable' },
  { label: 'LeveledUp', insertText: '"LeveledUp"', detail: 'Character leveled up', kind: 'variable' },
  { label: 'Equipped', insertText: '"Equipped"', detail: 'Item equipped', kind: 'variable' },
  { label: 'Unequipped', insertText: '"Unequipped"', detail: 'Item unequipped', kind: 'variable' },
  { label: 'LongRestStarted', insertText: '"LongRestStarted"', detail: 'Long rest started', kind: 'variable' },
  { label: 'LongRestFinished', insertText: '"LongRestFinished"', detail: 'Long rest finished', kind: 'variable' },
  { label: 'ShortRested', insertText: '"ShortRested"', detail: 'Short rest completed', kind: 'variable' },
  { label: 'LevelGameplayStarted', insertText: '"LevelGameplayStarted"', detail: 'Level gameplay started', kind: 'variable' },
  { label: 'EnteredTrigger', insertText: '"EnteredTrigger"', detail: 'Entity entered trigger', kind: 'variable' },
  { label: 'SavegameLoaded', insertText: '"SavegameLoaded"', detail: 'Savegame loaded', kind: 'variable' },
];

// Special: ModuleUUID global
const SPECIAL_GLOBALS: CompletionItem[] = [
  { label: 'ModuleUUID', insertText: 'ModuleUUID', detail: 'Current mod UUID (auto-set by SE)', kind: 'variable' },
  { label: 'Mods', insertText: 'Mods', detail: 'Global mod table', kind: 'module' },
];

const ALL_SE = [...ALL_EXT, ...OSI_COMMON, ...SPECIAL_GLOBALS, ...EXT_HELPERS];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const seApiPlugin: CompletionPlugin = {
  id: 'bg3-script-extender',
  name: 'BG3 Script Extender API',
  languages: ['lua'],
  priority: 50, // Higher priority than stdlib
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix) return [];

    // Ext.* completions
    if (prefix.startsWith('Ext.')) return filterByPrefix(ALL_EXT, prefix);

    // Osi.* completions
    if (prefix.startsWith('Osi.')) return filterByPrefix(OSI_COMMON, prefix);

    // Inside RegisterListener string — suggest event names
    const line = ctx.lineTextBeforeCursor;
    if (line.includes('RegisterListener(') && (line.endsWith('"') || line.endsWith("'"))) {
      return OSIRIS_EVENTS;
    }

    // Global helpers (_P, _D, _C, ModuleUUID)
    if (prefix.startsWith('_') || prefix.startsWith('Mo')) {
      return filterByPrefix([...EXT_HELPERS, ...SPECIAL_GLOBALS], prefix);
    }

    // General: check if it might be an Ext or Osi prefix
    if (prefix.length >= 2) {
      return filterByPrefix(ALL_SE, prefix);
    }

    return [];
  },
};
