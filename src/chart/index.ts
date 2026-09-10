import { SankeyChartRenderer } from "./types";
import HighchartsSankeyRenderer from "./highcharts/renderer";

// the single place that decides which chart library is used
export function createSankeyRenderer(): SankeyChartRenderer {
    return new HighchartsSankeyRenderer();
}
