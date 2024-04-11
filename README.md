# MoneyMoney Extension: Sankey Chart

![build status](https://github.com/ma4nn/moneymoney-sankey/actions/workflows/verify-lua-script.yml/badge.svg)

This is an extension for the great [MoneyMoney app](https://moneymoney-app.com/) to export an HTML [Sankey Chart](https://de.wikipedia.org/wiki/Sankey-Diagramm) from the transaction categories.

![Sankey Sample Chart](https://dev-investor.de/wp-content/uploads/moneymoney_sankey_diagramm-1.jpg)

## Installing

This MoneyMoney extension must be installed as follows:
1. Download the file `SankeyChart.lua` from the [latest release](https://github.com/ma4nn/moneymoney-sankey/releases/latest/download/SankeyChart.lua)
2. In the MoneyMoney app open menu _Help → Show database in Finder_ and copy the downloaded file into the sub-folder "Extensions".

## Usage 💡

The Sankey Chart can be generated by selecting or filtering the appropriate transactions or accounts in MoneyMoney and choose menu _Account → Export Transactions_.  
Afterwards select "Sankey-Chart (.html)" as the export format and open the generated file in your browser of choice.

For more information see also [my blog post](https://dev-investor.de/finanz-apps/money-money/kategorien-budgets-nutzen/).

## Developing ⚒️

```
make
```

The compiled MoneyMoney extension can then be found in `dist/SankeyChart.lua` and installed with `make install`.

## Compatibility

- Tested with MoneyMoney 2.4.x
- Modern browser is required

### Known Limitations 🚧
- Only 1 currency is supported (the currency of the account is taken, other currencies are ignored)
- The report is available in German language only

## Issues
In case you are experiencing any issues please try to reproduce it with an MoneyMoney offline account and provide the exported (anonymized) HTML file.  
At least open the [Developer Tools](https://developer.chrome.com/docs/devtools/open?hl=de) of your browser and provide the complete output of the console into the ticket description.

## Licensing

This repository is published under the [MIT license](./LICENSE).  
This repository uses the great Highchart library, please obtain a valid license [on their website](https://shop.highcharts.com/).