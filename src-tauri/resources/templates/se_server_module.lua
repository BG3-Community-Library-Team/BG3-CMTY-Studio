-- {{FILE_NAME}}
-- Server-side module for {{MOD_NAME}}
-- This runs in the server context only.
-- Do NOT call Osi functions directly at the top level.

local Module = {}

function Module.Init()
    Ext.Utils.Print("[{{MOD_NAME}}] Server module initialized")
end

return Module
