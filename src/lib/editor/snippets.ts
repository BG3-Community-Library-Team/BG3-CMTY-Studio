import type { CompletionPlugin, CompletionContext, CompletionItem } from '../plugins/completionTypes.js';

interface SnippetDef {
  label: string;
  detail: string;
  body: string;
  keywords?: string[];
}

const OSIRIS_SNIPPETS: SnippetDef[] = [
  {
    label: "osiris-goal",
    detail: "New Goal File Skeleton",
    body: "Version 1\nSubGoalCombiner SGC_AND\n\nINITSECTION\n${1}\n\nKBSECTION\n${2}\n\nEXITSECTION\n${3}\nENDEXITSECTION\n\nParentTargetEdge \"${4:ParentGoalName}\"",
  },
  {
    label: "osiris-rule",
    detail: "IF/THEN Rule",
    body: "IF\n${1:Condition}\nTHEN\n${2:Action};",
  },
  {
    label: "osiris-proc",
    detail: "Procedure Definition",
    body: "PROC\n${1:ProcName}(${2:params})\nTHEN\n${3:body};",
  },
  {
    label: "osiris-qry",
    detail: "Query Definition",
    body: "QRY\n${1:QryName}(${2:params})\nAND\n${3:condition}\nTHEN\n${4:body};",
  },
  {
    label: "osiris-state-machine",
    detail: "State Machine Pattern",
    body: "PROC\nPROC_${1:MachineName}_SetState((GUIDSTRING)_Char, (STRING)_State)\nAND\nDB_${1:MachineName}_State(_Char, _OldState)\nTHEN\nNOT DB_${1:MachineName}_State(_Char, _OldState);\nDB_${1:MachineName}_State(_Char, _State);",
  },
  {
    label: "osiris-db-config",
    detail: "DB-Driven Configuration",
    body: "// INITSECTION config\nDB_${1:ConfigName}(\"${2:key}\", ${3:value});",
  },
  {
    label: "osiris-once",
    detail: "One-Time Execution",
    body: "IF\n${1:Trigger}\nAND\nNOT DB_${2:GuardName}(1)\nTHEN\nDB_${2:GuardName}(1);\n${3:action};",
  },
];

const LUA_SE_SNIPPETS: SnippetDef[] = [
  {
    label: "se-bootstrap-server",
    detail: "Server Bootstrap",
    body: "Ext.Require(\"Server/${1:ModuleName}.lua\")",
  },
  {
    label: "se-bootstrap-client",
    detail: "Client Bootstrap",
    body: "Ext.Require(\"Client/${1:ModuleName}.lua\")",
  },
  {
    label: "se-config",
    detail: "Config.json Skeleton",
    body: "{\n\t\"RequiredVersion\": ${1:1},\n\t\"ModTable\": \"${2:ModName}\",\n\t\"FeatureFlags\": [\"Lua\"]\n}",
  },
  {
    label: "se-event-listener",
    detail: "Osiris Event Listener",
    body: "Ext.Osiris.RegisterListener(\"${1:EventName}\", ${2:arity}, \"${3:after}\", function(${4:params})\n\t${5:-- handler body}\nend)",
  },
  {
    label: "se-session-loaded",
    detail: "Session Loaded Handler",
    body: "Ext.Events.SessionLoaded:Subscribe(function()\n\t${1:-- initialization code}\nend)",
  },
  {
    label: "se-net-server",
    detail: "Net Message Server Handler",
    body: "Ext.RegisterNetListener(\"${1:Channel}\", function(channel, payload, peerId)\n\t${2:-- handle message}\nend)",
  },
  {
    label: "se-net-client",
    detail: "Net Message Client→Server",
    body: "Ext.Net.PostMessageToServer(\"${1:Channel}\", Ext.Json.Stringify({\n\t${2:key = value}\n}))",
  },
  {
    label: "se-stats-override",
    detail: "Stats Override Pattern",
    body: "Ext.Events.StatsLoaded:Subscribe(function()\n\tlocal stat = Ext.Stats.Get(\"${1:StatName}\")\n\tstat.${2:Field} = ${3:value}\n\tstat:Sync()\nend)",
  },
  {
    label: "se-timer",
    detail: "Timer",
    body: "Ext.Timer.WaitFor(${1:1000}, function()\n\t${2:-- timer callback}\nend)",
  },
  {
    label: "se-entity-query",
    detail: "Entity Component Query",
    body: "for _, entity in ipairs(Ext.Entity.GetAllEntitiesWithComponent(\"${1:ComponentName}\")) do\n\tlocal ${2:comp} = entity.${1:ComponentName}\n\t${3:-- process entity}\nend",
  },
];

const KHONSU_SNIPPETS: SnippetDef[] = [
  {
    label: "khn-condition",
    detail: "Basic Condition Script",
    body: "IF\n${1:HasPassive('${2:PassiveName}')}\nTHEN\nConditionResult(true)",
  },
  {
    label: "khn-condition-entity",
    detail: "Entity-Based Condition",
    body: "IF\ncontext.Source and ${1:Tagged('${2:TagName}')}\nTHEN\nConditionResult(true)",
  },
  {
    label: "khn-condition-hit",
    detail: "Hit-Based Condition",
    body: "IF\ncontext.HitDescription and context.HitDescription.${1:IsCriticalHit}\nTHEN\nConditionResult(true)",
  },
];

