// export function getPropertyAtPath<T extends { [key: string]: any }, P extends [PropertyPaths<T>[0]?, PropertyPaths<T>[1]?, PropertyPaths<T>[2]?], PK extends P[1]>(obj: T, path: P): P extends PropertyPaths<T> ? GetPropertyValueAtPath<T, P> : undefined
export function getPropertyAtPath<T extends object, P extends [LooseAutocompleteB<string | number, "" | 0>?, ...LooseAutocompleteB<string | number, "" | 0>[]]>(
    obj: T,
    path: P
):
    | P extends PropertyPaths<T> | []
          ? GetPropertyValueAtPath<T, P>
          : IncludesNever<ConstrainPathToObjectPropertyPaths<T, P>> extends true
          ? undefined
          : GetPropertyValueAtPath<T, VerifyConstraint<ConstrainPathToObjectPropertyPaths<T, P>, PropertyPaths<T>>> | undefined {
    /* export function getPropertyAtPath<
    T extends object,
    P extends
        | PropertyPaths<T>
        | {
              [key in keyof [...PropertyPaths<T>, ...LooseAutocompleteB<string | number, "" | 0>[]]]?:
                  | [...PropertyPaths<T>, ...LooseAutocompleteB<string | number, "" | 0>[]][key]
                  | LooseAutocomplete<"">;
          }
>(obj: T, path: P): P extends PropertyPaths<T> ? GetPropertyValueAtPath<T, P> : undefined */ return path.length === 0
        ? (obj as any)
        : ((path as any[]).reduce((acc: any, key: any): any => acc[key as any] as any, obj as any) as any);
}
type ConstrainPathToObjectPropertyPaths<
    T extends object,
    P extends [LooseAutocompleteB<string | number, "" | 0>?, ...LooseAutocompleteB<string | number, "" | 0>[]]
> = { [key in keyof P]: VerifyConstraint<P[key], PropertyPaths<T>[VerifyConstraint<key, keyof PropertyPaths<T>>]> };
