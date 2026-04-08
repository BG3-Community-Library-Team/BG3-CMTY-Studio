-- {{FILE_NAME}}
-- Client-side module for {{MOD_NAME}}
-- This runs in the client context.
-- Ext.Entity and Ext.IMGUI are available here.

local Module = {}

function Module.Init()
    Ext.Utils.Print("[{{MOD_NAME}}] Client module initialized")
end

return Module
