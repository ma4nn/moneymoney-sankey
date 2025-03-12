#!/usr/bin/env lua
-- The MIT License (MIT)
--
-- Copyright (c) 2022-25 Christoph Massmann <chris@dev-investor.de>
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy
-- of this software and associated documentation files (the "Software"), to deal
-- in the Software without restriction, including without limitation the rights
-- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-- copies of the Software, and to permit persons to whom the Software is
-- furnished to do so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in
-- all copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
-- THE SOFTWARE.

Exporter {version = {{ version }},
          format = "Sankey-Chart",
          fileExtension = "html",
          reverseOrder = false,
          description = "Generate an interactive Sankey Chart from your category transactions"}

variables = {
    ["today"] = os.date('%d.%m.%Y %H:%M:%S')
}

local function write_line(line)
   assert(io.write(line, "\n"))
end

local function table2Json(tbl)
    local function serialize(o)
        if type(o) == "number" or type(o) == "boolean" then
            return tostring(o)
        elseif type(o) == "string" then
            return string.format("%q", o:gsub("\\", "\\\\"))
        elseif type(o) == "table" then
            local isArray = true
            local index = 1
            for k, _ in pairs(o) do
                if k ~= index then
                    isArray = false
                    break
                end
                index = index + 1
            end

            local items = {}
            if isArray then
                for _, v in ipairs(o) do
                    table.insert(items, serialize(v))
                end

                return "[" .. table.concat(items, ",") .. "]"
            else
                for k, v in pairs(o) do
                    table.insert(items, string.format("%q:%s", k, serialize(v)))
                end

                return "{" .. table.concat(items, ",") .. "}"
            end
        end

        return "null"
    end

    return serialize(tbl)
end


local function replace_placeholders(template, data)
    for key, value in pairs(data) do
        template = template:gsub("{{ " .. key .. " }}", value)
    end
    return template
end

-- called once at the beginning of the export
function WriteHeader (account, startDate, endDate, transactionCount)
    variables["currency"] = account.currency
    filtered_transactions = {}
end

-- called for every booking day
function WriteTransactions (account, transactions)
    for _,transaction in ipairs(transactions) do
        if transaction.currency == account.currency then
            table.insert(filtered_transactions, {
                id = transaction.id,
                amount = transaction.amount,
                category = transaction.category,
                currency = transaction.currency,
                account = account.name,
                date = transaction.bookingDate
            })
        else
            print("Transaction '" .. transaction.name .. "' in currency " .. transaction.currency .. " differs from account (" .. account.currency .. "), skipping.")
        end
    end
end

function WriteTail (account)
    variables["transactions_json"] = table2Json(filtered_transactions)

    write_line(replace_placeholders([==[
{{ html_template }}
]==], variables))
end
