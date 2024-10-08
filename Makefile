.DEFAULT_GOAL := dist
INSTALL_DIR = ~/Library/Containers/com.moneymoney-app.retail/Data/Library/Application\ Support/MoneyMoney/Extensions
OUTPUT_FILE = dist/SankeyChart.lua
TMP_DIR = tmp/

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

distclean:
	rm dist/*.js

clean:
	rm -f dist/* && (rmdir dist/ || true)
	rm -rf $(TMP_DIR)