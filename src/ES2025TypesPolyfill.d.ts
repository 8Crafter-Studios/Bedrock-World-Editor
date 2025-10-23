declare global {
    interface RegExpConstructor {
        /**
         * NOTE: This is a temporary polyfill until the TypeScript lib definitions are updated to include this.
         *
         * Escapes any RegExp syntax characters in the input string, returning a
         * new string that can be safely interpolated into a RegExp as a literal
         * string to match.
         * @example
         * ```ts
         * const regExp = new RegExp(RegExp.escape("foo.bar"));
         * regExp.test("foo.bar"); // true
         * regExp.test("foo!bar"); // false
         * ```
         */
        escape(string: string): string;
    }
}

export type {};
