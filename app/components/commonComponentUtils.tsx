/**
 * The contents of a component message.
 */
export interface ComponentMessageContents {
    /**
     * The type of the contents.
     *
     * - `text`: The contents are plain text.
     * - `html`: The contents are HTML.
     */
    type: "text" | "html";
    /**
     * The contents of the message.
     */
    content: string;
}
