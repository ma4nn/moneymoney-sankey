INSTALL_DIR = ~/Library/Containers/com.moneymoney-app.retail/Data/Library/Application\ Support/MoneyMoney/Extensions
OUTPUT_FILE = dist/SankeyChart.lua

.PHONY: dist
dist: clean
	npm install
	npx tsc
	VERSION_SEMVER=`cat package.json | jq -r '.version'` && export VERSION=$${VERSION_SEMVER%.*} && \
		export INLINE_JS=`npm run build:js --silent` && \
		[ "$${INLINE_JS}" ] || exit 1 && \
		export INLINE_CSS=`npm run build:css --silent` && \
		[ "$${INLINE_CSS}" ] || exit 1 && \
		envsubst '$$VERSION,$$INLINE_CSS,$$INLINE_JS' < src/SankeyChart.lua > $(OUTPUT_FILE) && \
		chmod +x $(OUTPUT_FILE) && \
		make distclean

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