const STATS_SNIPPETS: SnippetDef[] = [
  {
    label: "stats-spell",
    detail: "New Spell Entry",
    body: "new entry \"${1:SpellName}\"\ntype \"SpellData\"\ndata \"SpellType\" \"${2:Target}\"\ndata \"SpellProperties\" \"${3}\"\ndata \"TargetConditions\" \"${4}\"\ndata \"Icon\" \"${5}\"",
  },
  {
    label: "stats-passive",
    detail: "New Passive Entry",
    body: "new entry \"${1:PassiveName}\"\ntype \"PassiveData\"\ndata \"DisplayName\" \"${2:h00000000-0000-0000-0000-000000000000;1}\"\ndata \"Description\" \"${3:h00000000-0000-0000-0000-000000000000;1}\"\ndata \"Boosts\" \"${4}\"",
  },
  {
    label: "stats-status",
    detail: "New Status Entry",
    body: "new entry \"${1:StatusName}\"\ntype \"StatusData\"\ndata \"StatusType\" \"${2:BOOST}\"\ndata \"DisplayName\" \"${3:h00000000-0000-0000-0000-000000000000;1}\"\ndata \"StackId\" \"${4:${1:StatusName}}\"",
  },
  {
    label: "stats-armor",
    detail: "New Armor Entry",
    body: "new entry \"${1:ArmorName}\"\ntype \"Armor\"\nusing \"${2:ARM_Leather}\"\ndata \"Slot\" \"${3:Breast}\"\ndata \"ArmorClass\" \"${4:10}\"",
  },
  {
    label: "stats-weapon",
    detail: "New Weapon Entry",
    body: "new entry \"${1:WeaponName}\"\ntype \"Weapon\"\nusing \"${2:WPN_Longsword}\"\ndata \"Damage\" \"${3:1d8}\"\ndata \"DamageType\" \"${4:Slashing}\"",
  },
];

const ANUBIS_SNIPPETS: SnippetDef[] = [
  {
    label: "anubis-config",
    detail: "Config File (.anc)",
    body: "local config = Config()\nconfig:SetName(\"${1:ModName}\")\nconfig:SetVersion(\"${2:1.0.0}\")\n\n${3}\n\nreturn config",
  },
  {
    label: "anubis-state",
    detail: "State Definition (.ann)",
    body: "local state = State()\nstate:SetName(\"${1:StateName}\")\n\nstate:OnEnter(function(context)\n\t${2:-- enter logic}\nend)\n\nstate:OnExit(function(context)\n\t${3:-- exit logic}\nend)\n\nreturn state",
  },
  {
    label: "anubis-module",
    detail: "Module File (.anm)",
    body: "local module = AnubisModule()\nmodule:SetName(\"${1:ModuleName}\")\n\nmodule:OnInit(function()\n\t${2:-- initialization}\nend)\n\nreturn module",
  },
];

const CONSTELLATIONS_SNIPPETS: SnippetDef[] = [
  {
    label: "cl-config",
    detail: "Constellations Config (.clc)",
    body: "local config = Config()\nconfig:SetName(\"${1:ModName}\")\nconfig:AddParam(\"${2:ParamName}\", EParamType.${3:String}, ${4:defaultValue})\n\nreturn config",
  },
];

const MCM_SNIPPETS: SnippetDef[] = [
  {
    label: "mcm-blueprint",
    detail: "MCM Blueprint JSON Skeleton",
    body: "{\n\t\"SchemaVersion\": 1,\n\t\"ModName\": \"${1:ModName}\",\n\t\"Tabs\": [\n\t\t{\n\t\t\t\"TabName\": \"${2:General}\",\n\t\t\t\"Sections\": [\n\t\t\t\t{\n\t\t\t\t\t\"SectionName\": \"${3:Settings}\",\n\t\t\t\t\t\"Settings\": [\n\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\"Id\": \"${4:setting_id}\",\n\t\t\t\t\t\t\t\"Name\": \"${5:Setting Name}\",\n\t\t\t\t\t\t\t\"Type\": \"${6:checkbox}\",\n\t\t\t\t\t\t\t\"Default\": ${7:true}\n\t\t\t\t\t\t}\n\t\t\t\t\t]\n\t\t\t\t}\n\t\t\t]\n\t\t}\n\t]\n}",
  },
];

const LANGUAGE_SNIPPETS: Record<string, SnippetDef[]> = {
  osiris: OSIRIS_SNIPPETS,
  lua: LUA_SE_SNIPPETS,
  khn: KHONSU_SNIPPETS,
  stats: STATS_SNIPPETS,
  anubis: ANUBIS_SNIPPETS,
  constellations: CONSTELLATIONS_SNIPPETS,
  json: MCM_SNIPPETS,
};

function matchesPrefix(def: SnippetDef, prefix: string): boolean {
  const lowerPrefix = prefix.toLowerCase();
  if (def.label.toLowerCase().startsWith(lowerPrefix)) return true;
  if (def.keywords) {
    return def.keywords.some((kw) => kw.toLowerCase().startsWith(lowerPrefix));
  }
  return false;
}

export const snippetPlugin: CompletionPlugin = {
  id: 'bg3-snippets',
  name: 'BG3 Snippets',
  languages: ['osiris', 'lua', 'khn', 'anubis', 'constellations', 'stats', 'json'],
  priority: 150,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (prefix.length < 2) return [];

    const defs = LANGUAGE_SNIPPETS[ctx.language];
    if (!defs) return [];

    return defs
      .filter((def) => matchesPrefix(def, prefix))
      .map((def) => ({
        label: def.label,
        insertText: def.body,
        detail: def.detail,
        kind: 'snippet' as const,
        sortOrder: 150,
        source: 'bg3-snippets',
      }));
  },
};
