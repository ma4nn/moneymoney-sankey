#!/usr/bin/env lua
-- The MIT License (MIT)
--
-- Copyright (c) 2022-24 Christoph Massmann <chris@dev-investor.de>
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

Exporter {version = 1.00,
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
MAX_DEPTH_INCOME = 2 -- how deep to go down in the category path for incomes
MAX_DEPTH_EXPENSE = 2 -- how deep to go down in the category path for expenses
CATEGORIES_PATH_SEPARATOR = ' » '
SECONDS_PER_MONTH = 60 * 60 * 24 * 30;
CATEGORY_LINK_TYPE_INCOME = 'income'
CATEGORY_LINK_TYPE_EXPENSE = 'expense'
-------------------------

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

local function get_link_id(category_link)
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
        table.insert(categories, {path = new_category_path, type = type })
    end

    return get_category_id_by_path(new_category_path, type)
end

-- called once at the beginning of the export
function WriteHeader (account, startDate, endDate, transactionCount)
    local start_date = os.date('%d.%m.%Y', startDate)
    local end_date = os.date('%d.%m.%Y', endDate)
    local transaction_count = transactionCount

    local html = [[
<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Cashflow Chart ]] .. start_date .. [[ bis ]] .. end_date .. [[</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highcharts@11.3.0/css/highcharts.css" integrity="sha384-ik8taHI0uJ0E3oBau2yMQafhM4JvBHnjBsAkwXygD1Bv9f2F71W2pHkwf7hX2vt6" crossorigin="anonymous">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
<style>
${STYLES_CSS}
</style>
</head>
<body>
<div class="container">
    <h1 class="text-center">Cashflows</h1>
    <h5 class="text-center">]] .. account.name .. [[, ]] .. start_date .. [[ bis ]] .. end_date .. [[</h5>
    <p class="text-center">Das folgende <a href="https://de.wikipedia.org/wiki/Sankey-Diagramm" target="_blank">Sankey Chart</a> zeigt die aus <a href="https://moneymoney-app.com/" target="_blank">MoneyMoney</a> exportierten Cashflows des <strong>Kontos ]] .. account.name .. [[ (]] .. account.accountNumber .. [[)</strong> für den <strong>Zeitraum ]] .. start_date .. [[ bis ]] .. end_date .. [[</strong>.<br />
    Es wurde aus insgesamt <strong>]] .. transaction_count .. [[ Transaktionen</strong> generiert.</p>

    <div class="controls pb-4">
        <div class="accordion" id="accordionConfig">
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingOne">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="false" aria-controls="collapseOne">
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>&nbsp;Chart anpassen..
                    </button>
                </h2>
                <div id="collapseOne" class="accordion-collapse collapsing" aria-labelledby="headingOne" data-bs-parent="#accordionConfig">
                    <div class="accordion-body">
                        <form>
                            <div class="row g-3">
                                <div class="col-12">
                                    <label for="categories">Kategorie ausschließen</label>
                                    <select id="categories" class="form-select" multiple aria-label="multiple select">
                                    </select>
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="isShowMonthlyValues">
                                        <label class="form-check-label" for="isShowMonthlyValues">
                                            Werte auf Monatsbasis anzeigen
                                        </label>
                                    </div>
                                </div>
                                <div class="col-12">
                                    <button id="applySettingsButton" type="button" class="btn btn-primary">Anwenden</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
]]
    write_line(html)

    -- initialize global array to store category sums
    category_links = {}
    -- global array to store mapping of category ids to category full paths
    categories = {};
    -- the currency to filter
    currency = nil
    number_of_months = math.max(os.difftime(endDate, startDate) / SECONDS_PER_MONTH, 1)
end

-- called for every booking day
function WriteTransactions (account, transactions)
    -- This method is called for every booking day.
    -- it is used to sum up all the bookings into a global category links variable.
    for _,transaction in ipairs(transactions) do
        local category_path = transaction.category

        if currency == nil then
            currency = transaction.currency
            print("Setting currency to " .. currency)
        end

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
            print("Transaction " .. transaction.name .. " currency " .. transaction.currency .. " differs from the others (" .. currency .. " or category " .. transaction.category .. " is excluded, skipping.")
        end
    end

    recalculate_category_link_weights()
end

function WriteTail (account)
    local categories_json = ""
    for category_id,category in pairs(categories) do
        categories_json = categories_json .. '[' .. category_id .. ', "' .. category.path .. '"], '
    end

    write_line('<div id="chart-container"></div>')
    write_line('<footer class="text-center text-opacity-25 text-secondary p-3"><small>Dieser Bericht wurde am ' .. os.date('%d.%m.%Y %H:%M:%S') .. ' Uhr mit der MoneyMoney Extension <a href="https://github.com/ma4nn/moneymoney-sankey" target="_blank" class="text-opacity-25 text-secondary">moneymoney-sankey</a> Version v' .. string.format('%.2f', version) .. ' generiert.</small></footer>')

    local html = [[
<script type="module">
    const numberOfMonths = ]] .. number_of_months .. [[;
    const categories = new Map([]] .. categories_json .. [[]);
    const currency = ']] .. currency .. [[';

    ${INCLUDE_TREE_JS}

    let chartDataTree = new Tree(1, 0);
]]
    for _,link_data in pairsByKeys(category_links) do
        html = html .. 'chartDataTree.insert(' .. link_data.from_category_id .. ", " .. link_data.to_category_id .. ", " .. link_data.amount .. ');'
    end

    -- @todo remove cdns
    html = html .. [[
    ${INCLUDE_MAIN_JS}
</script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@11.3.0/highcharts.js" integrity="sha384-sdSHdV37JEsmwft9nBHPKnSUQOiBhivIWWWWJOSvVhiaj+zw38Q4QMxcm1p4Q1ry" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@11.3.0/modules/sankey.js" integrity="sha384-JRa1V69STkqlUlYKNGODlSHDvNVF/RcAv1YmQdJWX2fRdX/28EedAKs3nNG0G9XL" crossorigin="anonymous"></script>
]]
    write_line(html)
    write_line("</body></html>")
end
