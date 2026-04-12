import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const SECTION_KEYWORDS: CompletionItem[] = [
  { label: 'Version', insertText: 'Version', detail: 'Version declaration', kind: 'keyword' },
  { label: 'SubGoalCombiner', insertText: 'SubGoalCombiner', detail: 'SubGoal combiner', kind: 'keyword' },
  { label: 'SGC_AND', insertText: 'SGC_AND', detail: 'SubGoal combiner AND', kind: 'keyword' },
  { label: 'INITSECTION', insertText: 'INITSECTION', detail: 'Init section', kind: 'keyword' },
  { label: 'KBSECTION', insertText: 'KBSECTION', detail: 'Knowledge base section', kind: 'keyword' },
  { label: 'EXITSECTION', insertText: 'EXITSECTION', detail: 'Exit section', kind: 'keyword' },
  { label: 'ENDEXITSECTION', insertText: 'ENDEXITSECTION', detail: 'End exit section', kind: 'keyword' },
  { label: 'ParentTargetEdge', insertText: 'ParentTargetEdge', detail: 'Parent target edge', kind: 'keyword' },
];

const RULE_KEYWORDS: CompletionItem[] = [
  { label: 'IF', insertText: 'IF', detail: 'Rule condition', kind: 'keyword' },
  { label: 'THEN', insertText: 'THEN', detail: 'Rule action', kind: 'keyword' },
  { label: 'AND', insertText: 'AND', detail: 'Additional condition', kind: 'keyword' },
  { label: 'NOT', insertText: 'NOT', detail: 'Negate condition', kind: 'keyword' },
  { label: 'PROC', insertText: 'PROC', detail: 'Procedure definition', kind: 'keyword' },
  { label: 'QRY', insertText: 'QRY', detail: 'Query definition', kind: 'keyword' },
];

const TYPE_CASTS: CompletionItem[] = [
  { label: 'INTEGER', insertText: 'INTEGER', detail: 'Type cast', kind: 'keyword' },
  { label: 'INTEGER64', insertText: 'INTEGER64', detail: 'Type cast', kind: 'keyword' },
  { label: 'REAL', insertText: 'REAL', detail: 'Type cast', kind: 'keyword' },
  { label: 'STRING', insertText: 'STRING', detail: 'Type cast', kind: 'keyword' },
  { label: 'GUIDSTRING', insertText: 'GUIDSTRING', detail: 'Type cast', kind: 'keyword' },
  { label: 'CHARACTERGUID', insertText: 'CHARACTERGUID', detail: 'Type cast', kind: 'keyword' },
  { label: 'ITEMGUID', insertText: 'ITEMGUID', detail: 'Type cast', kind: 'keyword' },
  { label: 'TRIGGERGUID', insertText: 'TRIGGERGUID', detail: 'Type cast', kind: 'keyword' },
  { label: 'CHARACTER', insertText: 'CHARACTER', detail: 'Type cast', kind: 'keyword' },
  { label: 'ITEM', insertText: 'ITEM', detail: 'Type cast', kind: 'keyword' },
  { label: 'TRIGGER', insertText: 'TRIGGER', detail: 'Type cast', kind: 'keyword' },
  { label: 'SPLINE', insertText: 'SPLINE', detail: 'Type cast', kind: 'keyword' },
  { label: 'LEVELTEMPLATE', insertText: 'LEVELTEMPLATE', detail: 'Type cast', kind: 'keyword' },
  { label: 'SPLINEGUID', insertText: 'SPLINEGUID', detail: 'Type cast', kind: 'keyword' },
  { label: 'LEVELTEMPLATEGUID', insertText: 'LEVELTEMPLATEGUID', detail: 'Type cast', kind: 'keyword' },
];

