# 8Crafter's Bedrock World Editor

An NBT editor for Minecraft Bedrock Edition.

This app is still in beta, so please report any issues to you find [here](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues).

## Overview

This app supports Windows, Linux, and macOS (Darwin).

## Important

Here are some important bugs to note:

-   The Node editor currently only allows renaming, editing, and deleting tags, but not adding them (the buttons in the top right for it do not do anything yet).
-   The SNBT and Prismaine-NBT JSON editors do not support pasting (for some reason monaco editor throws an error about the productService being unknown).

## Supported Add-Ons for Detecting Player Names

This is a list of add-ons that if you have any of them on your world, then this app can read the player names that they saved to the world's dynamic properties, allowing you to see players' names in the "Players" tab, as well as search for players by their name.

-   [8Crafter's Server Utilities & Debug Sticks](https://wiki.8crafter.com/andexdb/general/server-utilities.html)

If you have an add-on that saves players' names, and you want it to be supported, email 8Crafter at [8crafteryt@gmail.com](mailto:8crafteryt@gmail.com) or create a pull request to add it (the file that contains the parsers is [here](https://github.com/8Crafter-Studios/mcbe-leveldb/blob/main/DBUtils.ts), just add a function to parse it to the `playerUUIDToNameDynamicPropertyParsers` array in that file).

## Building Locally

If you want to build the app locally, do the following:

1.  Clone this repository.
2.  Run `npm i --ignore-scripts`.
3.  Run `npm run build-leveldb-zlib`.
4.  Run `npm run make`.
5.  Look in the `out/make` directory for the installer.
