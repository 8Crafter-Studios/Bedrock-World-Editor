/**
 * A list of URI protocols that are allowed to be opened by clicking on an integration link button without prompting the user.
 */
export const INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS: string[] = ["mailto:"];

/**
 * A list of URI protocols that are classified as website protocols so have a slightly different prompt.
 */
export const INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS: string[] = ["http:", "https:"];
