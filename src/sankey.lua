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
          description = "Generate a beautiful Sankey Chart from your category transactions"}

-------------------------
-- Global Configuration
-------------------------
MAIN_CATEGORY_NAME = "Saldo" -- name of the category for balancing incomes and expenses
MISSING_CATEGORY_NAME = "(ohne)"
CATEGORIES_TO_EXCLUDE = {} -- which categories should be ignored
MAX_DEPTH_INCOME = 10 -- how deep to go down in the category path for incomes
MAX_DEPTH_EXPENSE = 10 -- how deep to go down in the category path for expenses
CATEGORIES_PATH_SEPARATOR = ' » '
SECONDS_PER_MONTH = 60 * 60 * 24 * 30;
CATEGORY_LINK_TYPE_INCOME = "income"
CATEGORY_LINK_TYPE_EXPENSE = "expense"
-------------------------

variables = {
    ["today"] = os.date('%d.%m.%Y %H:%M:%S'),
    ["category_separator"] = CATEGORIES_PATH_SEPARATOR
}
-- initialize global array to store category sums
category_links = {}
-- global array to store mapping of category ids to category full paths
categories = {};

local function write_line(line)
   assert(io.write(line, "\n"))
end

-- @see https://www.lua.org/pil/19.3.html
local function pairsByKeys (t, f)
    local a = {}
    for n in pairs(t) do table.insert(a, n) end
    table.sort(a, f)
    local i = 0
    local iter = function ()
        i = i + 1
        if a[i] == nil then return nil
        else return a[i], t[a[i]]
        end
    end
    return iter
end

local function get_link_id (category_link)
    return 10000 * category_link.from_category_id + category_link.to_category_id
end

local function add_or_update_category_link (category_id, parent_category_id, amount)
    local category_link = { from_category_id = parent_category_id, to_category_id = category_id, amount = amount }
    local link_id = get_link_id(category_link)

    if category_links[link_id] then
        category_links[link_id].amount = category_links[link_id].amount + category_link.amount
    else
        category_links[link_id] = category_link
    end
end

local function recalculate_category_link_weights ()
    for link_id, link_data in pairs(category_links) do
        local category_id_inverse = get_link_id({ from_category_id = link_data.to_category_id, to_category_id = link_data.from_category_id})
        -- remove loops, i.e. there is an income node while also an expense node
        if link_data.amount >= 0 and category_links[category_id_inverse] then
            category_links[category_id_inverse].amount = category_links[category_id_inverse].amount - link_data.amount
            category_links[link_id] = nil
            print("Consolidating " .. link_id .. " cashflows into " .. category_id_inverse)
        end
    end
end

local function get_category_id_by_path (new_category_path, type)
    for category_id,category in pairs(categories) do
        if category.path == new_category_path and category.type == type then
            return category_id
        end
    end

    return nil
end

local function add_or_update_category (new_category_path, type)
    local existing_category_id = get_category_id_by_path(new_category_path, type)

    if existing_category_id == nil then
        table.insert(categories, {path = new_category_path, type = type})
    end

    return get_category_id_by_path(new_category_path, type)
end

local function replace_placeholders(template, data)
    for key, value in pairs(data) do
        template = template:gsub("{{ " .. key .. " }}", value)
    end
    return template
end

-- called once at the beginning of the export
function WriteHeader (account, startDate, endDate, transactionCount)
    variables["start_date"] = os.date('%d.%m.%Y', startDate)
    variables["end_date"] = os.date('%d.%m.%Y', endDate)
    variables["account_name"] = account.name
    variables["account_number"] = account.accountNumber
    variables["transaction_count"] = transactionCount
    variables["number_of_months"] = math.max(os.difftime(endDate, startDate) / SECONDS_PER_MONTH, 1)
    variables["number_of_months_formatted"] = math.floor(variables["number_of_months"])
    variables["currency"] = account.currency

    -- the currency to filter
    currency = account.currency
    number_of_months = math.max(os.difftime(endDate, startDate) / SECONDS_PER_MONTH, 1)
end

-- called for every booking day
function WriteTransactions (account, transactions)
    -- This method is called for every booking day.
    -- it is used to sum up all the bookings into a global category links variable.
    for _,transaction in ipairs(transactions) do
        local category_path = transaction.category

        local is_category_excluded = false
        for index, value in ipairs(CATEGORIES_TO_EXCLUDE) do
            if string.find(category_path, value) then
                is_category_excluded = true
            end
        end

        if not is_category_excluded and transaction.currency == currency then
            if category_path == "" then
                category_path = MISSING_CATEGORY_NAME
            end

            local type
            if transaction.amount >= 0 then
                type = CATEGORY_LINK_TYPE_INCOME
            else
                type = CATEGORY_LINK_TYPE_EXPENSE
            end

            local category_path_full = ""
            local parent_category_id = add_or_update_category(MAIN_CATEGORY_NAME, nil)
            local i = 0
            for category_name in string.gmatch(category_path, "[^\\]+") do
                i = i + 1
                if (transaction.amount > 0 and i <= MAX_DEPTH_INCOME) or (transaction.amount < 0 and i <= MAX_DEPTH_EXPENSE) then
                    category_path_full = category_path_full .. CATEGORIES_PATH_SEPARATOR .. category_name
                    category_path_full = category_path_full:gsub("^" .. CATEGORIES_PATH_SEPARATOR, "")

                    local category_id = add_or_update_category(category_path_full, type)
                    add_or_update_category_link(category_id, parent_category_id, transaction.amount)

                    parent_category_id = category_id
                end
            end
        else
            print("Transaction '" .. transaction.name .. "' in currency " .. transaction.currency .. " differs from the others (" .. currency .. ") or category " .. transaction.category .. " is excluded, skipping.")
        end
    end

    recalculate_category_link_weights()
end

function WriteTail (account)
    local categories_json = ""
    for category_id,category in pairs(categories) do
        categories_json = categories_json .. '[' .. category_id .. ', {id: ' .. category_id .. ', name: "' .. category.path .. '", active: true}], '
    end

    variables["categories_json"] = categories_json

    chart_js = ""
    for _,link_data in pairsByKeys(category_links) do
        chart_js = chart_js .. 'chartDataTree.insert(' .. link_data.from_category_id .. ", " .. link_data.to_category_id .. ", " .. link_data.amount .. ');'
    end

    variables["init_chart_js"] = chart_js

    write_line(replace_placeholders([==[
{{ html_template }}
]==], variables))
end
