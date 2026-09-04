import type { JSX } from "preact";
import _React from "preact/compat";
import { shell } from "@electron/remote";

type CommandType = "player" | "mixed" | "admin";

interface CommandHelp {
    name: string;
    aliases?: string;
    type: CommandType;
    summary: string;
    body: string[];
}

interface ExternalLink {
    label: string;
    url: string;
}

const QUICK_START: Array<{ title: string; lines: string[] }> = [
    { title: "1. Check your money", lines: ["Use /balance to see how much money you have."] },
    { title: "2. Pick a job", lines: ["Use /job to choose a job.", "Jobs can pay you for breaking blocks, placing blocks, or killing mobs."] },
    { title: "3. Use the shop", lines: ["Use /shop to buy and sell server shop items.", "Admins can also edit the shop from the shop UI."] },
    {
        title: "4. Use the Auction House",
        lines: [
            "Use /ah to browse player auctions.",
            "Use /ah sell to sell the item in your hand.",
            "Use /ah sell 500 to quickly list your held stack for $500.",
        ],
    },
    { title: "5. Customize your display", lines: ["Use /moneysettings to edit your personal money display settings."] },
];

const COMMANDS: CommandHelp[] = [
    {
        name: "/balance",
        aliases: "/bal",
        type: "player",
        summary: "Shows your money",
        body: [
            "Shows your current money in chat.",
            "You can also check another player's money by putting their name after the command.",
            "Examples: /balance, /bal, /balance <player>, /bal <player>",
            "Use this when you want to quickly check your money or another player's money.",
        ],
    },
    {
        name: "/balancetop",
        aliases: "/baltop",
        type: "player",
        summary: "Shows richest players",
        body: [
            "Shows the money leaderboard for the richest players on the server.",
            "The leaderboard has pages, so you can open a specific page too.",
            "Examples: /balancetop, /baltop, /balancetop <page>, /baltop <page>",
            "Use this to see who has the most money on the SMP.",
        ],
    },
    {
        name: "/pay",
        type: "player",
        summary: "Pay another player",
        body: [
            "Usage: /pay <player> <amount>",
            "Sends money to another player.",
            "Examples: /pay Lily 50, /pay Steve 12.75",
            "You cannot pay money you do not have or pay yourself. Amounts can use cents, like 12.75.",
        ],
    },
    {
        name: "/moneysettings",
        type: "mixed",
        summary: "Open money settings",
        body: [
            "Opens the money settings UI.",
            "Player settings: Actionbar money display, money sounds, compact numbers.",
            "Admin settings: Sidebar display, below-name display, default player settings, starting money.",
            "Players can edit their own display settings. Admins can also edit server-wide money settings.",
        ],
    },
    {
        name: "/job",
        type: "mixed",
        summary: "Choose a job",
        body: [
            "Opens the jobs UI. Players can view jobs, see how each job makes money, join a job, or leave their current job.",
            "Jobs can reward breaking blocks, placing blocks, and killing mobs.",
            "Players can open a job to view rewards, use Join Job to choose it, or Leave Job to leave.",
            "Admins can use Edit Jobs to add, edit, delete, or restore jobs. Reward IDs should use Minecraft IDs.",
            "ID examples: minecraft:stone, minecraft:wheat, minecraft:zombie, minecraft:cow.",
        ],
    },
    {
        name: "/shop",
        type: "mixed",
        summary: "Open the shop",
        body: [
            "Opens the server shop UI.",
            "Players can browse categories, buy items, sell items, and search shop items.",
            "Admins can edit categories/items, move items, edit prices, and clear or restore the shop.",
            "Item IDs look like minecraft:diamond or minecraft:stone. Display names are what players see in the UI.",
            "Exact items can preserve custom names, lore, enchantments, durability, and custom data.",
            "Filled shulker boxes should not be used as exact shop items because their contents are not safely stored.",
        ],
    },
    {
        name: "/ah",
        type: "player",
        summary: "Open Auction House",
        body: [
            "Opens the Auction House. Players can list items, search items, buy auctions, and manage their own listed items.",
            "Examples: /ah, /ah diamond, /ah sell, /ah sell 500.",
            "The default list shows newest active auctions, searches sort cheapest first, and 20 auctions show per page.",
            "Prices are for the whole stack. You cannot buy your own auction. There are no taxes. Sellers are paid instantly, even offline.",
            "Players can have up to 20 active auctions. Active auctions last 30 active-world days; expired auctions can be claimed for 100 active-world days.",
            "Shulker boxes are blocked because their contents cannot be safely stored.",
        ],
    },
    {
        name: "/buy",
        type: "admin",
        summary: "Admin buy command",
        body: [
            "Admin command for buying or giving items through the money system.",
            "Examples: /buy minecraft:stone 64, /buy minecraft:diamond 1.",
            "Useful with command blocks or NPCs for custom shops, reward stations, or special item vendors.",
            "Use Minecraft item IDs and normal item amounts. For normal player shopping, /shop is recommended.",
        ],
    },
    {
        name: "/sell",
        type: "admin",
        summary: "Admin sell command",
        body: [
            "Admin command for selling items through the money system.",
            "Examples: /sell minecraft:stone 64, /sell minecraft:diamond 1.",
            "Useful with command blocks or NPCs for sell stations, recycling machines, or mob-drop sellers.",
            "Use Minecraft item IDs and normal item amounts. For normal player selling, /shop is recommended.",
        ],
    },
    {
        name: "/setmoney",
        type: "admin",
        summary: "Set player money",
        body: [
            "Usage: /setmoney <player> <amount>",
            "Sets a player's money to an exact amount.",
            "Examples: /setmoney Lily 1000, /setmoney Steve -50, /setmoney Alex 12.75.",
            "This can set negative money.",
        ],
    },
    {
        name: "/addmoney",
        type: "admin",
        summary: "Add money",
        body: [
            "Usage: /addmoney <player> <amount>",
            "Adds money to a player.",
            "Examples: /addmoney Lily 500, /addmoney Steve 12.50.",
            "Use this for rewards, refunds, events, or admin corrections.",
        ],
    },
    {
        name: "/removemoney",
        type: "admin",
        summary: "Remove money",
        body: [
            "Usage: /removemoney <player> <amount>",
            "Removes money from a player.",
            "Examples: /removemoney Lily 100, /removemoney Steve 2.75.",
            "This can put a player into negative money.",
        ],
    },
];

