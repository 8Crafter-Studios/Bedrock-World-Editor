export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
}; // Remove readonly
export type MutableRequired<T> = {
    -readonly [P in keyof T]-?: T[P];
}; // Remove readonly and ?
export type ReadonlyPartial<T> = {
    +readonly [P in keyof T]+?: T[P];
}; // Add readonly and ?
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
export type PushFront<TailT extends any[], HeadT> = ((head: HeadT, ...tail: TailT) => void) extends (...arr: infer ArrT) => void ? ArrT : never;
/* export type NoRepetition<U extends string, ResultT extends any[] = []> = {
    [k in U]: PushFront<ResultT, k> | NoRepetition<Exclude<U, k>, PushFront<ResultT, k>>;
}[U]; */

export type NoRepetition<U extends string, ResultT extends any[] = []> =
    | ResultT
    | {
          [k in U]: NoRepetition<Exclude<U, k>, [k, ...ResultT]>;
      }[U];

export type LooseAutocomplete<T extends string> = T | Omit<string, T>;

export type LooseAutocompleteB<U extends string | number | symbol, T extends U> = T | Omit<U, T>;

export type Split<S extends string> = S extends "" ? [] : S extends `${infer C}${infer R}` ? [C, ...Split<R>] : never;

export type TakeFirstNElements<T extends any[], N extends number, Result extends any[] = []> = Result["length"] extends N
    ? Result
    : T extends [infer First, ...infer Rest]
    ? TakeFirstNElements<Rest, N, [...Result, First]>
    : Result;

/**
 * @author 8Crafter
 */
export type TakeLastNElements<T extends any[], N extends number, Result extends any[] = []> = Result["length"] extends N
    ? Result
    : T extends [...infer Rest, infer Last]
    ? TakeFirstNElements<Rest, N, [Last, ...Result]>
    : Result;

export type Join<T extends string[]> = T extends []
    ? ""
    : T extends [infer Head, ...infer Tail]
    ? Head extends string
        ? `${Head}${Join<Tail extends string[] ? Tail : []>}`
        : never
    : never;

export type CutFirstChars<S extends string, N extends number, SArray = TakeFirstNElements<Split<S>, N>> = Join<SArray extends string[] ? SArray : never>;

export type Full<T> = {
    [P in keyof T]-?: T[P];
};

export type ReadonlyDeep<T> = {
    readonly [P in keyof T]: ReadonlyDeep<T[P]>;
};

export type MutableDeep<T> = {
    -readonly [P in keyof T]: MutableDeep<T[P]>;
};

export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

export type KeysOfUnion<T> = T extends T ? keyof T : never;

export type ValueTypes<T> = T extends { [key: string]: infer U } ? U : never;

export type test1a = [name: number, id: `ID:${number}`, hi: "text"];

/**
 * @see https://stackoverflow.com/a/60822641/16872762
 */
export type ReturnTypeWithArgs<T extends (...args: any[]) => any, ARGS_T> = Extract<
    T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2; (...args: infer A3): infer R3; (...args: infer A4): infer R4 }
        ? [A1, R1] | [A2, R2] | [A3, R3] | [A4, R4]
        : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2; (...args: infer A3): infer R3 }
        ? [A1, R1] | [A2, R2] | [A3, R3]
        : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2 }
        ? [A1, R1] | [A2, R2]
        : T extends { (...args: infer A1): infer R1 }
        ? [A1, R1]
        : never,
    [ARGS_T, any]
>[1];

