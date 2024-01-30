#!/usr/bin/env lua

f = assert (io.tmpfile())
io.output(f) -- suppress output
version = 1
currency = "EUR"

-- dummy exporter
function Exporter(version, format, fileExtension, reverseOrder, description)
    version = version
end

local dummyAccount = { name = "Test", accountNumber = 1234, currency = "EUR" }

local sankey_extension = require("dist/SankeyChart")

WriteHeader (dummyAccount, os.time{year=1970, month=1, day=1, hour=0}, os.time{year=1970, month=1, day=1, hour=0}, 1)
WriteTransactions (dummyAccount, {})
WriteTail (dummyAccount)

f:seek("set", 0) -- set file handle back to start
s = f:read("*a")
print (s)

assert(s ~= nil and s ~= '')

f:close()