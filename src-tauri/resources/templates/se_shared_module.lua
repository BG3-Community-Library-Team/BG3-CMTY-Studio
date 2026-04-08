-- {{FILE_NAME}}
-- Shared module for {{MOD_NAME}}
-- This runs in both server and client contexts.
-- Avoid context-specific APIs (Osi.*, Ext.IMGUI) here.

local Module = {}

function Module.Init()
    Ext.Utils.Print("[{{MOD_NAME}}] Shared module initialized")
end

return Module
