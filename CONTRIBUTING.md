# How to contribute

TO-DO

## Building Locally

If you want to build the app locally, do the following:

1.  Clone this repository.
2.  Run `npm i`.
3.  Run `npm run make`.
4.  Look in the `out/make` directory for the installer.

## Testing Locally

If you want to locally run the app without having to wait to the installer to build, or if you are developing it, do the following:

1.  Clone this repository.
2.  Run `npm i`.
3.  Run `npm run start`.

## Code Style

> [!NOTE]  
> This section is a work in progress, and currently only lists a few rules.

> [!IMPORTANT]  
> Key word meanings:
>
> -   **MUST** - This is required.
> -   **MUST NOT** - This is not allowed.
> -   **SHOULD** - This should be done if possible and is HIGHLY recommended, but not required.
> -   **SHOULD NOT** - This should not be done if it can be avoided, but allowed if necessary.
> -   **ENCOURAGED** - This is gently recommended but not required, if you don't have the time to do it, don't worry.
> -   **DISCOURAGED** - This is gently discouraged but allowed if it is much quicker to do it than the alternative, but still recommended to do the alternative if you have the time.

-   When writing a function, getter, setter, or constructor, if it can throw an error (even if by a function called inside the function that is not caught), it **MUST** have a `@throws` TSDoc tag, and preferrably have a separate `@throws` TSDoc tags for each error that specifies the error type and a description of the error, it also **SHOULD** specify errors that can be triggered by function calls inside the function that are not caught.
-   When implementing a method, getter, or setter of an interface, it may only throws errors if the declaration of the method has a `@throws` TSDoc tag or has no TSDoc comment at all. If the declaration of the method has a TSDoc comment, but not a `@throws` TSDoc tag, then the method **MUST NOT** throw errors and any possible errors by function calls inside the method **MUST** be caught and handled.
-   Optional properties **SHOULD** either have a `@default` TSDoc tag or specify what happens if the property is not provided.
-   `@example` TSDoc tags are **ENCOURAGED**.
-   `@example` TSDoc tags **MUST** be placed after `@default` TSDoc tags.

### Code Comment Labels

This is the list of code comment labels that are used in this repository:

#### `TODO`

A task that needs to be done.

Used for: unfinished features, missing logic, follow-up work.

#### `FIXME`

Something is wrong and must be fixed.

Stronger than TODO, implies broken behavior.

#### `BUG`

A known bug exists at this location.

Used to mark specific logic that produces incorrect or unintended behavior.

#### `HACK`

A workaround or non-ideal solution that functions but should be replaced.

Used when the code works but is not clean, stable, or maintainable long-term.

#### `XXX`

A warning that this code is tricky, fragile, or requires extra attention.

Used for confusing logic, dangerous assumptions, or code with subtle side effects.

#### `NOTE`

Additional context or explanation for future readers.

Used to clarify intent, document reasoning, or highlight important details.

#### `DEBUG`

Temporary debugging code or logs.

Used for instrumentation that should be removed before merging or releasing.

#### `OPTIMIZE`

This code works but is inefficient or suboptimal.

Used to mark areas where performance improvements are desired.

#### `REVIEW`

This logic should be double-checked by another contributor.

Used when code is uncertain, complex, or requires a second opinion.

#### `DEPRECATED`

This code is outdated and should not be used for new work.

Used when a newer or better alternative exists and migration is expected.

#### `UNDONE`

A previously implemented feature or change has been intentionally reverted.

Used to document partial rollbacks or removed functionality.

#### `WARNING`

A caution about potential pitfalls, edge cases, or unsafe assumptions.

Used to highlight areas where misuse or misunderstanding could cause issues.

#### `CAUTION`

Similar to WARNING, but often used for logic that is fragile or risky.

Used when code may break easily or relies on unstable conditions.

#### `IDEA`

A suggestion for a future enhancement or alternative approach.

Used to capture potential improvements without committing to them.

#### `TEMP`

Temporary code that will be replaced.

Used during refactors, experiments, or transitional work.

#### `REMOVE`

Code that should be deleted once it is safe to do so.

Used when cleanup is required but cannot be done immediately.

#### `TSC`

A TypeScript-specific note.

Used for compiler workarounds, type-system limitations, or places where `tsc` reports issues.

#### `INFO`

General informational comment.

Used to clarify behavior, document intent, or provide helpful context.
