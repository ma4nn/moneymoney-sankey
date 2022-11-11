TERSER_BIN = ./node_modules/terser/bin/terser --compress --mangle --

.PHONY: dist
dist:
	npm install
	npx tsc
	export INCLUDE_TREE_JS=`$(TERSER_BIN) dist/Tree.js` && \
		export INCLUDE_MAIN_JS=`$(TERSER_BIN) dist/main.js` && \
		export STYLES_CSS=`sass --no-source-map src/styles.scss` && \
		envsubst < src/SankeyChart.lua > dist/SankeyChart.lua && \
		rm dist/*.js

clean:
	rm -f dist/*.js dist/*.lua