declare global {
    /**
     * Mutates the type by removing the `readonly` modifier from all properties.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { readonly name: string; readonly age: number };
     * type Mutated = Mutable<Original>; // { name: string; age: number }
     * ```
     */
    type Mutable<T> = {
        -readonly [P in keyof T]: T[P];
    };
    /**
     * Mutates the type by removing the `readonly` modifier and the optional modifier (`?`) from all properties.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { readonly name?: string; readonly age?: number };
     * type Mutated = MutableRequired<Original>; // { name: string; age: number }
     * ```
     */
    type MutableRequired<T> = {
        -readonly [P in keyof T]-?: T[P];
    };
    /**
     * Mutates the type by adding the `readonly` modifier and the optional modifier (`?`) to all properties.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { name?: string; age?: number };
     * type Mutated = ReadonlyPartial<Original>; // { readonly name?: string; readonly age?: number }
     * ```
     */
    type ReadonlyPartial<T> = {
        +readonly [P in keyof T]+?: T[P];
    };
    /**
     * Converts a union type to an intersection type.
     *
     * @template U The union type to convert.
     *
     * @example
     * ```ts
     * type Original = string | number;
     * type Mutated = UnionToIntersection<Original>; // string & number
     * ```
     */
    type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
    // type test1a = [name: number, id: `ID:${number}`, hi: "text"];
    /**
     * Pushes a value to the front of a tuple type.
     *
     * @template TailT The tail of the tuple.
     * @template HeadT The head to push to the front.
     *
     * @example
     * ```ts
     * type Original = [number, string];
     * type Mutated = PushFront<Original, boolean>; // [boolean, number, string]
     * ```
     */
    type PushFront<TailT extends any[], HeadT> = ((head: HeadT, ...tail: TailT) => void) extends (...arr: infer ArrT) => void ? ArrT : never;
    /* type NoRepetition<U extends string, ResultT extends any[] = []> = {
        [k in U]: PushFront<ResultT, k> | NoRepetition<Exclude<U, k>, PushFront<ResultT, k>>;
    }[U]; */
    /**
     * Creates a type that represents a string with no repeated characters.
     *
     * @template U The string to process.
     * @template ResultT The result type, defaulting to an empty array.
     *
     * @example
     * ```ts
     * type Original = NoRepetition<"abc">; // ["a", "b", "c"]
     * ```
     */
    type NoRepetition<U extends string, ResultT extends any[] = []> =
        | ResultT
        | {
              [k in U]: NoRepetition<Exclude<U, k>, [k, ...ResultT]>;
          }[U];
    // Source: https://www.totaltypescript.com/tips/create-autocomplete-helper-which-allows-for-arbitrary-values
    /**
     * Creates a type that allows for autocomplete suggestions on a string type, while not giving errors for other values.
     *
     * @template T A union type of string literals to add to the autocomplete.
     *
     * @example
     * ```ts
     * // Will allow autocomplete for "abc", "b", and "def", and will not throw errors for other string values.
     * type Original = LooseAutocomplete<"abc" | "b" | "def">; // "abc" | "b" | "def" | (Omit<string, "abc" | "b" | "def"> & string)
     * ```
     */
    type LooseAutocomplete<T extends string> = T | (Omit<string, T> & string);
    /**
     * Creates a type that allows for autocomplete suggestions on a custom type (can only be string, number, or symbol), while not giving errors for other values.
     *
     * @template U A union type that can contain string, number, and symbol, this will be the base type, anything not assignable to this WILL throw an error.
     * @template T A union type of string literals and number literals to add to the autocomplete, string literals are only allowed if {@link U} contains string, and number literals are only allowed if {@link U} contains number.
     *
     * @example
     * ```ts
     * // Will allow autocomplete for "abc", "b", and "def", and will not throw errors for other string values.
     * type Original = LooseAutocompleteB<string, "abc" | "b" | "def">; // "abc" | "b" | "def" | (Omit<string, "abc" | "b" | "def"> & string)
     *
     * // Will allow autocomplete for 1, 2, and 3, and will not throw errors for other number values.
     * type Original = LooseAutocompleteB<number, 1 | 2 | 3>; // 1 | 2 | 3 | (Omit<number, 1 | 2 | 3> & number)
     *
     * // Will allow autocomplete for 1, 2, and 3, and will not throw errors for other number or string values.
     * type Original = LooseAutocompleteB<number | string, 1 | 2 | 3>; // 1 | 2 | 3 | (Omit<number | string, 1 | 2 | 3> & (number | string))
     *
     * // Will allow autocomplete for "a", 45, and "fhsd", and will not throw errors for other number, symbol, or string values.
     * type Original = LooseAutocompleteB<string | number | symbol, "a" | 45 | "fhsd">; // "a" | 45 | "fhsd" | (Omit<string | number | symbol, "a" | 45 | "fhsd"> & (string | number | symbol))
     * ```
     */
    type LooseAutocompleteB<U extends string | number | symbol, T extends U> = T | (Omit<U, T> & U);
    /**
     * Splits a string into an array of characters.
     *
     * @template S The string to split.
     *
     * @example
     * ```ts
     * type Original = Split<"abc">; // ["a", "b", "c"]
     * ```
     */
    type Split<S extends string> = S extends "" ? [] : S extends `${infer C}${infer R}` ? [C, ...Split<R>] : never;

    /**
     * Takes the first N elements from a tuple type.
     *
     * @template T The tuple type to take elements from.
     * @template N The number of elements to take.
     * @template Result The result type, defaulting to an empty array.
     *
     * @example
     * ```ts
     * type Original = TakeFirstNElements<[1, 2, 3, 4], 2>; // [1, 2]
     * ```
     */
    type TakeFirstNElements<T extends any[], N extends number, Result extends any[] = []> = Result["length"] extends N
        ? Result
        : T extends [infer First, ...infer Rest]
        ? TakeFirstNElements<Rest, N, [...Result, First]>
        : Result;

    /**
     * Takes the last N elements from a tuple type.
     *
     * @template T The tuple type to take elements from.
     * @template N The number of elements to take.
     * @template Result The result type, defaulting to an empty array.
     *
     * @example
     * ```ts
     * type Original = TakeLastNElements<[1, 2, 3, 4], 2>; // [3, 4]
     * ```
     *
     * @author 8Crafter
     */
    export type TakeLastNElements<T extends any[], N extends number, Result extends any[] = []> = Result["length"] extends N
        ? Result
        : T extends [...infer Rest, infer Last]
        ? TakeFirstNElements<Rest, N, [Last, ...Result]>
        : Result;

    /**
     * Joins an array of strings into a single string.
     *
     * @template T The array of strings to join.
     * @template J The separator to use, defaulting to an empty string.
     *
     * @example
     * ```ts
     * type Original = Join<["a", "bcc", "de"]>; // "abccde"
     * ```
     */
    type Join<T extends (string | number)[], J extends string | number = ""> = T extends []
        ? ""
        : T extends [infer Head, ...infer Tail]
        ? Head extends string | number
            ? `${Head}${Tail extends [string | number, ...(string | number)[]] ? J : ""}${Join<Tail extends (string | number)[] ? Tail : [], J>}`
            : never
        : never;

    /**
     * Cuts the first N characters from a string.
     *
     * @template S The string to cut.
     * @template N The number of characters to cut.
     *
     * @example
     * ```ts
     * type Original = CutFirstChars<"abcdef", 2>; // "cdef"
     * ```
     */
    type CutFirstChars<S extends string, N extends number, SArray = TakeFirstNElements<Split<S>, N>> = Join<SArray extends string[] ? SArray : never>;

    /**
     * Mutates the type by removing the optional modifier (`?`) from all properties.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { readonly name?: string; age?: number };
     * type Mutated = MutableRequired<Original>; // { readonly name: string; age: number }
     * ```
     */
    type Full<T> = {
        [P in keyof T]-?: T[P];
    };

    /**
     * Mutates the type by making all properties `readonly`, recursively.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { name: string; age: number }
     * type Mutated = ReadonlyDeep<Original>; // { readonly name: string; readonly age: number }
     * ```
     */
    type ReadonlyDeep<T> = {
        readonly [P in keyof T]: ReadonlyDeep<T[P]>;
    };

    /**
     * Mutates the type by removing the `readonly` modifier from all properties, recursively.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { readonly name: string; readonly age: number };
     * type Mutated = MutableDeep<Original>; // { name: string; age: number }
     * ```
     */
    type MutableDeep<T> = {
        -readonly [P in keyof T]: MutableDeep<T[P]>;
    };

    /**
     * Mutates the type by making all properties optional and allowing for deep partials.
     *
     * @template T The type to mutate.
     *
     * @example
     * ```ts
     * type Original = { name: string; age: number }
     * type Mutated = DeepPartial<Original>; // { name?: string; age?: number }
     * ```
     */
    export type DeepPartial<T> = T extends object
        ? {
              [P in keyof T]?: DeepPartial<T[P]>;
          }
        : T;
    type KeysOfUnion<T> = T extends T ? keyof T : never;
    type ValueTypes<T> = T extends { [key: string]: infer U } ? U : never;
    type AllValues<T> = T extends { [key: string]: infer V } ? V : never;
    type KeyValuePairs<T> = {
        [K in KeysOfUnion<T>]: AllValues<Extract<T, Record<K, any>>>;
    };
    /**
     * @see https://stackoverflow.com/a/58986589
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type ExcludeFromTuple<T extends readonly any[], E> = T extends [infer F, ...infer R]
        ? [F] extends [E]
            ? ExcludeFromTuple<R, E>
            : [F, ...ExcludeFromTuple<R, E>]
        : [];
    type IncludeFromTuple<T extends readonly any[], E> = T extends [infer F, ...infer R]
        ? [F] extends [E]
            ? [F, ...IncludeFromTuple<R, E>]
            : IncludeFromTuple<R, E>
        : [];
    type NullableArray<T extends any[] | readonly any[]> = T | [null, ...T] | [...T, null];
    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type WritableKeys<T> = {
        [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>;
    }[keyof T];

    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type ReadonlyKeys<T> = {
        [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>;
    }[keyof T];

    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type RequiredKeys<T> = {
        [K in keyof T]-?: NonNullable<unknown> extends { [P in K]: T[K] } ? never : K;
    }[keyof T];

    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type OptionalKeys<T> = {
        [K in keyof T]-?: NonNullable<unknown> extends { [P in K]: T[K] } ? K : never;
    }[keyof T];

    /**
     * @see https://stackoverflow.com/a/49579497/16872762
     *
     * @author jcalz <https://stackoverflow.com/users/2887218/jcalz>
     */
    type ExcludeOptionalProps<T> = Pick<T, RequiredKeys<T>>;

    /**
     * @author 8Crafter
     */
    type ExcludeRequiredProps<T> = Pick<T, OptionalKeys<T>>;

    /**
     * @author 8Crafter
     */
    type ExcludeWritableProps<T> = Pick<T, ReadonlyKeys<T>>;

    /**
     * @author 8Crafter
     */
    type ExcludeReadonlyProps<T> = Pick<T, WritableKeys<T>>;

    /**
     * @author 8Crafter
     */
    type ExcludeMethods<T> = Pick<
        T,
        {
            [K in keyof T]: T[K] extends (...args: any[]) => any ? undefined : K;
        }[keyof T]
    >;

    /**
     * @author 8Crafter
     */
    type MergeObjectTypes<T> = { [key in keyof T]: T[key] };

    /**
     * @author 8Crafter
     */
    type DeepMergeObjectTypes<T> = { [key in keyof T]: T[key] extends object ? MergeObjectTypes<T[key]> : T[key] };

    /**
     * @author 8Crafter
     */
    type PropertyNamesWithPath<T> = T extends object
        ? {
              [K in string & keyof T]: T[K] extends Date | undefined
                  ? K // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? K | `${K & string}.${PropertyNamesWithPath<A>}` // On arrays, continue with the parameterized type
                  : K | `${K & string}.${PropertyNamesWithPath<T[K]>}`;
          }[string & keyof T]
        : never;

    /**
     * @author 8Crafter
     */
    type PropertyNamesInner<T, U = keyof T> = T extends object
        ? {
              [K in U & keyof T]: T[K] extends Date | undefined
                  ? K // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? K | PropertyNamesInner<A> // On arrays, continue with the parameterized type
                  : K | PropertyNamesInner<T[K]>;
          }[U & keyof T]
        : never;

    /**
     * @author 8Crafter
     */
    type PropertyNames<T, U = string | number> = VerifyConstraint<PropertyNamesInner<T, U>, U>;

    /**
     * @author 8Crafter
     */
    type PropertyNamesWithPathWithoutOuterContainingProperties<T> = T extends object
        ? {
              [K in string & keyof T]: T[K] extends Date | undefined
                  ? K // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? K | `${K & string}.${PropertyNamesWithPathWithoutOuterContainingProperties<A>}` // On arrays, continue with the parameterized type
                  : (T[K] extends object ? never : K) | `${K & string}.${PropertyNamesWithPathWithoutOuterContainingProperties<T[K]>}`;
          }[string & keyof T]
        : never;

    /**
     * @author 8Crafter
     */
    type PropertyNamesInnerWithoutOuterContainingProperties<T, U = keyof T> = T extends object
        ? {
              [K in U & keyof T]: T[K] extends Date | undefined
                  ? K // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? K | PropertyNamesInnerWithoutOuterContainingProperties<A> // On arrays, continue with the parameterized type
                  : (T[K] extends object ? never : K) | PropertyNamesInnerWithoutOuterContainingProperties<T[K]>;
          }[U & keyof T]
        : never;

    /**
     * @author 8Crafter
     */
    type PropertyNamesWithoutOuterContainingProperties<T, U = string | number> = VerifyConstraint<PropertyNamesInnerWithoutOuterContainingProperties<T, U>, U>;

    /**
     * @author 8Crafter
     */
    type PropertyPaths<T> = T extends object
        ? {
              [K in (string | number) & keyof T]: T[K] extends Date | undefined
                  ? [K] // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? [K] | [K, ...PropertyPaths<A>]
                  : [K] | [K, ...PropertyPaths<T[K]>];
          }[(string | number) & keyof T]
        : never;

    /**
     * @author 8Crafter
     */
    type PropertyPathsWithoutOuterContainingProperties<T> = T extends object
        ? {
              [K in (string | number) & keyof T]: T[K] extends undefined
                  ? never
                  : T[K] extends Date | undefined
                  ? K // Stop recursion on Date
                  : T[K] extends Array<infer A> | undefined
                  ? [K] | [K, ...PropertyPathsWithoutOuterContainingProperties<A>]
                  : (T[K] extends object ? never : [K]) | [K, ...PropertyPathsWithoutOuterContainingProperties<T[K]>];
          }[(string | number) & keyof T]
        : never;

    type GetPropertyValueAtPath<T extends object, U extends PropertyPaths<T> | []> = U extends [infer K]
        ? T[K]
        : U extends [infer K, ...infer R]
        ? GetPropertyValueAtPath<T[K], R>
        : T;

    /**
     * @author 8Crafter
     */
    type VerifyConstraint<T, U> = T extends U ? T : never;

    /**
     * @author 8Crafter
     */
    type IncludesNever<T extends any[]> = { [K in keyof T]: T[K] extends never ? unknown : never }[number] extends never ? false : true;

    type NeverValueKeys<T extends object> = { [K in keyof T]: T[K] extends never ? K : never }[keyof T];

    type OmitNeverValueKeys<T extends object> = Omit<T, NeverValueKeys<T>>;

    /**
     * @see https://stackoverflow.com/a/60822641/16872762
     */
    export type ReturnTypeWithArgs<T extends (...args: any[]) => any, ARGS_T> = Extract<
        T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2; (...args: infer A3): infer R3; (...args: infer A4): infer R4 }
            ? [A1, R1] | [A2, R2] | [A3, R3] | [A4, R4]
            : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2; (...args: infer A3): infer R3 }
            ? [A1, R1] | [A2, R2] | [A3, R3]
            : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2 }
            ? [A1, R1] | [A2, R2]
            : T extends { (...args: infer A1): infer R1 }
            ? [A1, R1]
            : never,
        [ARGS_T, any]
    >[1];
}
