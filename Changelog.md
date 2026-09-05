# v1.0.0-beta.35

## Critical Fixes

-   Fixed an issue where pasting in editors that used Monaco Editor did not work ([#1](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/1)).
-   Fixed many issues where the parser and serializer for the `SubChunkPrefix` content type did not work properly in certain situations.

## Additions

-   Windows builds are now code signed.
-   Added the paths to the world folder locations for the Minecraft Education Edition desktop version to the config.
-   Added the paths to the world folder locations for Minecraft Education Edition on macOS to the config.
-   Added paths to the extra world folder locations for Minecraft Education Edition, Minecraft Education Edition Preview, and the desktop version of Minecraft Education Edition, that are inside of mounted Windows volumes, to the config.
-   The "Create LevelDB Entry" button in sub-tabs now properly reloads the data of the sub-tab after creating the LevelDB entry.
-   The "Create LevelDB Entry" button in sub-tabs now attemps to use a default value based on the content type for the new LevelDB entry, rather than an empty NBT object or empty data.
-   When the associated LevelDB key for a `Map` sub-tab does not exist, there is now a "Create LevelDB Entry" button.
-   Added validation to insure the JSON in the Prismarine-NBT editor is valid Prismarine-NBT, this should fix the issue where after leaving invalid data in the editor and switching tabs or modes, the tab can go blank until you close and reopen it.
-   The state of the Prismarine-NBT and SNBT editors now persists across tab and mode switches (meaning undo history, scroll position, search, selection, etc. are preserved when you switch tabs or modes and then switch back).
-   The start screen is now more responsive for mobile and small window sizes.

## Changes

-   Pressing `ALT` no longer focuses/unfocuses the menu bar.
-   When the app recovers from a crash, it now closes and reopens the window, this fixes an issue where after a crash, the menu bar and many keybinds would not work.
-   The `SubChunkPrefixLayer` NBT schema and the `layers` field of the `SubChunkPrefix` content type no longer include a `storageVersion` field.

## Fixes

-   Fixed a bug where CTRL+S did not work while the Prismarine-NBT, SNBT, or text editor was focused.
-   Fixed an issue where deleting chunks in the 2D world map did not work ([#52](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/52)).
-   Many major NBT schema fixes, see the `mcbe-leveldb` changelog for more details (v1.0.0-beta.34 used v1.20.1 of `mcbe-leveldb`, this version uses v1.22.2).
-   The NBT schema for entity entries in the `Entity` content type now no longer has an `internalComponents` field.
-   Fixed an issue where there were many random useless `"name": ""` entries in the Prismarine-NBT editor.

# v1.0.0-beta.34

## Critical Fixes

-   Fixed an issue where when editing an `ActorPrefix` LevelDB entry, the `StorageKey` property could become corrupted if it contained certain byte values, as that property uses a binary-encoded string and it was being decoded as a UTF-8 string. This issue caused entities to duplicate when the world is loaded but also never actually load in the world, and they would show up as in "Unknown Dimension" in the "Entities" tab. That property is now parsed and written as a binary-encoded string rather than UTF-8.
-   Fixed an issue where the human-friendly versions of the `Digest` LevelDB keys always said that the key was for the Overworld, even if the key was for a different dimension.
-   Fixed an issue where entities that were in dimensions other than the Overworld would show up as in "Unknown Dimension" in the "Entities" tab.

## Additions

-   Added the "Packs" tab.
-   Added the Settings context menu to the 2D world map.
-   Added and option for setting whether the Heightmap is rendered by default on the 2D world map.
-   Added an option for toggling the chunk grid lines on the 2D world map.
-   Added and option for setting whether the chunk grid lines are rendered by default on the 2D world map.
-   Added full support to the 2D world map for regular and old world types that were used with the Caves & Cliffs experimental toggle or any of the 1.18.0 betas, or any combination thereof.
-   Added a "Replace Image (Pixelated)" option to the map editor, it is the same as "Replace Image" except it uses nearest neighbor scaling.
-   Added an "Overlay Image" option to the map editor, this option is the same as the "Replace Image" option's old behavior, where it draws the image on top of the existing map image.
-   Added an "Overlay Image (Pixelated)" option to the map editor, it is the same as "Overlay Image" except it uses nearest neighbor scaling.
-   LevelDB entries in the "Maps" tab now have a context menu with an option to delete them. The context menu also has options for copying the value of the table cell that was right clicked, with multiple format options depending on the column the cell was in.
-   The "Open LevelDB entry..." submenu of the context menu of the 2D world map now can show the `Digest` key associated with the chunk if it exists.
-   Documented the following properties of the `ActorPrefix` NBT schema:
    -   `internalComponents`
    -   `internalComponents.EntityStorageKeyComponent`
    -   `internalComponents.EntityStorageKeyComponent.StorageKey`

## Changes

-   Moved the Heightmap option of the 2D world map to the Settings context menu instead of the Overlays context menu.
-   The Nether portals overlay is now enabled by default on the 2D world map.

## Fixes

-   Fixed small seams that could sometimes appear in bewteen chunks on the 2D world map.
-   The "Replace Image" option of the map editor now correctly clears the existing map image before drawing the selected image onto the map.
-   The "Maps" tab now no longer unnecessarily loads the dynamic properties data.
-   The zoom buttons on the 2D world map now keep the map centered on the same position.

# v1.0.0-beta.33

## Critical Fixes

-   Fixed a bug where when applying biomes changes for the WorldEdit Bedrock integration, it could sometimes create corrupted chunks that would cause the world to crash.

## Additions

-   Added a button to the WorldEdit Bedrock integration menu to repair all chunks corrupted by applying biome changes, the repair does preserve those biome changes.
-   Added the "World" tab. This tab contains a 2D world map/editor.
-   The "New RandomTicks Entry" and "New PendingTicks Entry" buttons on the "Ticks" tab now allow you to create entries in custom dimensions.
-   The saving world popup window now showsw the current number of files that have been copied and the current file that is being copied.

## Changes

-   The app now reads the world name from `level.dat` or `level.dat_old` first and uses the name from `levelname.txt` only if it can't read from the `level.dat` or `level.dat_old` file, rather than the other way around.

# v1.0.0-beta.32

## Critical Fixes

-   Fixed a bug where the parser for the `Data3D` content type did not work when there were subchunks with storage types of `3`, `5`, or `6`.
-   Fixed a bug where the serializer for the `Data3D` content type could not write storage types of `3`, `5`, or `6`, and instead rounded them up to the nearest storage type it supported, which may or may not have caused crashes in some Minecraft worlds.
-   Fixed a bug where the content type for the following content types in some older worlds where the dimension was not part of the key could not be determined:
    -   `VillagePOI`
    -   `VillageInfo`
    -   `VillageDwellers`
    -   `VillagePlayers`
    -   `VillageRaid`

## Breaking Changes

-   The `dirty_columns` field of the `LegacyTerrain` NBT schema and parser/serializer has been renamed to `height_map`.
-   The `Data2D` NBT schema and parser/serializer now includes a `version` field.

## Additions

-   Added autocomplete/validation for general item tags and enchantments to items.
-   Added biome definitions for the Sulfur Caves and Dappled Forest.
-   Added support for the newer `Data2D` format version used in modern Minecraft versions which uses 16-bit little-endian integers for biome IDs instead of 8-bit integers.
-   Added an icon for sub-tabs of content type `ActorDigestVersion`.
-   Added an icon for sub-tabs of content type `Checksums`.
-   Added an icon for sub-tabs of content type `Digest`.
-   Added an icon for sub-tabs of content type `Entity`.
-   Added an icon for sub-tabs of content type `FlatWorldLayers`.
-   Added an icon for sub-tabs of content type `PositionTrackingDB`.
-   Added an icon for sub-tabs of content type `PositionTrackingLastId`.
-   Added an icon for sub-tabs of content type `RandomTicks`.
-   Added an icon for sub-tabs of content type `RealmsStoriesData`.

## Changes

-   Changed the icon for sub-tabs of content type `HardcodedSpawners` to have a cobweb on it, to distinguish it from the icon for sub-tabs of content type `AABBVolumes`.

## Fixes

-   Fixed a bug where there was no autocomplete/validation for many properties of the `Player` content type.
-   Fixed a bug where many properties of NBT schemas that were items did not have a reference to the `Item_ItemStack` NBT schema.
-   Many schema fixes.
-   Fixed a bug where tabs in the tab bars could not be dragged to rows below the first row.
-   Fixed a bug where the add tab popup menu was rendered below some elements.
-   Fixed a bug where the "Entities" left sidebar tab would show an error if there was corrupted or invalid `Digest` data.

# v1.0.0-beta.31

## Additions

-   Added support for automatic updates to macOS.
-   There is now a prompt to enable/disable automatic updates (on supported operating systems) (the prompt only appears once).
-   The `Help > Check for Updates...` menu bar item is now functional (on supported operating systems).
-   Added the hex editor.
-   All content types can now be edited in raw mode in the hex editor (except for ones that would open in the plain text editor, this will be fixed later).
-   Added a Clear Entries button to the "View Files" tab. This button deletes ALL entries from the LevelDB. When there is a search query, then the button only deletes the search results from the LevelDB rather than everything.
-   Added a placeholder New Entry button to the "View Files" tab. The button is disabled and does not work as it is a placeholder.
-   Added a `Reload Tab` context menu option to sub-tabs that do not have unsaved changes. This option behaves the same as the `Reset Tab` option (which appears when there are unsaved changes).
-   Added a new polished error screen for data loading/parsing error in sub-tabs, which includes a button to reopen the editor in raw mode, which should allow for bypassing the error.
-   Added an icon for sub-tabs of content type `AABBVolumes`.
-   Added an icon for sub-tabs of content type `BorderBlocks`.
-   Added an icon for sub-tabs of content type `DynamicProperties`.
-   Added an icon for sub-tabs of content type `ForcedWorldCorruption`.
-   Added an icon for sub-tabs of content type `GenerationSeed`.
-   Added an icon for sub-tabs of content type `HardcodedSpawners`.
-   Added a new polished error screen for when the LevelDB throws an error when being opened.
-   Added a new polished error screen for when the LevelDB is encrypted.
-   Added support for the [Bedrock World Editor - Player Name Saver](https://github.com/8Crafter-Studios/BWE-Player-Name-Saver/releases/latest) behavior pack for detecting player's names.
-   Reworked the search system for the Raw mode of the "Players" tab, it now has multiple search modes: `grouped`, `client`, and `server`. `grouped` search mode is not implemented yet so the option for it is disabled.
-   Added 3 new search queries to the "Players" tab: `msa_id`, `self_signed_id`, and `server_id`.
-   You can now close tabs and sub-tabs by middle clicking them.
-   The context menu for entries in the "View Files" tab now has options for copying the value of the table cell that was right clicked, with multiple format options depending on the column the cell was in.
-   The following content types now have JSON schemas in the Prismarine-NBT editor:
    -   `BorderBlocks`
    -   `HardcodedSpawners`
    -   `CustomDimension`
    -   `DimensionNameIdTable`
    -   `WorldClocks`
    -   `AABBVolumes`
    -   `BiomeState`
-   Added the paths to the world folder locations for the Minecraft Education Edition and Minecraft Education Edition Preview to the config.

## Changes

-   The "Repair Force World Corruption" button now appears and disappears automatically when the forced world corruption is repaired or applied.
-   Sub-tab icons are now rendered pixelated.
-   Icons in many UI elements are now rendered pixelated.

## Fixes

-   The `Reset Tab` context menu option on sub-tabs now correctly reloads the sub-tab.
-   The following tab no longer throw an error and fail to load when there is an entry with invalid or corrupted data.
    -   Maps
    -   Structures
    -   Entities
    -   Players
    -   Ticking Areas
    -   Ticks
-   Miscellaneous graphical fixes in light mode.
-   Fixed a crash that could occur when closing the active tab in some cases.
-   Miscellaneous typo fixes.
-   The Client ID column of the Server section of the Raw mode of the "Players" tab now shows all associated client IDs instead of only the last one.

# v1.0.0-beta.30

## Critical Fixes

-   Fixed a crash that could occur when the user's locale is not United States English.

# v1.0.0-beta.29

## Critical Fixes

-   Fixed a crash when Windows username contains non-Latin characters ([#32](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/32)).

## Additions

-   Add support for reading level names of really old MCPE alpha worlds ([#31](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/31)).
-   Added support for isolated Minecraft data folders, meaning you can select any folder that contains Minecraft world folders and the app can display them in the world list, even if that folder is not called `worlds` or `minecraftWorlds`.
-   Added an icon next to the version number on worlds in the world selection menu to indicate worlds that are in isolated Minecraft data folders.
-   Added a screen when none of the known Minecraft data folders exist (only appears when none of the 4 different Minecraft data folder categories have any matching existing folders), the screen tells you to go to settings to tell the app where your worlds are, with a button below the message to open the settings menu.
-   Added whether the world is isolated (i.e. in an isolated Minecraft data folder) to the hover text of worlds in the world selection menu.
-   Added 4 new settings to the "General" settings section:
    -   Minecraft Data Folders
    -   Isolated Minecraft Data Folders
    -   Extra Minecraft Data Folders
    -   Extra Isolated Minecraft Data Folders
-   Added the `%tmpdir%` variable to the parsers for Minecraft data folders, which corresponds to the `TMPDIR` environment variable.

## Changes

-   Favorited worlds now always show up, even if they resolve to the same real path as another detected world.
-   When loading the world list, world paths are now normalized to ensure duplicate paths are correctly detected.

## Fixes

-   Fixed a bug where string tags in lists in the tree editor had no value displayed ([#5](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/5)).

## Performance Improvements

-   The favorited worlds list is now cached when the world list starts loading, instead of it being read from the file and parsed for every world.

# v1.0.0-beta.28

## Critical Fixes

-   Fixed a bug where the serializer for the `Data3D` content type deleted all empty sub-chunks, resulting in sub-chunks that were supposed to have empty sub-chunks in between them all being moved to the bottom of the world without any empty gaps in between them, and also resulting in chunks with larger sub-chunk counts having their sub-chunk counts culled.

## Additions

-   Added paths to the world folder locations for LeviLauncher.
-   Added paths to the extra world folder locations for LeviLauncher inside of mounted Windows volumes.
-   Added support for the `DimensionNameIdTable` content type.
-   Added support for the `CustomDimension` content type.
-   Added an icon for sub-tabs of content type `BiomeIdsTable`.
-   Added an icon for sub-tabs of content type `CustomDimension`.
-   Added an icon for sub-tabs of content type `DimensionNameIdsTable`.
-   Added an icon for sub-tabs of content type `LevelChunkMetaDataDictionary`.
-   Added an icon for sub-tabs of content type `Nether`.
-   Added an icon for sub-tabs of content type `Overworld`.
-   Added an icon for sub-tabs of content type `TheEnd`.
-   Added support for custom dimensions.
-   The app's version now includes a build number.
-   The "Top" debug overlay now includes the app's build number in the version number when running in development mode.
-   The "Basic" debug overlay now includes the app's build number in the version number.
-   The world menu now includes the app's build number in the version number when running in development mode.
-   The `app` version field of the about menu now includes the app's build number, followed by an asterisk when running in development mode.
-   Added custom dimension support when applying biome changes for the WorldEdit Bedrock integration.
-   Added more error types when applying pending biome changes for the WorldEdit Bedrock integration.
-   Added the versions of the `mcbe-leveldb` and `@8crafter/leveldb-zlib` node modules to the about window.
-   Added a copyright string to the about window.
-   Added support for displaying the dimension of entities that are in custom dimensions in the "Entities" tab (it displays the namespaced ID of the dimension in normal mode (or the numeric ID if the corresponding namespaced ID cannot be found) and the numeric ID in compact mode).

### NBT Schemas

-   The `WorldClocks` NBT schema is now complete (aside from documentation).
-   Added examples to the `BiomeOverride` field of the `LevelDat` NBT schema.
-   The boolean properties of the `abilities` field of the `Abilities` NBT schema now have enums.

## Changes

-   The config now stores the build number of the most recent version of the app it was last modified in.

## Fixes

-   When applying biomes changes for the WorldEdit Bedrock integration, biomes can now be set for sub-chunks with no biome data.
-   When applying biomes changes for the WorldEdit Bedrock integration, biomes can now be set for missing sub-chunks if they are not out of the bounds defined in the LevelChunkMetaDataDictionary (biomes can still be set for existing sub-chunks that are out of bounds if they are too far up, if they are below the minimum height then they cannot be set, like before) (worlds which do not have a LevelChunkMetaDataDictionary will not be able to apply changes to missing sub-chunks).
-   Fixed a bug where you could not export the binary data of sub-tabs that threw an error when parsing their data.

# v1.0.0-beta.27

## Additions

-   Added support for Minecraft world container folders that contain a `worlds` folder instead of a `minecraftWorlds` folder, to allow for BDS support.

# v1.0.0-beta.26

## Additions

-   Added paths to the extra world folder locations for allowing reading worlds from volumes mounted inside the `mounted_volumes` folder inside of the app's data folder. This includes all the same locations inside of the mounted volumes as volumes mounted inside of `/Volumes`.
-   Added paths to the world folder locations for UWP Minecraft and Minecraft Preview inside of mounted Windows volumes.

## Fixes

-   Refreshing the world list now respects whether you have clicked the "Show more" button.

# v1.0.0-beta.25

## Additions

-   Added the paths to the world folder locations for Minecraft and Minecraft Preview running through a virtual machine on macOS with the virtual machine's C drive mounted on the host machine to the config. These paths are in the extra category, so they only appear in the world selection menu when you click on "Show more".
-   Added the paths to the world folder locations for Minecraft and Minecraft Preview from an iPhone mounted on macOS or Linux in the `Volumes` folder with ifuse (this works over Wi-Fi too, not just with a cable) (this supports both mounting in documents and container mode). These paths are in the extra category, so they only appear in the world selection menu when you click on "Show more". iPhones can also have their Minecraft documents folders mounted on Windows and Linux, but for Windows you will need to manually add the mounting paths to the config. A tutorial on how to mount the worlds can be found [here](Editing_iOS_Worlds.md).

## Changes

-   The "Config" debug overlay now does not show if entries in the "Minecraft Data Folders" and "Extra Minecraft Data Folders" sections had any glob matches temporarily, as this was not accurate before, it just went based on index which gave completely wrong results, for now it just shows `[?]` for the status of the entries, this will be fixed in the future.

# v1.0.0-beta.24

## Additions

-   Added a "Recent Worlds" submenu to the dock menu on macOS.
-   Added a "New Window" option to the dock menu on macOS.
-   Added the version the world was created in to the hover text of worlds in the world selection menu.
-   Added an icon next to the version number on worlds in the world selection menu to indicate worlds that can only be seen when using the Bedrock Editor ([#10](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/10)).

## Changes

-   The new version popup now trims the release notes to a maximum of 10 lines and 2000 characters.
-   The new version popup now prepends a v to the current version.
-   Made the OS and GPU strings in the "Top" and "Basic" debug overlays cleaner.
-   The CPU string in the "Basic" debug overlay now includes the number of cores.
-   On macOS, the keyboard shortcut to open a new window has been switched from CTRL+N to CMD+N.
-   The version number on the main menu now has an asterisk when running the application in development mode.
-   The version number on the "Top" debug overlay now has an asterisk when running the application in development mode.
-   The process and system uptimes in the "Basic" debug overlay are now formatted as `DD:HH:MM:SS` instead of just seconds.

## Fixes

-   Fixed a bug where on macOS, to see the hover info of a world in the world selection menu, you had to hover over the bottom of the world button.

# v1.0.0-beta.23

## Additions

-   Added Async Mode to several left sidebar tabs. Async mode loads NBT data for entries only when the page containing them is selected or when searching through them. Async mode also only computes the components for the entries that are on the current page. It loads data as needed and unloads it after, this makes the left sidebar tab load faster initially and dramatically reduces memory usage, but makes it slightly slower to switch between pages, and makes searching through entries a lot slower. By default, it is automatically determined whether async mode should be used based on the number of entries in the left sidebar tab and the total number of LevelDB keys in the world. However, Async Mode can also be enabled or disabled manually in the settings, the thresholds for the number of entries and the total number of LevelDB keys can also be changed. Support for this feature will be added to more left sidebar tabs in the future. It is currently supported for the following left sidebar tabs:
    -   Entities
    -   Maps
-   The "Entities" tab now supports reading entities' dimensions from the digests. This will be automatically disabled when there are 100,000 or more Digest LevelDB keys in the world to remove the large delay caused by large numbers of Digest keys when opening the "Entities" tab, this threshold can be changed in the settings.
-   Added 4 new settings to the "Advanced" settings section:
    -   Use Async Mode in Entry Views
    -   Async Mode Entry Threshold
    -   Async Mode Total Key Count Threshold
    -   No Lookup Entity Dimension Digest Key Threshold
-   The following tabs now have more informative loading screens:
    -   Entities
    -   Maps
    -   Players
    -   Structures
    -   Ticking Areas
    -   Ticks
    -   View Files
-   Added a loading message when only some but not all integration actions in an integration menu have loaded.
-   The loading message when no integration actions have finished loading yet now has an animation.
-   Added search filters to the "Maps" tab:
    -   `dimension`
    -   `id`
    -   `parentid`
    -   `locked`
    -   `scale`
-   Added handling for window crashes.
-   Added formatting to large numbers on the "Tab" debug overlay.
-   Added support for the `WorldClocks` content type.
-   Added a popup when opening a world if you don't have enough storage space to open it.
-   Added more detailed memory information to the "Basic" debug overlay.

## Fixes

-   Fixed a bug where entries in the Node editor could not be collapsed after switching tabs or editors ([#24](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/24)).
-   Fixed a bug where the expansion state of the top level of the Node editor for data types other than `NBT` was not saved when switching tabs or editors.
-   Fixed a bug where numerical values of `0` in NBT searches would result in the value check being skipped, causing all values to match.
-   Fixed a bug where path-specific NBT searches were validated against all values of ByteArrays, ShortArrays, IntArrays, and LongArrays, even if the paths did not match, resulting in a value match in any of those arrays being counted.
-   Fixed a bug where the displayed memory usage in the debug overlays used RSS size instead of heap size, resulting in incorrect memory usage numbers (where it may say over 100% usage when really it is only 40%).

## Performance Improvements

-   Fixed lag caused by the "Tab" debug overlay on large worlds.
-   Left sidebar tabs now abort loading when you switch to a different tab while the world is still loading the LevelDB keys.
-   Searching in tabs that have a "Searching LevelDB" loading screen is now slightly faster.
-   The "Searching LevelDB" loading screen now formats the entry counts and displays the number of currently found results.

# v1.0.0-beta.22

## Additions

-   Added more error types when applying pending biome changes for the WorldEdit Bedrock integration.
-   Added warning types when applying pending biome changes for the WorldEdit Bedrock integration.
-   When applying pending biome changes for the WorldEdit Bedrock integration, if the LevelChunkMetaDataDictionary is present, but the chunk has no meta data hash, the application will attempt to infer the minimum height of the chunk from the length of the biome subchunk array of the Data3D entry and show a warning if it was able to infer it and an error otherwise. When applying the changes, if any chunkks have this warning, a popup will be shown asking users whether they would like the application to use the inferred minimum height of the chunk to apply the changes to it. This should add support for worlds converted from Java to Bedrock which may not have meta data hashes set for some chunks depending on the converter.

# v1.0.0-beta.21

## Additions

-   Added a "Reload Tab" option to the context menu of tabs to close and re-open the tab, discarding any unsaved changes and reloading the data to use the latest world data.
-   Added a new setting on macOS to set whether the app should automatically quit when all windows are closed (this setting is disabled by default).
-   LevelDB entries in the "View Files" tab now have a context menu with an option to delete them.
    -   NOTE: This feature is currently bugged for the "View Files" tab where it does not correctly refresh the tab to remove the deleted entry from the list, so you will have to switch to another tab and back to the "View Files" tab for it to update properly.
-   Added additional metadata to the RPM and DEB builds.
-   Added the `appCopyright` metadata field.

### NBT Schemas

-   Added the `y_2026_drop_1` property to the `experiments` property of the `LevelDat` NBT schema.

## Fixes

-   Fixed a bug where the export structures feature of the WorldEdit Bedrock integration did not work properly for structures with custom namespaces or structures that fit within a single structure chunk (less than or equal to 64x128x64 blocks in size).
-   Fixed the application name on Linux being "bedrock-world-editor" instead of "Bedrock World Editor".
-   The language service and editor workers for Monaco Editor are now functional in production builds.

### NBT Schemas

-   Fixed many markdown links in the NBT schemas that had spaces instead of underscores.

# v1.0.0-beta.20

## Additions

-   Added support for editing the `LegacyTerrain` content type.
-   Added support for editing the `Data2D` content type.
-   Added support for editing the `Data2DLegacy` content type.
-   Added support for editing the versions `0x00`, `0x01`, `0x02`, `0x03`, `0x04`, `0x05`, `0x06`, and `0x07` of the `SubChunkPrefix` content type.
-   Added full JSON schema support to the Prismarine-NBT editor.
    -   All content types that are editable in the Prismarine-NBT editor have JSON schemas except for `MVillages` and `Villages`.
-   Clicking on the app's icon on the world selection menu will now refresh the world list.
-   Added an "Export As..." submenu to the context menu of sub-tabs to allow for exporting the contents of a LevelDB entry to a file.
    -   It currently supports the following formats:
        -   Binary
        -   Prismarine-NBT JSON
        -   Prismarine-NBT JSON (+Metadata)
        -   SNBT
        -   JSON
        -   Plain Text
-   Added hover text to a few options in the context menu of tabs to tell you that holding ALT while clicking the option causes the option to save the tab in unsafe mode.
-   Added the ability to open sub-tabs in the background instead of immediately switching to them upon opening them by clicking on them while holding ALT (as an alternative for people who don't have a scroll wheel button).
-   Added two new button to the "Ticks" tab to allow creating new `PendingTicks` and `RandomTicks` LevelDB entries (a similar feature will be added to other tabs in the future).
-   LevelDB entries in the "Ticks" tab now have a context menu with an option to delete them (this feature will be added to other tabs in the future).
-   Added support for Control+Click (macOS only) and the context menu key being able to open context menus like right-clicking.

## Changes

-   The `Dimension` content type has been split up into three new content types:
    -   `Overworld`
    -   `Nether`
    -   `TheEnd`
-   The `LegacyDimension` content type has been split up into three new content types:
    -   `LegacyOverworld`
    -   `LegacyNether`
    -   `LegacyTheEnd`

## Fixes

-   Fixed a bug where widgets in the Prismarine-NBT and SNBT editors were cut off by the edges of the editor instead of overflowing.
-   Fixed a bug where the recent worlds and folders sections on the taskbar jump list on Windows were removed upon opening the app and were only restored when a tab was opened.

# v1.0.0-beta.19

## Additions

-   macOS builds are now signed and notarized.
    -   This also fixes the issue with the recently opened history was not working on macOS.

# v1.0.0-beta.18

## Additions

-   Integration menus now display the integration's name, author, icon, and description.
-   macOS builds now have icons.
-   Added the paths to the world folder locations for Minecraft and Minecraft Preview running through PlayCover on macOS to the config.

## Changes

-   Header text in integration menus is no longer selectable.
-   Minor design changes to integration menus.

# v1.0.0-beta.17

## Critical Fixes

-   Fixed an issue where the Data3D serializer could corrupt the data by serializing it with a number of bits per block that 32 was not divisible by (also made the parser able to parse those corrupted subchunks, though the referenced palette indices in the values arrays will likely be incorrect for those corrupted subchunks). This fix also fixes the issue mentioned in the `v1.0.0-beta.16` changelog.

# v1.0.0-beta.16

## Fixes

-   Added a temporary "band-aid" fix for a very rare bug where with some very specific chunks, the WorldEdit Bedrock integration would throw an error upon attempting to apply biome changes to that chunk due to failing to parse the Data3D data of that chunk.

# v1.0.0-beta.15

## Additions

-   Added a text editor.
-   Added support for editing the `Digest` content type.
-   Added support for editing the `LevelChunkMetaDataDictionary` content type.
-   Added support for the `ChunkLoadedRequest` content type.
-   Added support for the `BiomeIdsTable` content type.
-   Added support for the `BiomeIdsTable` NBT schema.
-   Added support for the `VillageRaid` content type.
-   Added support for the `VillageRaid` NBT schema.
-   Added support for the `PositionTrackingDB` content type.
-   Added support for the `PositionTrackingLastId` content type.
-   Added support for the `GenerationSeed` content type.
-   Added support for the `LegacyDimension` content type.
-   Added support for the `MVillages` content type.
-   Added support for the `Villages` content type.
-   Added support for the `LevelSpawnWasFixed` content type.
-   Added the ability to scroll the debug overlay with `Shift+F3` and `Shift+F4`.
-   Added a `Discord` button to the `Help` menu.
-   Added the "Integrations" tab.
-   Added an integration with the [WorldEdit Bedrock](https://github.com/SIsilicon/WorldEdit-BE) add-on.
-   The left sidebar is now scrollable.
-   The lock icon of read-only tabs now has hover text.
-   The bullet point modified icons of tabs and sub-tabs now have hover text.
-   Changed the hover text of the close button of sub-tabs from `"Close (Shift to Close Without Saving)"` to `"Save & Close (Shift to Close Without Saving)"`.
-   Holding Shift while clicking the X button of a tab now closes it without saving without a prompt, holding Ctrl+Shift saves and closes the tab.
-   Added a warning before opening a world in Direct Mode.
-   Added the following details to the hover text of worlds in the world selection menu:
    -   Start Count
    -   Play Time
    -   Game Mode
    -   If the world is in hardcore mode.
    -   Multiplayer/Singleplayer
    -   If the world was from a locked template.
    -   If the world was from a world template.
    -   If the world is a single use world.
    -   If the world is only visible in editor mode.
    -   If the world was created in editor mode.
-   Added the ability to open sub-tabs in the background instead of immediately switching to them upon opening them by clicking with the scroll wheel instead of double-clicking.
-   Added an icon for sub-tabs of content type `BiomeData`.
-   Added an icon for sub-tabs of content type `SchedulerWT`.
-   Added a DMG build of the app for macOS.
-   Added the `structureid` search filter to the "Structures" tab.
-   The `File > Open` submenu in the menu bar is now functional.
-   Added more options to the add tab popup menu.
-   All of the options on the add tab popup menu are now functional.
-   The app now supports opening files and folders in it through a file manager (files only), executable arguments, or URI.
-   Added a warning when running the x64 build of the app on an ARM64 machine through a translation layer (except on Windows as there is currently no ARM64 build of the app for Windows).
-   Added recent worlds and folders sections to the taskbar jump list on Windows.
-   Added the `File > Open Recent` submenu to the menu bar on macOS.
-   Added a settings menu.

## Changes

-   Removed the transition of dragged tabs in the tab bars.
-   Redesigned pages and components that are not implemented yet, there is now a graphic and styling instead of just a plain text message saying that it hasn't been implemented yet.

## Fixes

-   Fixed a bug where search filters other than `dbkey` and `nbt` did not support partial matches of the target data, requiring the search query to be exactly the entire target data, which is rarely ever useful.
-   Fixed a bug where tabs' modes were never actually set in the constructor.
-   Symlinks no longer can cause duplicates of worlds to appear in the world selection menu when multiple found world folders resolve to the same real path.
-   Fixed a bug where `TickingArea` sub-tabs opened through the "Ticking Areas" tab had a map icon.
-   The "Repair Force World Corruption" button now updates the list of cached DB keys to remove the deleted keys.
-   The "Force Corrupt World" button now updates the list of cached DB keys to add the created keys.
-   Fixed the search filters for the "Structures" tab.
-   When clicking an option in the add tab popup menu, it now closes the popup menu.
-   Fixed a bug where on macOS, the app would not quit when all windows were closed.
-   Fixed a bug where the app's URI protocol was not functional for any purpose other than opening the app on Windows.
-   Fixed a bug where `MetaDataHash` keys were detected as `BlendingBiomeHeight` keys, `GeneratedPreCavesAndCliffsBlending` keys were detected as `MetaDataHash` keys, and `BlendingBiomeHeight` keys were detected as `GeneratedPreCavesAndCliffsBlending` keys.

## Performance Improvements

-   Masive load time improvements to the worlds list by only getting the application name for the `minecraft:` and `minecraft-preview:` protocols (checking if Minecraft and Minecraft Preview are installed) once instead of per world.

# v1.0.0-beta.14

## Additions

-   Added the paths to the world folder locations for the Minecraft Windows GDK builds to the config.

# v1.0.0-beta.13

## Critical Fixes

-   Fixed a bug where only the first entity or block entity in the following content types was extracted, so when editing them, all other entities in the key would be deleted:
    -   `BlockEntity`
    -   `Entity`
-   Fixed a bug where when editing `level.dat`, the changes did not do anything because it was saved in the wrong format.

## Changes

-   Removed the click sound from the add tab popup menu.

## Fixes

-   Fixed a bug where some platforms (namely Linux) would fail to load the app logo on the main menu of the app due to an extra `/` being appended to the end of the file path.
-   Fixed a bug where when opening a pending tick in the "Ticks" tab, it would open with a content type of `RandomTicks` instead of `PendingTicks`.
-   Fixed a bug where the format type of the `HardcodedSpawners` content type was `NBT` instead of `unknown`.

## Technical Additions

-   Added a new `resource-image://` app-scoped URI protocol to allow loading images from the app's resources folder without specifying a file extension.

# v1.0.0-beta.12

## Additions

-   Added the "Ticks" tab.
-   Added the `showWorldSizesOnWorldList` config option to show the world sizes on the world list on the main menu of the app.
-   Added the `fileSizeUnits` config option to set whether to use binary (KiB, MiB, GiB, etc.) or metric (kB, MB, GB, etc.) file/folder size units.

## Changes

-   Changed two of the default paths for the `minecraftDataFolders` config option to use `%appdata%` instead of `%AppData%`.

## Fixes

-   Fixed a bug where when saving a sub-tab that targeted a file (ex. `level.dat`), it would mark the parent tab as saved if that file was the only modification of the parent tab even though it wasn't saved.
-   Fixed a bug where when closing a sub-tab that targeted a file (ex. `level.dat`) without saving, if that file was the only modification of the parent tab, it would not mark the parent tab as having no unsaved changes.
-   Fixed a bug where the loading screen messages could be selected.
-   Fixed a bug where the context menus for inactive tabs and sub-tab were cut off by the edges of the tab or sub-tab.
-   Fixed a bug where when reordering sub-tabs and dragging the sub-tab to the right of all of the other sub-tabs, the white border would be placed on the left of the sub-tab you were dragging instead of on the right of the rightmost sub-tab.
-   Fixed a bug where the add tab popup menu was shown below the NBT tag type icons in the editor widget overlay bar in the tree editor.

## Performance Improvements

-   The default world icon on the world list on the main menu of the app is now a data URI, which allows it to load instantly.

# v1.0.0-beta.11

## Fixes

-   Fixed a bug where sometimes when trying to open a sub-tab it would instead just switch to another already open sub-tab (it is only supposed to do that if the sub-tabs have the same target file or LevelDB key).

# v1.0.0-beta.10

## Critical Fixes

-   Fixed a bug where when saving a world, the destination files were not deleted first, which caused really weird behavior when the world was open in Minecraft while open in the app, such as bits of data from the copy being edited in the app and the original world being intermixed (you can hold the `ALT` key while saving to use the old mode where it has the weird behavior).
-   Fixed a bug where keys with a content type of `Data3D` or `SubChunkPrefix` were never saved.

## Fixes

-   Fixed a bug where non-button areas of the context menus had a pointer cursor.
-   Fixed a bug where the context menus had the hover title text of the world button the context menu corresponds to.

# v1.0.0-beta.9

## Additions

-   Added the paths to the world folder locations for the Minecraft Windows Preview GDK builds to the config.
-   The config is now versioned.
-   Added 3 new options to the context menu for the worlds on the main menu:
    -   `Open World Folder in (File Explorer/Finder/File Manager)` (depending on the platform) - Opens the world folder in the file manager.
    -   `Open World in Minecraft` - Opens the world in Minecraft.
    -   `Open World in Minecraft Preview` - Opens the world in Minecraft Preview.
-   Added a context menu to tabs, with the following options:
    -   `Close Tab` (only visible when the tab has no unsaved changes) - Closes the tab.
    -   `Save Tab` (only visible when the tab has unsaved changes) - Saves the tab.
    -   `Save & Close Tab` (only visible when the tab has unsaved changes) - Saves the tab and closes it.
    -   `Close Tab Without Saving` (only visible when the tab has unsaved changes) - Closes the tab without saving.
    -   `Save & Close Others` - Saves the tab and closes all other tabs.
    -   `Close Others` - Closes all other tabs.
    -   `(Open Folder/Reveal) in (File Explorer/Finder/File Manager)` (depending on the platform and whether the tab targets a folder or not)
    -   `Favorite` (only visible when the tab targets a world and is not favorited) - Marks the world as a favorite.
    -   `Unfavorite` (only visible when the tab is favorited) - Unmarks the world as a favorite.

## Fixes

-   Fixed a bug where non-button areas of the context menu for the worlds on the main menu had a pointer cursor.
-   Fixed a bug where the context menu for the worlds on the main menu had the hover title text of the world button the context menu corresponds to.
-   Removed many unnecessary console logs.
-   Switched the log type of the search query console log from `info` to `verbose`.
-   The `Select a tab from the left sidebar to get started.` message can no longer be selected.
-   The `File > New Window` menu bar option is now functional (before it did nothing).
-   The `New Window` task button when right-clicking the app on Windows is now functional (before it could only open the app, but if the app was already open, it would not open a new window).
-   Removed many unnecessary console logs.

# v1.0.0-beta.8

## Critical Fixes

-   Fixed a bug where the app would throw errors on startup for non-Windows platforms.

## Additions

-   Added two new debug overlay modes:
    -   `Config (Views)`
    -   `Tab`
-   Added a new config option (`config.debugHUDDropShadow`) to add a drop shadow to the debug overlay to make it more readable.
-   Added a feature where the title of the window changes to display the name of the currently selected tab.
-   Added the ability to import/export/transfer structures to the structures tab.
    -   The structures tab now has 4 new buttons:
        -   `Import Structures` - Opens a file picker to allow for selecting multiple structure files to import.
        -   `Import Structure Folders` - Opens a file picker to allow for selecting multiple folders with structures in them to import, the namespace of the imported structures will be determined by the relative path of the folder to the structure file. If you were to select the `structures` folder of a behavior pack for example, it would import the structures with the exact same names as if you just added the behavior pack onto your world. You can even import every structure on your drive with this really quickly.
        -   `Export Structures` - Opens a file picker to allow for selecting a folder to export the structures to.
        -   `Transfer Structures to Open Tab` - Opens a dialog to select another tab currently open in the app to copy the structures to, you can select tabs in the same window and in other windows.

## Changes

-   Updated several debug overlay modes.
-   `~local_player` is now always the first player in the players tab (before it was always the last player).
-   Updated the search query syntax documentation for a few of the tabs.

## Fixes

-   Fixed the font for the debug overlay.
-   Fixed a bug where the MIME type in the data URIs used for the NBT tag type icons in the tree editor was `false` instead of `image/png`.

# v1.0.0-beta.7

## Additions

-   Added a context menu to the worlds on the main menu of the app.
    -   The context menu has options for:
        -   "Open World" (opens the world in the app)
        -   "Open in Read-Only Mode" (opens the world in a mode where changes cannot be made)
        -   "Open in Direct Mode" (opens the world directly, operating on the actual world files, instead of operating on a copy and replacing the original world with the modified copy upon saving, this mode also has the side effect of changes being applied immediately, and if something goes wrong, it affects the original world (so it is HIGHLY recommended to make a backup before using this mode), this mode also cannot be used while the world is open in Minecraft)
        -   "Favorite"/"Unfavorite" (allows for marking a world as a favorite, which will make it appear at the top of the worlds list)

## Changes

-   The worlds list on the main menu of the app is now sorted in descending order of when they were last opened in Minecraft.

## Fixes

-   Fixed a bug where reordering sub-tabs was broken and would put the sub-tab at the wrong index.

## Performance Improvements

-   The tree editor now loads the NBT tag type icons as data URIs, which allows them to load instantly.

# v1.0.0-beta.6

## Critical Fixes

-   Fixed a bug where editing the contents of a LevelDB key that had any control characters in their data in the SNBT editor would cause the data of that key to get erased, preventing the tab from saving, and as a result, preventing closing of the tab and preventing the world from saving.

## Additions

-   Added the "Fun" tab.
-   Added pinned tabs! Now you can pin tabs in a world and they will be re-opened whenever you open that world in the app.
-   Added a context menu to sub-tabs, allowing for pinning/unpinning sub-tabs, closing sub-tabs without saving them, and undoing any unsaved changes to a sub-tab without closing the tab, which is really handy if you mess up the data of the tab but don't want to lose all your unsaved changes from other sub-tabs.
-   Added an unsaved sub-tab indicator.
-   When opening a sub-tab for a non-existent LevelDB, it now displays a message saying the key doesn't exist, and depending on the content type of the key, a button to create the key will be displayed.

## Changes

-   The `CTRL+W` keyboard shortcut no longer closes the window (this is so that in the future, it can be made to close the currently selected sub-tab or tab instead).
-   The `CTRL+M` keyboard shortcut no longer minimizes the window.
-   Updated the sizing and positioning of the unsaved tab indicator.

## Fixes

-   Fixed a bug where the display names of `SubChunkPrefix` keys did not include the sub-chunk index if it was 0.
-   Fixed a bug where the "Repair Forced World Corruption" tab did not show up when forced world corruption was detected.
-   Fixed a bug where editors using Monaco Editor (ex. the Prismarine-NBT and SNBT editors) would be completely blank if the tab's data was not loaded or missing, now they instead display a read-only editor with the text "Data is not loaded.".
-   Fixed a bug where the map previews in the maps tab had a bunch of extra unnecessary whitespace around them, that made you have to scroll for too long to reach the bottom to access the page navigation buttons.
-   Fixed a bug where closing a sub-tab would switch your active tab to the closest sub-tab or to nothing, even if the closed sub-tab was not the active sub-tab at the time.
-   Fixed a bug where when saving a world, the save window could sometimes get stuck open, with the close button disabled, requiring `ALT+F4` to close it.

# v1.0.0-beta.5

## Additions

-   Made the search bar on the players tab functional.
-   The app now notifies you when opened if an update is available.
-   On Windows, right clicking the app in the taskbar now has "New Window" task option.
-   When opening a world, that world is now added to the app's recent documents list.

## Changes

-   When an error occurs while saving a world, it is now opened in an actual error dialog instead of the progress bar window to make it actually readable.

# v1.0.0-beta.4

## Additions

-   Added the "Structures" tab.

# v1.0.0-beta.3

## Changes

-   Removed `package-lock.json` from `.gitignore`.

## Fixes

-   Fixed the macOS build and a few other builds that had their native `node-leveldb.node` binary missing or in the wrong location.

# v1.0.0-beta.2

## Additions

-   Added the "Ticking Areas" tab.
-   Added the "Portals" tab.

## Removals

-   Removed the "Search" tab as there is already the view files tab which serves the same purpose.

## Fixes

-   Fixed the replace map image dialog to allow selecting images.

# v1.0.0-beta.1

-   Initial release
