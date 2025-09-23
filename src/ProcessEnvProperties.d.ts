declare namespace NodeJS {
    interface ProcessEnv {
        ACSetupSvcPort?: `${number}`;
        ACSvcPort?: `${number}`;
        ALLUSERSPROFILE?: string;
        APPDATA?: string;
        COMPUTERNAME?: string;
        ComSpec?: string;
        CommonProgramFiles?: string;
        "CommonProgramFiles(x86)"?: string;
        CommonProgramW6432?: string;
        DriverData?: string;
        EFC_38488?: `${number}`;
        FPS_BROWSER_APP_PROFILE_STRING?: LooseAutocomplete<"Internet Explorer">;
        FPS_BROWSER_USER_PROFILE_STRING?: LooseAutocomplete<"default">;
        /**
         * Only present in development mode, use `process.env.HOMEDRIVE + process.env.HOMEPATH` instead.
         */
        HOME?: string;
        /**
         * The drive of the user's home directory.
         *
         * @example "C:"
         */
        HOMEDRIVE?: string;
        /**
         * The path of the user's home directory.
         *
         * @example "\\Users\\ander"
         */
        HOMEPATH?: string;
        LOCALAPPDATA?: string;
        LOGONSERVER?: string;
        /**
         * The path the the Node.JS executable.
         *
         * Only present in development mode.
         *
         * @example "C:\\Program Files\\nodejs\\node.exe"
         */
        NODE?: string;
        /**
         * The current mode.
         *
         * Only present in development mode.
         *
         * @example "development"
         */
        NODE_ENV?: "development";
        NUMBER_OF_PROCESSORS?: `${number}`;
        ORIGINAL_XDG_CURRENT_DESKTOP?: LooseAutocomplete<"undefined">;
        OS?: LooseAutocomplete<"Windows_NT">;
        OneDrive?: string;
        OneDriveConsumer?: string;
        PATHEXT?: Looseautocomplete<".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC">;
        PROCESSOR_ARCHITECTURE?: LooseAutocomplete<"AMD64">;
        PROCESSOR_IDENTIFIER?: string;
        PROCESSOR_LEVEL?: `${number}`;
        PROCESSOR_REVISION?: LooseAutocomplete<"b701">;
        PSModulePath?: string;
        PUBLIC?: string;
        Path?: string;
        ProgramData?: string;
        ProgramFiles?: string;
        "ProgramFiles(x86)"?: string;
        ProgramW6432?: string;
        RlsSvcPort?: `${number}`;
        SESSIONNAME?: LooseAutocomplete<"Console">;
        SystemDrive?: string;
        SystemRoot?: string;
        TEMP?: string;
        TMP?: string;
        USERDOMAIN?: string;
        USERDOMAIN_ROAMINGPROFILE?: string;
        USERNAME?: string;
        USERPROFILE?: string;
        VBOX_MSI_INSTALL_PATH?: string;
        windir?: string;
        __PSLockDownPolicy?: `${number}`;
    }
}
