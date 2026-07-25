/** The minecraft manifest schema. */
export type ManifestJSONSchema = ManifestJSONV1Schema | ManifestJSONV2Schema | ManifestJSONV3Schema;

/** The manifest file contains all the basic information about the pack that Minecraft needs to identify it. The tables below contain all the components of the manifest, their individual properties, and what they mean. */
export interface ManifestJSONV1Schema {
    /** This defines the current version of the manifest. Don't change this unless you have a good reason to */
    format_version: 1;
    /** UNDOCUMENTED: header. */
    header: {
        /** This is the name of the pack as it appears within Minecraft. */
        name: string;
        /** This is a short description of the pack. It will appear in the game below the name of the pack. We recommend keeping it to 1-2 lines. */
        description?: string;
        /** This is a special type of identifier that uniquely identifies this pack from any other pack. UUIDs are written in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx where each x is a hexadecimal value (0-9 or a-f). We recommend using an online service to generate this and guarantee their uniqueness (just bing UUID Generator to find some) */
        uuid: string;
        /** This is the version of your pack in the format [majorVersion, minorVersion, revision]. */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
        /** This is the minimum version of the game that this pack was written for. This helps the game identify whether any backwards compatibility is needed for your pack. You should always use the highest version currently available when creating packs */
        min_engine_version?: [majorVersion: number, minorVersion: number, revision: number];
        /** This is the scope of the pack. This is only for resource packs */
        pack_scope?: "global" | "world" | "any";
        /** UNDOCUMENTED: lock template options. */
        lock_template_options?: boolean;
        /** UNDOCUMENTED: base game version. */
        base_game_version?: [majorVersion: number, minorVersion: number, revision: number];
    };
    /** UNDOCUMENTED: modules. */
    modules?: {
        /** This is the type of the module. Can be any of the following: resources, data, client_data, interface, world_template */
        type: "resources" | "data" | "client_data" | "interface" | "world_template" | "skin_pack";
        /** This is a short description of the module. This is not user-facing at the moment but is a good place to remind yourself why the module is defined */
        description?: string;
        /** This is a unique identifier for the module in the same format as the pack's UUID in the header. This should be different from the pack's UUID, and different for every module */
        uuid: string;
        /** This is the version of the module in the same format as the pack's version in the header. This can be used to further identify changes in your pack */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
    }[];
    /** These are the different features that the pack makes use of that aren't necessarily enabled by default. */
    dependencies?: {
        /** This is the unique identifier of the pack that this pack depends on. It needs to be the exact same UUID that the pack has defined in the header section of it's manifest file */
        uuid?: string;
        /** This is the specific version of the pack that your pack depends on. Should match the version the other pack has in its manifest file */
        version?: [majorVersion: number, minorVersion: number, revision: number] | string;
    }[];
    /** These are the different features that the pack makes use of that aren't necessarily enabled by default. */
    capabilities?: {
        /** Allows HTML files in the pack to be used for custom UI, and scripts in the pack to call and manipulate custom UI. */
        experimental_custom_ui?: boolean;
        /** Allows the pack to add, change or replace Chemistry functionality. */
        chemistry?: boolean;
    };
    /** UNDOCUMENTED: metadata. */
    metadata?: {
        /** Name of the author(s) of the pack. */
        authors?: string[];
        /** The license of the pack. */
        license?: string;
        /** The home website of your pack. */
        url?: string;
        /** The type of product this pack is. This is used to determine how the pack is displayed in the store. */
        product_type?: "" | "addon";
    };
}

