import "jquery";

// @ts-expect-error: This is to fix the jQuery import.
globalThis.$ = globalThis.jQuery = require("jquery") as typeof import("jquery");
(function loadCustomJQueryMethods($: JQueryStatic): void {
    $.fn.animateCSSVariable = function animateCSSVariable(
        variable: string,
        targetValue: string | number,
        duration?: number,
        easing?: string,
        callback?: () => void
    ): JQuery {
        return this.each(function animateCSSVariableForElement(): void {
            const element = $(this);
            const startValue: number = parseFloat(getComputedStyle(this).getPropertyValue(variable));
            const endValue: number = typeof targetValue === "string" ? parseFloat(targetValue) : targetValue;
            $({ value: startValue }).animate(
                { value: endValue },
                {
                    duration: duration ?? 400,
                    easing: easing ?? "swing",
                    step: function animateCSSVariableStep(now: number): void {
                        element.css(variable, now);
                    },
                    // eslint-disable-next-line @typescript-eslint/unbound-method -- This method is fine to leave unbound.
                    complete: callback ?? $.noop,
                }
            );
        });
    };
})(jQuery);

declare global {
    interface JQuery {
        animateCSSVariable(variable: string, targetValue: string | number, duration?: number, easing?: string, callback?: () => void): JQuery;
    }
}