const DB_OPERATIONS: CompletionItem[] = [
  { label: 'DB_IsPlayer', insertText: 'DB_IsPlayer', detail: 'Player database', kind: 'function' },
  { label: 'DB_DialogStarted', insertText: 'DB_DialogStarted', detail: 'Dialog started DB', kind: 'function' },
  { label: 'DB_Players', insertText: 'DB_Players', detail: 'Players database', kind: 'function' },
  { label: 'DB_Origins', insertText: 'DB_Origins', detail: 'Origins database', kind: 'function' },
  { label: 'DB_Avatars', insertText: 'DB_Avatars', detail: 'Avatars database', kind: 'function' },
  { label: 'DB_PartySizeChanged', insertText: 'DB_PartySizeChanged', detail: 'Party size DB', kind: 'function' },
  { label: 'DB_InCombat', insertText: 'DB_InCombat', detail: 'In combat database', kind: 'function' },
  { label: 'DB_CombatStarted', insertText: 'DB_CombatStarted', detail: 'Combat started DB', kind: 'function' },
  { label: 'DB_Dialogs', insertText: 'DB_Dialogs', detail: 'Dialogs database', kind: 'function' },
  { label: 'DB_Dead', insertText: 'DB_Dead', detail: 'Dead characters DB', kind: 'function' },
  { label: 'PROC_CheckParty', insertText: 'PROC_CheckParty', detail: 'Check party procedure', kind: 'function' },
  { label: 'PROC_StartDialog', insertText: 'PROC_StartDialog', detail: 'Start dialog procedure', kind: 'function' },
  { label: 'PROC_StopDialog', insertText: 'PROC_StopDialog', detail: 'Stop dialog procedure', kind: 'function' },
  { label: 'PROC_GiveReward', insertText: 'PROC_GiveReward', detail: 'Give reward procedure', kind: 'function' },
  { label: 'PROC_RemoveAllDialogs', insertText: 'PROC_RemoveAllDialogs', detail: 'Remove all dialogs procedure', kind: 'function' },
  { label: 'QRY_IsTagged', insertText: 'QRY_IsTagged', detail: 'Is tagged query', kind: 'function' },
  { label: 'QRY_InParty', insertText: 'QRY_InParty', detail: 'In party query', kind: 'function' },
  { label: 'QRY_IsDead', insertText: 'QRY_IsDead', detail: 'Is dead query', kind: 'function' },
  { label: 'QRY_SpeakerIsAvailable', insertText: 'QRY_SpeakerIsAvailable', detail: 'Speaker available query', kind: 'function' },
  { label: 'QRY_HasItem', insertText: 'QRY_HasItem', detail: 'Has item query', kind: 'function' },
];

const OSIRIS_API: CompletionItem[] = [
  { label: 'CharacterGetHostCharacter', insertText: 'CharacterGetHostCharacter()', detail: 'Osiris API', kind: 'function' },
  { label: 'GetPosition', insertText: 'GetPosition()', detail: 'Osiris API', kind: 'function' },
  { label: 'GetRegion', insertText: 'GetRegion()', detail: 'Osiris API', kind: 'function' },
  { label: 'ApplyStatus', insertText: 'ApplyStatus()', detail: 'Osiris API', kind: 'function' },
  { label: 'RemoveStatus', insertText: 'RemoveStatus()', detail: 'Osiris API', kind: 'function' },
  { label: 'TeleportToPosition', insertText: 'TeleportToPosition()', detail: 'Osiris API', kind: 'function' },
  { label: 'TeleportTo', insertText: 'TeleportTo()', detail: 'Osiris API', kind: 'function' },
  { label: 'CreateItemAtPosition', insertText: 'CreateItemAtPosition()', detail: 'Osiris API', kind: 'function' },
  { label: 'ItemToInventory', insertText: 'ItemToInventory()', detail: 'Osiris API', kind: 'function' },
  { label: 'SetTag', insertText: 'SetTag()', detail: 'Osiris API', kind: 'function' },
  { label: 'ClearTag', insertText: 'ClearTag()', detail: 'Osiris API', kind: 'function' },
  { label: 'IsTagged', insertText: 'IsTagged()', detail: 'Osiris API', kind: 'function' },
  { label: 'CharacterResetCooldowns', insertText: 'CharacterResetCooldowns()', detail: 'Osiris API', kind: 'function' },
  { label: 'PlaySound', insertText: 'PlaySound()', detail: 'Osiris API', kind: 'function' },
  { label: 'ShowNotification', insertText: 'ShowNotification()', detail: 'Osiris API', kind: 'function' },
  { label: 'OpenMessageBox', insertText: 'OpenMessageBox()', detail: 'Osiris API', kind: 'function' },
  { label: 'GameEnd', insertText: 'GameEnd()', detail: 'Osiris API', kind: 'function' },
  { label: 'ProcObjectTimer', insertText: 'ProcObjectTimer()', detail: 'Osiris API', kind: 'function' },
  { label: 'ProcObjectTimerCancel', insertText: 'ProcObjectTimerCancel()', detail: 'Osiris API', kind: 'function' },
  { label: 'GetDistanceTo', insertText: 'GetDistanceTo()', detail: 'Osiris API', kind: 'function' },
];

const ALL_ITEMS = [...SECTION_KEYWORDS, ...RULE_KEYWORDS, ...TYPE_CASTS, ...DB_OPERATIONS, ...OSIRIS_API];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const osirisPlugin: CompletionPlugin = {
  id: 'bg3-osiris',
  name: 'BG3 Osiris',
  languages: ['osiris'],
  priority: 50,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];
    return filterByPrefix(ALL_ITEMS, prefix);
  },
};
