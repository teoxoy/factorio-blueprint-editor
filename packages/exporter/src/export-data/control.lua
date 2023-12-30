script.on_init(function()
    -- EXTRACT SERIALIZED DATA
    local l = tonumber(game.entity_prototypes["FBE-DATA-COUNT"].localised_name)
    local serialized = ""
    for i = 1, l, 1 do
        serialized = serialized .. game.entity_prototypes["FBE-DATA-" .. tostring(i)].localised_name
    end
    local data = load(serialized)()
    game.write_file('data.json', game.table_to_json(data), false, 0)
    error("!EXIT!")
end)
