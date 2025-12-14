.DEFAULT_GOAL := dist
INSTALL_DIR = ~/Library/Containers/com.moneymoney-app.retail/Data/Library/Application\ Support/MoneyMoney/Extensions
OUTPUT_FILE = ./dist/SankeyChart.lua
TMP_DIR = ./tmp/

.PHONY: dist
dist: clean
	npm ci
	npm run build

.PHONY: test
test:
	npm run test

.PHONY: install
install:
	cp $(OUTPUT_FILE) $(INSTALL_DIR)

.PHONY: uninstall
uninstall:
	rm $(INSTALL_DIR)/SankeyChart.lua

clean:
	rm -f $(TMP_DIR)/* && (rmdir $(TMP_DIR) || true)
	npm run clean