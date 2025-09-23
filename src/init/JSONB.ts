/**
 * JSONB.ts
 * An improved version of {@link JSON}
 * @module
 * @description This file contains the `JSONB` class.
 * @author 8Crafter
 */
/**
 * An intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.
 *
 * This is an improved version of {@link JSON}.
 *
 * @author 8Crafter
 */
export const JSONB: globalThis.JSONB = {} as any;
declare global {
    /**
     * An intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.
     *
     * This is an improved version of {@link JSON}.
     *
     * @author 8Crafter
     *
     * @ignore
     */
    interface JSONB {
        /**
         * Converts a JavaScript Object Notation B (JSONB) string into an object.
         * @param text A valid JSON string.
         * @param reviver A function that transforms the results. This function is called for each member of the object.
         * @param options The options for parsing the JSON string.
         * @param options.bigint A value that indicates whether to parse bigints (ex. 57126n).
         * @param options.undefined A value that indicates whether to parse undefined (ex. undefined).
         * @param options.Infinity A value that indicates whether to parse Infinity (ex. Infinity).
         * @param options.NegativeInfinity A value that indicates whether to parse -Infinity (ex. -Infinity).
         * @param options.NaN A value that indicates whether to parse NaN (ex. NaN).
         * @param options.get A value that indicates whether to parse getter functions (ex. get).
         *
         * Warning: This option is currently ignored as it is non-functional.
         * @param options.set A value that indicates whether to parse setter functions (ex. set).
         *
         * Warning: This option is currently ignored as it is non-functional.
         * @param options.function A value that indicates whether to parse functions (ex. function).
         *
         * Warning: This option is currently ignored as it is non-functional.
         * @param options.class A value that indicates whether to parse classes (ex. class).
         *
         * Warning: This option is currently ignored as it is non-functional.
         *
         * @returns A JavaScript value, usually an object or array, that represents the JSONB that was parsed from the specified string.
         *
         * @author 8Crafter
         */
        parse(
            text: string,
            reviver?: (this: any, key: string, value: any) => any,
            options?: {
                bigint?: boolean;
                undefined?: boolean;
                Infinity?: boolean;
                NegativeInfinity?: boolean;
                NaN?: boolean;
                get?: false;
                set?: false;
                function?: false;
                class?: false;
            }
        ): any;
        /**
         * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
         * @param value A JavaScript value, usually an object or array, to be converted.
         * @param replacer A function that transforms the results.
         * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
         * @param options The options for stringifying the provided value.
         * @param options.bigint A value that indicates whether to stringify bigints (ex. 57126n).
         * @param options.undefined A value that indicates whether to stringify undefined (ex. undefined).
         * @param options.Infinity A value that indicates whether to stringify Infinity (ex. Infinity).
         * @param options.NegativeInfinity A value that indicates whether to stringify -Infinity (ex. -Infinity).
         * @param options.NaN A value that indicates whether to stringify NaN (ex. NaN).
         * @param options.get A value that indicates whether to stringify getter functions (ex. get).
         * @param options.set A value that indicates whether to stringify setter functions (ex. set).
         * @param options.function A value that indicates whether to stringify functions (ex. function).
         * @param options.class A value that indicates whether to stringify classes (ex. class).\
         *
         * Warning: This option is currently ignored as it is non-functional.
         * @returns A JavaScript Object Notation B (JSONB) string that represents the value passed in.
         *
         * @author 8Crafter
         */
        stringify(
            value: any,
            replacer?: (this: any, key: string, value: any) => any,
            space?: string | number,
            options?: {
                bigint?: boolean;
                undefined?: boolean;
                Infinity?: boolean;
                NegativeInfinity?: boolean;
                NaN?: boolean;
                get?: boolean;
                set?: boolean;
                function?: boolean;
                class?: false;
            }
        ): string;
        /**
         * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
         * @param value A JavaScript value, usually an object or array, to be converted.
         * @param replacer An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
         * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
         * @param options The options for stringifying the provided value.
         * @param options.bigint A value that indicates whether to stringify bigints (ex. 57126n).
         * @param options.undefined A value that indicates whether to stringify undefined (ex. undefined).
         * @param options.Infinity A value that indicates whether to stringify Infinity (ex. Infinity).
         * @param options.NegativeInfinity A value that indicates whether to stringify -Infinity (ex. -Infinity).
         * @param options.NaN A value that indicates whether to stringify NaN (ex. NaN).
         * @param options.get A value that indicates whether to stringify getter functions (ex. get).
         * @param options.set A value that indicates whether to stringify setter functions (ex. set).
         * @param options.function A value that indicates whether to stringify functions (ex. function).
         * @param options.class A value that indicates whether to stringify classes (ex. class).\
         *
         * Warning: This option is currently ignored as it is non-functional.
         * @returns A JavaScript Object Notation B (JSONB) string that represents the value passed in.
         *
         * @author 8Crafter
         */
        stringify(
            value: any,
            replacer?: (number | string)[] | null,
            space?: string | number,
            options?: {
                bigint?: boolean;
                undefined?: boolean;
                Infinity?: boolean;
                NegativeInfinity?: boolean;
                NaN?: boolean;
                get?: boolean;
                set?: boolean;
                function?: boolean;
                class?: false;
            }
        ): string;
    }
    /**
     * An intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.
     *
     * This is an improved version of {@link JSON}.
     *
     * @author 8Crafter
     *
     * @namespace
     */
    var JSONB: JSONB;
}

