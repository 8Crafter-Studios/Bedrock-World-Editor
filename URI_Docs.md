# Bedrock World Editor URI Documentation

This is the list of all supported URIs for the Bedrock World Editor.

The Bedrock World Editor uses the following URI protocol: `bedrock-world-editor://`.

## `openFile?path=<file_path: URLEncodedPath>`

Opens the file at the given path.

If the file extension is not recognized, the file will be opened as a binary file in the hex editor.

Otherwise, it will try to open the file with the appropriate tab type based on the file extension.

### Arguments

#### `file_path: URLEncodedPath`

The path to the file to open.

Should be a URL encoded string of the absolute path to the file.

## `openFile?path=<file_path: URLEncodedPath>&type=<tab_type: TabType>`

Opens the file at the given path with the given tab type.

### Arguments

#### `file_path: URLEncodedPath`

The path to the file to open.

Should be a URL encoded string of the absolute path to the file.

#### `tab_type: TabType`

The file type category to open the file with.

Supported values are:

- `nbt` - Open the file as an NBT file, the tab will have an NBT editor.
- `json` - Open the file as a JSON file, the tab will have a JSON editor.
- `xml` - Open the file as an XML file, the tab will have an XML editor.
- `text` - Open the file as a plain text file, the tab will have a text editor.
- `binary` - Open the file as a binary file, the tab will have a hex editor.
- `unset` - The same as not specifying this argument at all.

## `openLevelDBFolder?path=<folder_path: URLEncodedPath>`

Opens the LevelDB folder at the given path.

### Arguments

#### `folder_path: URLEncodedPath`

The path to the LevelDB folder to open.

Should be a URL encoded string of the absolute path to the folder.

## `openWorldFolder?path=<folder_path: URLEncodedPath>`

Opens the world folder at the given path.

Example: `bedrock-world-editor://openWorldFolder?path=C%3A%5CUsers%5Cander%5CAppData%5CRoaming%5CMinecraft%20Bedrock%5CUsers%5C17819506097255665204%5Cgames%5Ccom.mojang%5CminecraftWorlds%5Cj3ETLhAXDm0%3D`

### Arguments

#### `folder_path: URLEncodedPath`

The path to the world folder to open.

Should be a URL encoded string of the absolute path to the folder.

## `about`

Opens the about dialog.

Example: `bedrock-world-editor://about`

## (no path, just `bedrock-world-editor://`)

Focuses the last focused window of the app.
