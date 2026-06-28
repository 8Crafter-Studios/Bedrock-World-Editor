# Downloading Guide

Downloads can be found [here](https://github.com/8Crafter-Studios/Bedrock-World-Editor/releases/latest).

You want to find the download for your OS and CPU architecture.

Downloads with a `.zip` file extension are portable versions and can be run without installing.

NOTE: If you have a Mac with an Apple Silicon CPU, make sure you download the arm64 build. Otherwise if you have an older Mac with an Intel CPU, download the x86_64 build.

This app uses the SignPath Foundation for code signing.

## Supported Operating Systems

> [!TIP]
> Support for mobile platforms is in development. **Your** contribution can help it arrive sooner, visit [this page](https://github.com/8Crafter-Studios/Bedrock-World-Editor/milestone/1) for more information.

The following operating systems are currently supported:

-   Windows 10/11
-   Linux
-   macOS

Even though iOS is not supported yet, you can still edit worlds from your iPhone/iPad without needing to transfer them to your computer. You can edit your iPhone/iPad's worlds directly from the app on your computer, you don't even need a cable, you can edit them over Wi-Fi. This does not require jailbreaking either, you can do it on any iPhone/iPad. More information can be found [here](https://wiki.8crafter.com/bwe/advanced/editing-ios-worlds).

## Architectures

This lists all the names for different CPU architectures that are used in the release file names.

-   64-bit CPU:
    -   x86_64
    -   amd64
-   32-bit CPU:
    -   ia32
-   64-bit ARM CPU
    -   arm64
-   32-bit ARM CPU:
    -   armv7l
    -   armhf

## File Extension Guide

This lists the different file extensions of the releases and what platforms they are for.

-   `.zip`: Portable build.
    -   All supported OSes have a zip build.
    -   If you are using Linux and your Linux distro is not Debian-based, Red Hat-based, or SUSE-based then you must use the portable version.
-   `.exe`: Windows installer.
    -   This is for Windows 10 and Windows 11 (Windows ARM is supported, but make sure you get the arm build if it is available).
-   `.dmg`: macOS installer.
    -   This is for macOS.
-   `.deb`: Debian Linux installer.
    -   Use this if you install software with `apt`
    -   This is for Debian-based Linux distros. Some common Debian-based distros include:
        -   Ubuntu/Xubuntu/Kubuntu
        -   Debian
        -   Mint
-   `.rpm`: Red Hat/SUSE Linux installer.
    -   Package managers include `yum` and `dnf`
    -   This is for Red Hat-based and SUSE-based Linux distros. Some common Redhat-based and SUSE-based Linux distros include:
        -   Fedora
        -   Red Hat Enterprise Linux
        -   AlmaLinux
        -   Rocky Linux
        -   CentOS Stream
        -   Oracle Linux
        -   openSUSE
        -   SUSE Linux Enterprise Server
    -   The following distros also support `.rpm` installers (this list is non-exhaustive):
        -   Mageia
        -   OpenMandriva
        -   PCLinuxOS
