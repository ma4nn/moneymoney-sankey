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
    { name = "Wocheneinkauf", amount = -3.50, currency = currency, category = "Freizeit" },
    { name = "Geschenk", amount = -20, currency = "USD", category = "Freizeit" },
    { name = "Tanken", amount = -69.76, currency = currency, category = "Auto\\Sprit" },
    { name = "Werkstatt", amount = -69.76, currency = currency, category = "Auto\\Instandhaltung" },
    { name = "Miete", amount = -800, currency = currency, category = "Wohnen" },
    { name = "Gehalt", amount = 1500, currency = currency, category = "Arbeit" },
    { name = "Aktie XYZ Dividende", amount = 45.32, currency = currency, category = "Dividende" },
}

local sankey_extension = require("dist/SankeyChart")

WriteHeader (dummyAccount, os.time{year=2024, month=3, day=10, hour=0}, os.time{year=2024, month=4, day=19, hour=0}, #transactions)
WriteTransactions (dummyAccount, transactions)
WriteTail (dummyAccount)

f:seek("set", 0) -- set file handle back to start
s = f:read("*a")
print_stdout (s)

assert(s ~= nil and s ~= '')

f:close()