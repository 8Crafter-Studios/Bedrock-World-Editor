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

-   Added the structures tab.

# v1.0.0-beta.3

## Changes

-   Removed `package-lock.json` from `.gitignore`.

## Fixes

-   Fixed the macOS build and a few other builds that had their native `node-leveldb.node` binary missing or in the wrong location.

# v1.0.0-beta.2

## Additions

-   Added the ticking areas tab.
-   Added the portals tab.

## Removals

-   Removed the search tab as there is already the view files tab which serves the same purpose.

## Fixes

-   Fixed the replace map image dialog to allow selecting images.

# v1.0.0-beta.1

-   Initial release
