TERSER_BIN = ./node_modules/terser/bin/terser --compress --mangle --
INSTALL_DIR = ~/Library/Containers/com.moneymoney-app.retail/Data/Library/Application\ Support/MoneyMoney/Extensions

.PHONY: dist
dist: clean
	npm install
	npx tsc
	export INCLUDE_TREE_JS=`$(TERSER_BIN) dist/Tree.js` && \
		[ "$${INCLUDE_TREE_JS}" ] || exit 1 && \
		export INCLUDE_MAIN_JS=`$(TERSER_BIN) dist/main.js` && \
		[ "$${INCLUDE_MAIN_JS}" ] || exit 1 && \
		export STYLES_CSS=`npx sass --no-source-map src/styles.scss` && \
		[ "$${STYLES_CSS}" ] || exit 1 && \
		envsubst < src/SankeyChart.lua > dist/SankeyChart.lua && \
		chmod +x dist/SankeyChart.lua && \
		make distclean

.PHONY: test
test:
	npm run test

.PHONY: install
install:
	cp dist/SankeyChart.lua $(INSTALL_DIR)

.PHONY: uninstall
uninstall:
	rm $(INSTALL_DIR)/SankeyChart.lua

distclean:
	rm dist/*.js

clean:
	rm -f dist/* && (rmdir dist/ || true)