export function getDefaultColorValue(colorId: number) {
    // map the big category ids to the --chart-color-{0-9} palette defined by the active renderer's stylesheet
    return getComputedStyle(document.documentElement).getPropertyValue(`--chart-color-${colorId % 10}`).trim();
}