/** The manifest file contains all the basic information about the pack that Minecraft needs to identify it. The tables below contain all the components of the manifest, their individual properties, and what they mean. */
export interface ManifestJSONV2Schema {
    /** This defines the current version of the manifest. Don't change this unless you have a good reason to */
    format_version: 2;
    /** These are the different features that the pack makes use of that aren't necessarily enabled by default. */
    capabilities?:
        | ("raytraced" | "pbr" | "script_eval" | "editorExtension" | "experimental_custom_ui" | "chemistry")[]
        | {
              /** Allows the pack to add, change or replace Chemistry functionality. */
              chemistry?: boolean;
              /** Indicates that this pack contains extensions for editing. */
              editorExtension?: boolean;
              /** Allows HTML files in the pack to be used for custom UI, and scripts in the pack to call and manipulate custom UI. */
              experimental_custom_ui?: boolean;
              /** Indicates that this pack contains Raytracing Enhanced or Physical Based Materials for rendering. */
              raytraced?: boolean;
          };
    /** Section containing definitions for any other packs or modules that are required in order for this manifest.json file to work. */
    dependencies?: (
        | {
              /** This is the unique identifier of the pack that this pack depends on. It needs to be the exact same UUID that the pack has defined in the header section of it's manifest file */
              uuid?: string;
              /** This is the specific version of the pack that your pack depends on. Should match the version the other pack has in its manifest file */
              version?: [majorVersion: number, minorVersion: number, revision: number] | string;
          }
        | {
              /** This is the name of the module that this pack depends on. */
              module_name?: string;
              /** This is the specific version of the module that your pack depends on. */
              version?: string;
          }
    )[];
    /** Section containing information regarding the name of the pack, description, and other features that are public facing. */
    header: {
        /** This option is required for any world templates. This will allow the player to use a random seed when creating a new world from your template. */
        allow_random_seed?: boolean;
        /** This is the version of the base game your world template requires, specified as [majorVersion, minorVersion, revision]. We use this to determine what version of the base game resource and behavior packs to apply when your content is used. */
        base_game_version?: [majorVersion: number, minorVersion: number, revision: number];
        /** This is a short description of the pack. It will appear in the game below the name of the pack. We recommend keeping it to 1-2 lines. */
        description: string;
        /** This option is required for any world templates. This will lock the player from modifying the options of the world. */
        lock_template_options?: boolean;
        /** This is the minimum version of the game that this pack was written for. This is a required field for resource and behavior packs. This helps the game identify whether any backwards compatibility is needed for your pack. You should always use the highest version currently available when creating packs */
        min_engine_version?: [majorVersion: number, minorVersion: number, revision: number];
        /** This is the name of the pack as it appears within Minecraft. This is a required field. */
        name: string;
        /** This is the scope of the pack. This is only for resource packs */
        pack_scope?: "global" | "world" | "any";
        /** This is a special type of identifier that uniquely identifies this pack from any other pack. UUIDs are written in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx where each x is a hexadecimal value (0-9 or a-f). We recommend using an online service to generate this and guarantee their uniqueness (just bing UUID Generator to find some) */
        uuid: string;
        /** This is the version of your pack in the format [majorVersion, minorVersion, revision]. */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
    };
    /** Section containing information regarding the type of content that is being brought in. */
    modules?: {
        /** This is a short description of the module. This is not user-facing at the moment but is a good place to remind yourself why the module is defined */
        description?: string;
        /** This is the type of the module. */
        type: "resources" | "data" | "client_data" | "interface" | "world_template" | "javascript" | "script";
        /** Only present if `type` is `script`. This indicates the language in which scripts are written in the pack. The only supported value is `javascript`. */
        language?: "javascript" | "Javascript";
        /** This is a unique identifier for the module in the same format as the pack's UUID in the header. This should be different from the pack's UUID, and different for every module */
        uuid: string;
        /** This is the version of your pack in the format [majorVersion, minorVersion, revision]. The version number is used when importing a pack that has been imported before. The new pack will replace the old one if the version is higher, and ignored if it's the same or lower */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
        /** The entry file for the pack's scripts. Requires `type` to be set to `script`. */
        entry?: string;
    }[];
    /** Section containing the metadata about the file such as authors and licensing information. */
    metadata?: {
        /** Name of the author(s) of the pack. */
        authors?: string[];
        /** A list of tools and their version that have modified this pack. */
        generated_with?: {
            [tool: string]: string[];
        };
        /** The license of the pack. */
        license?: string;
        /** The type of product this pack is. This is used to determine how the pack is displayed in the store. */
        product_type?: "" | "addon";
        /** The home website of your pack. */
        url?: string;
    };
    /** A list of subpacks that are applied per memory tier. */
    subpacks?: {
        /** This represents the folder name located in "subpacks" folder. When user select this resolution Minecraft loads the content inside the folder. */
        folder_name: string;
        /** This is the name of the pack resolution. This lets user know what resolution they are choosing. */
        name: string;
        /** This creates a requirement on the capacity of memory needed to select the resolution. Each tier increases memory requirement by 256 MB. */
        memory_tier: number;
    }[];
}