const DOWNLOAD_LINKS: ExternalLink[] = [
    { label: "CurseForge Download", url: "https://www.curseforge.com/minecraft-bedrock/scripts/lilys-money" },
    { label: "MCPEDL Download", url: "https://mcpedl.com/lilys-money/" },
];

const LILY_LINKS: ExternalLink[] = [
    { label: "Lily's Discord", url: "https://discord.gg/mVJmmAuQeX" },
    { label: "CurseForge Profile", url: "https://www.curseforge.com/members/lilythecatgirl/projects" },
    { label: "MCPEDL Profile", url: "https://mcpedl.com/user/lilythecatgirl" },
];

const CRAFTER_LINKS: ExternalLink[] = [
    { label: "8crafter YouTube", url: "https://www.youtube.com/@8crafter" },
    { label: "8crafter ModBay", url: "https://modbay.org/user/8Crafter/" },
    { label: "8crafter Website", url: "https://www.8crafter.com/" },
    { label: "8crafter Wiki", url: "https://wiki.8crafter.com/main/" },
    { label: "8crafter GitHub", url: "https://github.com/8Crafter" },
    { label: "8crafter Discord", url: "https://discord.gg/jrCTeHGuhx" },
];

function commandColor(type: CommandType): string {
    if (type === "admin") return "#d9363e";
    if (type === "mixed") return "#f0b429";
    return "#35c759";
}

function sectionStyle(): Record<string, string> {
    return {
        border: "2px solid var(--table-outline-color)",
        background: "var(--alternating-bg-color-1)",
        padding: "14px",
    };
}

function LinkButtons(props: { links: ExternalLink[] }): JSX.Element {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {props.links.map(
                (link): JSX.Element => (
                    <button key={link.url} type="button" class="lilymoney-mc-button" onClick={(): void => void shell.openExternal(link.url)}>
                        {link.label}
                    </button>
                )
            )}
        </div>
    );
}

export default function LilyMoneyAddonInfo(): JSX.Element {
    return (
        <div style={{ display: "grid", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Addon Information</h2>
                <div style={{ marginTop: "4px", opacity: 0.7 }}>Lily's Money v3.3.0 help, commands, downloads, and credits.</div>
            </div>

            <section style={sectionStyle()}>
                <h3 style={{ margin: "0 0 10px" }}>Download Lily's Money</h3>
                <LinkButtons links={DOWNLOAD_LINKS} />
            </section>

            <section style={sectionStyle()}>
                <h3 style={{ margin: "0 0 10px" }}>Quick Start</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                    {QUICK_START.map(
                        (step): JSX.Element => (
                            <div key={step.title}>
                                <strong>{step.title}</strong>
                                {step.lines.map(
                                    (line): JSX.Element => (
                                        <div key={line} style={{ marginTop: "3px", opacity: 0.82 }}>
                                            {line}
                                        </div>
                                    )
                                )}
                            </div>
                        )
                    )}
                </div>
            </section>

            <section style={sectionStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "baseline" }}>
                    <h3 style={{ margin: 0 }}>Commands</h3>
                    <div style={{ opacity: 0.72 }}>Green = player • Yellow = mixed • Red = admin</div>
                </div>

                <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                    {COMMANDS.map(
                        (command): JSX.Element => (
                            <details
                                key={command.name}
                                style={{
                                    border: `2px solid ${commandColor(command.type)}`,
                                    background: "var(--alternating-bg-color-2)",
                                    padding: "8px 10px",
                                }}
                            >
                                <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                                    <code>{command.name}</code>
                                    {command.aliases ?
                                        <span style={{ opacity: 0.65 }}> ({command.aliases})</span>
                                    :   null}
                                    <span style={{ opacity: 0.72 }}> — {command.summary}</span>
                                </summary>
                                <div style={{ display: "grid", gap: "7px", marginTop: "10px", paddingLeft: "4px" }}>
                                    {command.body.map(
                                        (line): JSX.Element => (
                                            <div key={line}>{line}</div>
                                        )
                                    )}
                                </div>
                            </details>
                        )
                    )}
                </div>
            </section>

            <section style={sectionStyle()}>
                <h3 style={{ margin: "0 0 8px" }}>About & Links</h3>
                <div>
                    Made by <strong>LilyTheCatgirl</strong> • Minecraft: <strong>LilyTheCat9862</strong>
                </div>
                <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px" }}>Lily Links</h4>
                    <LinkButtons links={LILY_LINKS} />
                </div>
                <div style={{ marginTop: "14px" }}>
                    <h4 style={{ margin: "0 0 8px" }}>UI Credits</h4>
                    <div style={{ marginBottom: "8px", opacity: 0.82 }}>
                        Custom UI powered by 8crafter's UI system. Special thank you to 8crafter for allowing its use.
                    </div>
                    <LinkButtons links={CRAFTER_LINKS} />
                </div>
            </section>
        </div>
    );
}
