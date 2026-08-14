# 8Crafter's Bedrock World Editor

An NBT and LevelDB editor for Minecraft Bedrock Edition.

This app is still in beta, so please report any issues you find [here](https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues).

For support you can [email 8Crafter](mailto:8crafteryt@gmail.com) or ask for help on the [8Crafter Studios](https://discord.8crafter.com) discord server.

The privacy policy and code signing policy can be found [here](https://wiki.8crafter.com/bwe/general/general-information#privacy-policy).

This is an unofficial tool, it is not affiliated with Mojang or Microsoft.

## Overview

This app supports Windows, Linux, and macOS (Darwin). iOS and Android support is planned but not implemented yet.

Even though iOS is not supported yet, you can still edit worlds from your iPhone/iPad without needing to transfer them to your computer. You can edit your iPhone/iPad's worlds directly from the app on your computer, and if your computer runs macOS, you don't even need a cable, you can edit them over Wi-Fi. This does not require jailbreaking either, you can do it on any iPhone/iPad. More information can be found [here](https://wiki.8crafter.com/bwe/advanced/editing-ios-worlds).

[Changelog](https://github.com/8Crafter-Studios/Bedrock-World-Editor/blob/main/Changelog.md)

## Important

Here are some important bugs to note:

-   The Node editor currently only allows renaming, editing, and deleting tags, but not adding them (the buttons in the top right for it do not do anything yet). You can use the Prismarine-NBT or SNBT editors instead to avoid this issue.

## Supported Add-Ons for Detecting Player Names

This is a list of add-ons that if you have any of them on your world, then this app can read the player names that they saved to the world's dynamic properties, allowing you to see players' names in the "Players" tab, as well as search for players by their name.

-   [8Crafter's Server Utilities & Debug Sticks](https://wiki.8crafter.com/andexdb/general/server-utilities.html)
-   [Bedrock World Editor - Player Name Saver](https://github.com/8Crafter-Studios/BWE-Player-Name-Saver/releases/latest)

If you have an add-on that saves players' names, and you want it to be supported, email 8Crafter at [8crafteryt@gmail.com](mailto:8crafteryt@gmail.com) or create a pull request to add it (the file that contains the parsers is [here](https://github.com/8Crafter-Studios/mcbe-leveldb/blob/main/DBUtils.ts), just add a function to parse it to the `playerUUIDToNameDynamicPropertyParsers` array in that file).

<!-- TODO -->
<!-- ## Add-Ons With Integrations

This is a list of add-ons that the Bedrock World Editor has integrations with.-->

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
