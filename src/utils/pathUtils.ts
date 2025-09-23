/**
 * Checks if a string is a URI or a path.
 *
 * @param {string} URIOrPath The string to check.
 * @returns {"URI" | "Path"} "URI" if the string is a URI, "Path" if the string is a path.
 */
export function checkIsURIOrPath(URIOrPath: string): "URI" | "Path" {
    if (/^[^:/\\]+:\/\//.test(URIOrPath)) {
        return "URI" as const;
    } else {
        return "Path" as const;
    }
}
