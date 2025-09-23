import "jquery";

// @ts-expect-error
globalThis.$ = globalThis.jQuery = require("jquery");
(function ($: JQueryStatic): void {
    $.fn.animateCSSVariable = function (
        variable: string,
        targetValue: string | number,
        duration?: number | undefined,
        easing?: string | undefined,
        callback?: (() => void) | undefined
    ): JQuery {
        return this.each(function (): void {
            const element = $(this);
            const startValue: number = parseFloat(getComputedStyle(this).getPropertyValue(variable));
            const endValue: number = typeof targetValue === "string" ? parseFloat(targetValue) : targetValue;
            $({ value: startValue }).animate(
                { value: endValue },
                {
                    duration: duration || 400,
                    easing: easing || "swing",
                    step: function (now: number): void {
                        element.css(variable, now);
                    },
                    complete: callback || $.noop,
                }
            );
        });
    };
})(jQuery);

declare global {
    interface JQuery {
        animateCSSVariable(
            variable: string,
            targetValue: string | number,
            duration?: number | undefined,
            easing?: string | undefined,
            callback?: (() => void) | undefined
        ): JQuery;
    }
}
