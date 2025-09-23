import "./correctlyImportjQuery.ts";
import "./libs/spectrum.css";
import "./libs/spectrum.ts";

$((): void => {
    $(".sp-picker-container")
        .append(`<select class="spectrum-colorpicker-color-format-dropdown" onchange="$(currentColorPickerTarget).spectrum('option', 'preferredFormat', this.value); $(currentColorPickerTarget).spectrum('set', $(this).parent().find('.sp-input').val()); console.log(this.value);">
        <option value="hex">HEX</option>
        <option value="hex3">HEX3</option>
        <option value="hex6">HEX6</option>
        <option value="hex8">HEX8</option>
        <option value="prgb">PRGB</option>
        <option value="rgb">RGB</option>
        <option value="hsv">HSV</option>
        <option value="hsl">HSL</option>
        <option value="none">name</option>
        <option value="none">none</option>
    </select>`);
});

globalThis.currentColorPickerTarget = null;

declare global {
    namespace globalThis {
        var currentColorPickerTarget: HTMLElement | null;
    }
}
