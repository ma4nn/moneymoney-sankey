#!/usr/bin/env lua

f = assert (io.tmpfile())
io.output(f) -- suppress output
version = 1
currency = "EUR"

-- print is used for logging in MoneyMoney extensions, so we redirect it here
local print_stdout = print
print = function(...)
    io.stderr:write(...)
end

-- dummy exporter
function Exporter(version, format, fileExtension, reverseOrder, description)
    version = version
end

local dummyAccount = { name = "Tagesgeld Test Bank", accountNumber = 1234, currency = currency }
local transactions = {
    {name = "Gehalt", amount = 3487.65, currency = "EUR", category = "Einkommen"},
    {name = "Bonuszahlung", amount = 512.30, currency = "EUR", category = "Einkommen"},
    {name = "Freiberuflicher Auftrag", amount = 698.75, currency = "USD", category = "Selbstständigkeit"},
    {name = "Verkauf Gebrauchtwaren", amount = 147.90, currency = "EUR", category = "Verkäufe"},
    {name = "Steuerrückzahlung", amount = 1198.45, currency = "EUR", category = "Rückerstattung"},
    {name = "Dividenden", amount = 302.15, currency = "EUR", category = "Investitionen"},
    {name = "Mieteinnahmen", amount = 805.60, currency = "EUR", category = "Vermietung"},
    {name = "Zinsen Sparbuch", amount = 52.85, currency = "EUR", category = "Zinsen"},
    {name = "Nebenjob", amount = 403.20, currency = "EUR", category = "Nebeneinkommen"},
    {name = "Miete", amount = -1498.70, currency = "EUR", category = "Wohnen\\Miete"},
    {name = "Stromrechnung", amount = -102.35, currency = "EUR", category = "Wohnen\\Strom"},
    {name = "Supermarkt", amount = -298.40, currency = "EUR", category = "Lebenshaltung\\Lebensmittel"},
    {name = "Restaurant", amount = -72.10, currency = "EUR", category = "Lebenshaltung\\Freizeit\\Essen"},
    {name = "ÖPNV-Ticket", amount = -58.95, currency = "CHF", category = "Transport\\ÖPNV"},
    {name = "Tankfüllung", amount = -92.65, currency = "EUR", category = "Transport\\Auto\\Benzin"},
    {name = "KFZ-Versicherung", amount = -398.25, currency = "EUR", category = "Transport\\Auto\\Versicherung"},
    {name = "Fitnessstudio", amount = -38.80, currency = "EUR", category = "Gesundheit\\Sport"},
    {name = "Arztbesuch", amount = -97.55, currency = "EUR", category = "Gesundheit\\Medizin"},
    {name = "Online-Shop", amount = -118.75, currency = "EUR", category = "Freizeit\\Shopping"},
    {name = "Kino", amount = -21.40, currency = "GBP", category = "Freizeit\\Unterhaltung"},
    {name = "Handy", amount = -49.85, currency = "EUR", category = "Versorgung\\Telefon&Internet"},
    {name = "Netflix", amount = -14.99, currency = "EUR", category = "Freizeit\\Streaming"}
}

local sankey_extension = require("dist/SankeyChart")

WriteHeader (dummyAccount, os.time{year=2024, month=1, day=10, hour=0}, os.time{year=2024, month=3, day=11, hour=0}, #transactions)
WriteTransactions (dummyAccount, transactions)
WriteTail (dummyAccount)

f:seek("set", 0) -- set file handle back to start
s = f:read("*a")
print_stdout (s)

assert(s ~= nil and s ~= '')

f:close()