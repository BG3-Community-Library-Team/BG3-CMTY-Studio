-- BootstrapServer.lua
-- Script Extender server bootstrap for {{MOD_NAME}}
-- This file is loaded first in the SERVER context.
-- Register event listeners, Osiris callbacks, and server-side logic here.
-- Do NOT call Osi functions at the top level — use Ext.Osiris.RegisterListener instead.

Ext.Vars.RegisterModVariable(
    ModuleUUID,
    "{{VAR_NAME}}",
    {
        Server = true,
        Client = true,
        SyncToClient = true,
    }
)

Ext.Utils.Print("[{{MOD_NAME}}] Server bootstrap loaded")