(function () {
    "use strict";
    
    /**
     * Asserts that a value is not `undefined` or `null`.
     *
     * @template T The type of the value to check.
     * @param {T} value The value to check.
     * @returns {asserts value is NonNullable<T>} Asserts that the value is not `undefined` or `null`.
     *
     * @throws {Error} If the value is `undefined` or `null`.
     */
    function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
        if (value === undefined || value === null) {
            throw new Error(`${value} is not defined`);
        }
    }

    var rx_one = /^[\],:{}\s]*$/;
    var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
    var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
    var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
    var rx_escapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var rx_dangerous = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

    function f(n: number) {
        // Format integers to have at least two digits.
        return n < 10 ? "0" + n : n;
    }

    function this_value(this: any) {
        return this.valueOf();
    }

    if (typeof Date.prototype.toJSON !== "function") {
        Date.prototype.toJSON = function () {
            return isFinite(this.valueOf())
                ? this.getUTCFullYear() +
                      "-" +
                      f(this.getUTCMonth() + 1) +
                      "-" +
                      f(this.getUTCDate()) +
                      "T" +
                      f(this.getUTCHours()) +
                      ":" +
                      f(this.getUTCMinutes()) +
                      ":" +
                      f(this.getUTCSeconds()) +
                      "Z"
                : (null as never);
        }; /*

        Boolean.prototype.toJSON = this_value;
        Number.prototype.toJSON = this_value;
        String.prototype.toJSON = this_value;*/
    }

    var gap: string;
    var indent: string;
    var meta: { [key: string]: string };
    var rep: (string | number)[] | ((this: any, key: string, value: any) => any) | null | undefined;

    function quote(string: string) {
        // If the string contains no control characters, no quote characters, and no
        // backslash characters, then we can safely slap some quotes around it.
        // Otherwise we must also replace the offending characters with safe escape
        // sequences.

        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string)
            ? '"' +
                  string.replace(rx_escapable, function (a) {
                      var c = meta[a];
                      return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
                  }) +
                  '"'
            : '"' + string + '"';
    }

    function str(key: string | number, holder: any, options: Parameters<typeof JSONB.stringify>[3]): string | undefined {
        // Produce a string from holder[key].

        var i: number; // The loop counter.
        var k; // The member key.
        var v; // The member value.
        var length;
        var mind = gap;
        var partial;
        var value = holder[key] as any | unknown | null;
        if (options?.get) {
            if (Object.hasOwn(holder, "__lookupGetter__") ? !!holder?.__lookupGetter__(key) : false) {
                if (options.set) {
                    if (!!holder.__lookupSetter__(key)) {
                        value = { get: holder.__lookupGetter__(key), set: holder.__lookupSetter__(key) };
                    } else {
                        value = { get: holder.__lookupGetter__(key) };
                    }
                } else {
                    value = { get: holder.__lookupGetter__(key) };
                }
            } else if (options.set) {
                if (Object.hasOwn(holder, "__lookupSetter__") ? !!holder.__lookupSetter__(key) : false) {
                    value = { set: holder.__lookupSetter__(key) };
                }
            }
        } else if (options?.set) {
            if (Object.hasOwn(holder, "__lookupSetter__") ? !!holder.__lookupSetter__(key) : false) {
                value = { set: holder.__lookupSetter__(key) };
            }
        } /* 

// If the value is an instance of the Decimal or Decimal2 class, convert it to decimal type.

        if (
            value
            && typeof value === "object"
            && typeof value.toJSONB === "function"
        ) {
            value = value.toJSONB(key);
        } */

        // If the value has a toJSONB or toJSON method, call it to obtain a replacement value.

        if (value && typeof value === "object" && typeof value.toJSONB === "function") {
            value = value.toJSONB(key);
        } else if (value && typeof value === "object" && typeof value.toJSON === "function") {
            value = value.toJSON(key);
        }

        // If we were called with a replacer function, then call the replacer to
        // obtain a replacement value.

        if (typeof rep === "function") {
            value = rep.call(holder, key.toString(), value);
        }

        // What happens next depends on the value's type.

        switch (typeof value) {
            case "string":
                return quote(value);

            case "number":
                // JSONB numbers must be finite. Encode non-finite numbers as null.

                return isFinite(value)
                    ? String(value)
                    : value == Infinity
                    ? options?.Infinity ?? true
                        ? "Infinity"
                        : "null"
                    : value == -Infinity
                    ? options?.NegativeInfinity ?? true
                        ? "-Infinity"
                        : "null"
                    : Number.isNaN(value)
                    ? options?.NaN ?? true
                        ? "NaN"
                        : "null"
                    : "null";

            case "bigint":
                return options?.bigint ?? true ? String(value) + "n" : "null";
            case "undefined":
                return options?.undefined ?? true ? "undefined" : undefined;
            case "function":
                return options?.function ?? false ? value.toString() : undefined;
            case "boolean":
            // @ts-ignore
            case "null":
                // If the value is a boolean or null, convert it to a string. Note:
                // typeof null does not produce "null". The case is included here in
                // the remote chance that this gets fixed someday.

                return String(value);

            // If the type is "object", we might be dealing with an object or an array or
            // null.

            case "object":
                // Due to a specification blunder in ECMAScript, typeof null is "object",
                // so watch out for that case.

                if (!value) {
                    return "null";
                }

                // Make an array to hold the partial results of stringifying this object value.

                gap += indent;
                partial = [];

                // Is the value an array?

                if (Object.prototype.toString.apply(value) === "[object Array]") {
                    // The value is an array. Stringify every element. Use null as a placeholder
                    // for non-JSONB values.

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value, options) || "null";
                    }

                    // Join all of the elements together, separated with commas, and wrap them in
                    // brackets.

                    v = partial.length === 0 ? "[]" : gap ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]";
                    gap = mind;
                    return v;
                }

                // If the replacer is an array, use it to select the members to be stringified.

                if (rep && typeof rep === "object") {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === "string") {
                            k = rep[i]!;
                            v = str(k, value, options);
                            if (v) {
                                partial.push(quote(k.toString()) + (gap ? ": " : ":") + v);
                            }
                        }
                    }
                } else {
                    // Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value, options);
                            if (v) {
                                partial.push(quote(k) + (gap ? ": " : ":") + v);
                            }
                        }
                    }
                }

                // Join all of the member texts together, separated with commas,
                // and wrap them in braces.

                v = partial.length === 0 ? "{}" : gap ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}";
                gap = mind;
                return v;
        }
    }

    // If the JSONB object does not yet have a stringify method, give it one.

    if (typeof JSONB.stringify !== "function") {
        meta = {
            // table of character substitutions
            "\b": "\\b",
            "\t": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\\r",
            '"': '\\"',
            "\\": "\\\\",
        };
        JSONB.stringify = function (
            value: any,
            replacer?: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
            space?: string | number,
            options: {
                bigint?: boolean;
                undefined?: boolean;
                Infinity?: boolean;
                NegativeInfinity?: boolean;
                NaN?: boolean;
                get?: false;
                set?: false;
                function?: boolean;
                class?: false;
            } = { bigint: true, undefined: true, Infinity: true, NegativeInfinity: true, NaN: true, get: false, set: false, function: false, class: false }
        ): string {
            // The stringify method takes a value and an optional replacer, and an optional
            // space parameter, and returns a JSONB text. The replacer can be a function
            // that can replace values, or an array of strings that will select the keys.
            // A default replacer method can be provided. Use of the space parameter can
            // produce text that is more easily readable.

            var i;
            gap = "";
            indent = "";

            // If the space parameter is a number, make an indent string containing that
            // many spaces.

            if (typeof space === "number") {
                for (i = 0; i < space; i += 1) {
                    indent += " ";
                }

                // If the space parameter is a string, it will be used as the indent string.
            } else if (typeof space === "string") {
                indent = space;
            }

            // If there is a replacer, it must be a function or an array.
            // Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== "function" && (typeof replacer !== "object" || typeof replacer.length !== "number")) {
                throw new SyntaxError("Invalid Replacer");
            }

            // Make a fake root object containing our value under the key of "".
            // Return the result of stringifying the value.

            return str("", { "": value }, options) as string;
        };
    }

    // If the JSONB object does not yet have a parse method, give it one.

    if (typeof JSONB.parse !== "function") {
        JSONB.parse = function (
            text: string,
            reviver?: (this: any, key: string, value: any) => any,
            options: {
                bigint?: boolean;
                undefined?: boolean;
                Infinity?: boolean;
                NegativeInfinity?: boolean;
                NaN?: boolean;
                get?: false;
                set?: false;
                function?: false;
                class?: false;
            } = { bigint: true, undefined: true, Infinity: true, NegativeInfinity: true, NaN: true, get: false, set: false, function: false, class: false }
        ) {
            // The parse method takes a text and an optional reviver function, and returns
            // a JavaScript value if the text is a valid JSONB text.

            var j;
            var rx_three_b = RegExp(
                `"[^"\\\\\\n\\r]*"|true|false|null|${options.undefined ?? true ? "undefined|" : ""}${options.Infinity ?? true ? "Infinity|" : ""}${
                    options.NegativeInfinity ?? true ? "-Infinity|" : ""
                }${options.NaN ?? true ? "NaN|" : ""}-?\\d+${
                    options.bigint ?? true ? `(?:n|(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)` : `(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?`
                }`,
                "g"
            );

            function walk(holder: any, key: string) {
                assertIsDefined(reviver);

                // The walk method is used to recursively walk the resulting structure so
                // that modifications can be made.

                var k;
                var v;
                var value = holder[key];
                if (value && typeof value === "object") {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }

            // Parsing happens in four stages. In the first stage, we replace certain
            // Unicode characters with escape sequences. JavaScript handles many characters
            // incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            rx_dangerous.lastIndex = 0;
            if (rx_dangerous.test(text)) {
                text = text.replace(rx_dangerous, function (a) {
                    return "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

            // In the second stage, we run the text against regular expressions that look
            // for non-JSONB patterns. We are especially concerned with "()" and "new"
            // because they can cause invocation, and "=" because it can cause mutation.
            // But just to be safe, we want to reject all unexpected forms.

            // We split the second stage into 4 regexp operations in order to work around
            // crippling inefficiencies in IE's and Safari's regexp engines. First we
            // replace the JSONB backslash pairs with "@" (a non-JSONB character). Second, we
            // replace all simple value tokens with "]" characters. Third, we delete all
            // open brackets that follow a colon or comma or that begin the text. Finally,
            // we look to see that the remaining characters are only whitespace or "]" or
            // "," or ":" or "{" or "}". If that is so, then the text is safe for eval.
            /* console.log(
    text
        .replace(rx_two, "@")
        .replace(rx_three_b, "]")
        .replace(rx_four, "")
) */
            if (rx_one.test(text.replace(rx_two, "@").replace(rx_three_b, "]").replace(rx_four, ""))) {
                // In the third stage we use the eval function to compile the text into a
                // JavaScript structure. The "{" operator is subject to a syntactic ambiguity
                // in JavaScript: it can begin a block or an object literal. We wrap the text
                // in parens to eliminate the ambiguity.

                j = eval("(" + text + ")");

                // In the optional fourth stage, we recursively walk the new structure, passing
                // each name/value pair to a reviver function for possible transformation.

                return typeof reviver === "function" ? walk({ "": j }, "") : j;
            }

            // If the text is not JSONB parseable, then a SyntaxError is thrown.

            throw new SyntaxError("JSONB.parse");
        };
    }
})();
globalThis.JSONB = JSONB;