/** The manifest file contains all the basic information about the pack that Minecraft needs to identify it. The tables below contain all the components of the manifest, their individual properties, and what they mean. */
export interface ManifestJSONV3Schema {
    /** This defines the current version of the manifest. Don't change this unless you have a good reason to */
    format_version: 3;
    /** These are the different features that the pack makes use of that aren't necessarily enabled by default. */
    capabilities?:
        | ("raytraced" | "pbr" | "script_eval" | "editorExtension" | "experimental_custom_ui" | "chemistry")[]
        | {
              /** Allows the pack to add, change or replace Chemistry functionality. */
              chemistry?: boolean;
              /** Indicates that this pack contains extensions for editing. */
              editorExtension?: boolean;
              /** Allows HTML files in the pack to be used for custom UI, and scripts in the pack to call and manipulate custom UI. */
              experimental_custom_ui?: boolean;
              /** Indicates that this pack contains Raytracing Enhanced or Physical Based Materials for rendering. */
              raytraced?: boolean;
          };
    /** Section containing definitions for any other packs or modules that are required in order for this manifest.json file to work. */
    dependencies?: (
        | {
              /** This is the unique identifier of the pack that this pack depends on. It needs to be the exact same UUID that the pack has defined in the header section of it's manifest file */
              uuid?: string;
              /** This is the specific version of the pack that your pack depends on. Should match the version the other pack has in its manifest file */
              version?: [majorVersion: number, minorVersion: number, revision: number] | string;
          }
        | {
              /** This is the name of the module that this pack depends on. */
              module_name?: string;
              /** This is the specific version of the module that your pack depends on. */
              version?: string;
          }
    )[];
    /** Section containing information regarding the name of the pack, description, and other features that are public facing. */
    header: {
        /** This option is required for any world templates. This will allow the player to use a random seed when creating a new world from your template. */
        allow_random_seed?: boolean;
        /** This is the version of the base game your world template requires, specified as [majorVersion, minorVersion, revision]. We use this to determine what version of the base game resource and behavior packs to apply when your content is used. */
        base_game_version?: [majorVersion: number, minorVersion: number, revision: number];
        /** This is a short description of the pack. It will appear in the game below the name of the pack. We recommend keeping it to 1-2 lines. */
        description: string;
        /** This option is required for any world templates. This will lock the player from modifying the options of the world. */
        lock_template_options?: boolean;
        /** This is the minimum version of the game that this pack was written for. This is a required field for resource and behavior packs. This helps the game identify whether any backwards compatibility is needed for your pack. You should always use the highest version currently available when creating packs. In version 3, currently in preview, you must use a string for version. */
        min_engine_version?: string;
        /** This is the name of the pack as it appears within Minecraft. This is a required field. */
        name: string;
        /** This is the scope of the pack. This is only for resource packs */
        pack_scope?: "global" | "world" | "any";
        /** This is a special type of identifier that uniquely identifies this pack from any other pack. UUIDs are written in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx where each x is a hexadecimal value (0-9 or a-f). We recommend using an online service to generate this and guarantee their uniqueness (just bing UUID Generator to find some) */
        uuid: string;
        /** This is the version of your pack in the format [majorVersion, minorVersion, revision]. */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
    };
    /** Section containing information regarding the type of content that is being brought in. */
    modules?: {
        /** This is a short description of the module. This is not user-facing at the moment but is a good place to remind yourself why the module is defined */
        description?: string;
        /** This is the type of the module. */
        type: "resources" | "data" | "client_data" | "interface" | "world_template" | "javascript" | "script";
        /** Only present if `type` is `script`. This indicates the language in which scripts are written in the pack. The only supported value is `javascript`. */
        language?: "javascript" | "Javascript";
        /** This is a unique identifier for the module in the same format as the pack's UUID in the header. This should be different from the pack's UUID, and different for every module */
        uuid: string;
        /** This is the version of your pack in the format [majorVersion, minorVersion, revision]. The version number is used when importing a pack that has been imported before. The new pack will replace the old one if the version is higher, and ignored if it's the same or lower */
        version: [majorVersion: number, minorVersion: number, revision: number] | string;
        /** The entry file for the pack's scripts. Requires `type` to be set to `script`. */
        entry?: string;
    }[];
    /** Section containing the metadata about the file such as authors and licensing information. */
    metadata?: {
        /** Name of the author(s) of the pack. */
        authors?: string[];
        /** A list of tools and their version that have modified this pack. */
        generated_with?: {
            [tool: string]: string[];
        };
        /** The license of the pack. */
        license?: string;
        /** The type of product this pack is. This is used to determine how the pack is displayed in the store. */
        product_type?: "" | "addon";
        /** The home website of your pack. */
        url?: string;
    };
    /** A list of subpacks that are applied per memory performance tier. */
    subpacks?: {
        /** This represents the folder name located in "subpacks" folder. When user select this resolution Minecraft loads the content inside the folder. */
        folder_name: string;
        /** This is the name of the pack resolution. This lets user know what resolution they are choosing. */
        name: string;
        /** This creates a requirement on the capacity of memory needed to select the resolution. Each tier increases memory requirement by 256 MB. */
        memory_performance_tier: number;
    }[];
    /** UNDOCUMENTED */
    settings?: (
        | {
              /** UNDOCUMENTED */
              text: string;
              /** UNDOCUMENTED */
              type: string;
          }
        | {
              /** UNDOCUMENTED */
              default: number;
              /** UNDOCUMENTED */
              max: number;
              /** UNDOCUMENTED */
              min: number;
              /** UNDOCUMENTED */
              name: string;
              /** UNDOCUMENTED */
              step: number;
              /** UNDOCUMENTED */
              text: string;
              /** UNDOCUMENTED */
              type: string;
          }
        | {
              /** UNDOCUMENTED */
              default: boolean;
              /** UNDOCUMENTED */
              name: string;
              /** UNDOCUMENTED */
              text: string;
              /** UNDOCUMENTED */
              type: string;
          }
        | {
              /** UNDOCUMENTED */
              default: string;
              /** UNDOCUMENTED */
              name: string;
              /** UNDOCUMENTED */
              options: {
                  /** UNDOCUMENTED */
                  name: string;
                  /** UNDOCUMENTED */
                  text: string;
              }[];
              /** UNDOCUMENTED */
              text: string;
              /** UNDOCUMENTED */
              type: string;
          }
    )[];
}
