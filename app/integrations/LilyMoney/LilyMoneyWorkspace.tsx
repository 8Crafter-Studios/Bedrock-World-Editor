import type { JSX } from "preact";
import _React, { useEffect, useMemo, useState } from "preact/compat";

import {
    analyzeLilyMoneyDatabase,
    formatLilyMoneyCents,
    type LilyMoneyAnalysis,
    type LilyMoneyPlayerAnalysis,
} from "./LilyMoneyAnalysis";
import {
    assembleLilyMoneyDatabase,
    type LilyMoneyDatabase,
} from "./LilyMoneyDatabase";
import type {
    LilyMoneyDiscoveryResult,
    LilyMoneyPropertySummary,
    LilyMoneyStorageSummary,
} from "./LilyMoneyData";
import type {
    LilyMoneyEventEffect,
    ParsedLilyMoneyEvent,
} from "./LilyMoneyEvents";
import type { LilyMoneyRecord } from "./LilyMoneyRecords";
import LilyMoneyAddonInfo from "./LilyMoneyAddonInfo";
import "./LilyMoneyWorkspace.css";

export type LilyMoneyWorkspacePage =
    | "overview"
    | "transactions"
    | "jobs"
    | "graphs"
    | "raw"
    | "database"
    | "addonInfo";

interface LilyMoneyWorkspaceProps {
    result: LilyMoneyDiscoveryResult;
    progress: string;
    onBack(): void;
    onRescan(): void;
}

interface WorkspaceTheme {
    bg: string;
    panel: string;
    panelAlt: string;
    panelStrong: string;
    border: string;
    borderStrong: string;
    text: string;
    muted: string;
    accent: string;
    accentSoft: string;
    positive: string;
    negative: string;
    warning: string;
    danger: string;
    blue: string;
    teal: string;
    shadow: string;
}

interface BalancePoint {
    recordId: number;
    timestamp: number;
    balanceCents: number;
}

interface BalanceTimeline {
    segments: BalancePoint[][];
    pointCount: number;
    cleanOfflineSpans: number;
}

interface DatabaseHealth {
    level: "healthy" | "warning" | "error";
    label: string;
    detail: string;
    errorCount: number;
    warningCount: number;
}

interface JobAggregate {
    jobId: string;
    amountCents: number;
    canonicalAmountCents: number;
    currentAmountCents: number;
    quantity: number;
    rewardGroups: number;
    lastTimestamp: number;
}

interface JobSourceAggregate {
    key: string;
    jobId: string;
    action: string;
    sourceId: string;
    amountCents: number;
    quantity: number;
    rewardGroups: number;
    lastTimestamp: number;
}

interface JobActivityRow {
    key: string;
    recordId: number | null;
    timestamp: number;
    identityId: string;
    playerName: string;
    jobId: string;
    action: string;
    sourceId: string;
    quantity: number;
    amountCents: number;
    current: boolean;
}

interface MoneySourceRow {
    label: string;
    amountCents: number;
}

interface BarRow {
    label: string;
    valueCents: number;
    detail?: string;
}

interface ChartMarker {
    timestamp: number;
    label: string;
    tone: "join" | "leave" | "logging";
}

type PlayerSortMode =
    | "name"
    | "richest"
    | "poorest"
    | "latest"
    | "moneyMoved"
    | "spending"
    | "jobs"
    | "audit";

interface PlayerBreakdownRow {
    direction: "income" | "spending" | "adjustment";
    label: string;
    amountCents: number;
}

interface PlayerProfileMetrics {
    identityId: string;
    displayName: string;
    aliases: string[];
    firstSeen: number | null;
    lastSeen: number | null;
    transactionCount: number;
    jobRewardGroups: number;
    jobActions: number;
    exactObservationCount: number;
    firstExactBalanceCents: number | null;
    exactBalanceChangeCents: number | null;
    breakdown: PlayerBreakdownRow[];
    topJob: { label: string; amountCents: number; quantity: number } | null;
    topBought: { label: string; amountCents: number; quantity: number } | null;
    topSold: { label: string; amountCents: number; quantity: number } | null;
    topPartner: { label: string; sentCents: number; receivedCents: number } | null;
    biggestIncoming: { amountCents: number; label: string } | null;
    biggestOutgoing: { amountCents: number; label: string } | null;
    auditFlagCount: number;
    auditFlagVolumeCents: number;
    setMoneyCount: number;
}

interface BalanceAuditRow {
    recordId: number;
    timestamp: number;
    eventType: string;
    previousBalanceCents: number | null;
    loggedDeltaCents: number | null;
    setBalanceCents: number | null;
    expectedBalanceCents: number | null;
    actualBalanceCents: number;
    differenceCents: number | null;
    baseline: boolean;
}

type TransactionCategory =
    | "shop"
    | "payment"
    | "auction"
    | "admin"
    | "command";

type MoneyDirection = "gain" | "loss" | "neutral";

const BWE_THEME: WorkspaceTheme = {
    bg: "var(--bg-color)",
    panel: "var(--alternating-bg-color-1)",
    panelAlt: "var(--alternating-bg-color-2)",
    panelStrong: "var(--generic-button-bg-color)",
    border: "var(--table-outline-color)",
    borderStrong: "var(--table-header-bg-color)",
    text: "var(--text-color)",
    muted: "color-mix(in srgb, var(--text-color) 62%, transparent)",
    accent: "#00a86b",
    accentSoft: "color-mix(in srgb, #00a86b 22%, transparent)",
    positive: "#35c759",
    negative: "#e74c3c",
    warning: "#f0b429",
    danger: "#d9363e",
    blue: "#4aa3df",
    teal: "#27b5a9",
    shadow: "rgba(0, 0, 0, 0.35)",
};

const PAGE_SIZE = 100;

function panelStyle(theme: WorkspaceTheme): Record<string, string> {
    return {
        border: `2px solid ${theme.border}`,
        background: theme.panel,
        boxSizing: "border-box",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${theme.text} 10%, transparent), 3px 3px 0 ${theme.shadow}`,
    };
}

function smallMutedStyle(theme: WorkspaceTheme): Record<string, string> {
    return {
        color: theme.muted,
        fontSize: "12px",
    };
}

function controlStyle(theme: WorkspaceTheme): Record<string, string> {
    return {
        border: `2px solid ${theme.borderStrong}`,
        background: theme.panelAlt,
        color: theme.text,
        padding: "7px 10px",
        boxSizing: "border-box",
        outline: "none",
    };
}

function buttonStyle(theme: WorkspaceTheme, selected: boolean = false): Record<string, string> {
    return {
        border: `2px solid ${selected ? theme.accent : theme.borderStrong}`,
        background: selected ? theme.accentSoft : theme.panelAlt,
        color: theme.text,
        padding: "8px 11px",
        cursor: "pointer",
    };
}

function sumNullable(values: Array<number | null>): number | null {
    const available: number[] = values.filter(
        (value: number | null): value is number => value !== null
    );

    if (available.length === 0) return null;
    return available.reduce((sum: number, value: number): number => sum + value, 0);
}

function currentPlayerBalance(player: LilyMoneyPlayerAnalysis): number | null {
    return player.provisionalBalanceCents ?? player.latestCommittedBalanceCents;
}

function userFacingJobRewards(player: LilyMoneyPlayerAnalysis): number {
    return player.jobIncomeCents + player.pendingJobRewardCents;
}

function userFacingIncome(player: LilyMoneyPlayerAnalysis): number {
    return player.totalIncomeCents + player.pendingJobRewardCents;
}

function databaseHealth(
    result: LilyMoneyDiscoveryResult,
    database: LilyMoneyDatabase,
    analysis: LilyMoneyAnalysis
): DatabaseHealth {
    const checksumFailures: number = database.selectedShards.filter(
        (storage: LilyMoneyStorageSummary): boolean => storage.checksumValid === false
    ).length;

    const decoderErrors: number = database.selectedShards.reduce(
        (count: number, storage: LilyMoneyStorageSummary): number =>
            count + storage.recordDecodeErrors.length,
        0
    );

    const errorCount: number =
        result.errors.length +
        database.errors.length +
        analysis.errors.length +
        decoderErrors +
        checksumFailures;

    const warningCount: number =
        database.warnings.length +
        analysis.warnings.length +
        database.selectedShards.reduce(
            (count: number, storage: LilyMoneyStorageSummary): number =>
                count + storage.recordDecodeWarnings.length,
            0
        );

    if (errorCount > 0) {
        return {
            level: "error",
            label: "Database Issues",
            detail: `${errorCount} error${errorCount === 1 ? "" : "s"}`,
            errorCount,
            warningCount,
        };
    }

    if (warningCount > 0) {
        return {
            level: "warning",
            label: "Database Warning",
            detail: `${warningCount} warning${warningCount === 1 ? "" : "s"}`,
            errorCount,
            warningCount,
        };
    }

    return {
        level: "healthy",
        label: "Database Healthy",
        detail: `${database.selectedShards.length} shard${database.selectedShards.length === 1 ? "" : "s"} • ${database.records.length.toLocaleString()} records`,
        errorCount,
        warningCount,
    };
}

function healthColor(theme: WorkspaceTheme, level: DatabaseHealth["level"]): string {
    switch (level) {
        case "healthy":
            return theme.positive;
        case "warning":
            return theme.warning;
        case "error":
            return theme.danger;
    }
}

function getPlayer(
    analysis: LilyMoneyAnalysis,
    identityId: string
): LilyMoneyPlayerAnalysis | null {
    return (
        analysis.players.find(
            (player: LilyMoneyPlayerAnalysis): boolean =>
                player.identityId === identityId
        ) ?? null
    );
}

function eventMatchesPlayer(event: ParsedLilyMoneyEvent, identityId: string): boolean {
    if (identityId === "all") return true;

    return (
        event.people.some((person): boolean => person.identityId === identityId) ||
        event.effects.some((effect): boolean => effect.identityId === identityId) ||
        event.fullCheckpointRows.some((row): boolean => row.identityId === identityId)
    );
}

function displayItemName(event: ParsedLilyMoneyEvent): string {
    const raw: string = event.itemName || event.itemId || event.sourceId || "item";
    return prettifyIdentifier(raw);
}

function prettifyIdentifier(value: string): string {
    return value
        .replace(/^minecraft:/, "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character: string): string => character.toUpperCase());
}

function describeEvent(event: ParsedLilyMoneyEvent): string {
    const person = event.people[0]?.displayName ?? "Unknown player";
    const secondPerson = event.people[1]?.displayName ?? "Unknown player";
    const amount = formatLilyMoneyCents(event.amountCents);
    const quantity = event.quantity ?? 0;
    const item = displayItemName(event);

    switch (event.type) {
        case "JOB_REWARD":
            return `${person} earned ${amount} from ${prettifyIdentifier(event.jobId ?? "job")} • ${item}`;
        case "SHOP_BUY":
            return `${person} bought ${quantity.toLocaleString()} × ${item} for ${amount}`;
        case "SHOP_SELL":
            return `${person} sold ${quantity.toLocaleString()} × ${item} for ${amount}`;
        case "PAY":
            return `${person} paid ${secondPerson} ${amount}`;
        case "AH_BUY":
            return `${person} bought ${quantity.toLocaleString()} × ${item} from ${secondPerson} for ${amount}`;
        case "BUY_COMMAND":
            return `${person} ran a buy command for ${secondPerson} • ${amount}`;
        case "SELL_COMMAND":
            return `${person} ran a sell command for ${secondPerson} • ${amount}`;
        case "ADD_MONEY":
            return `${person} added ${amount} to ${secondPerson}`;
        case "REMOVE_MONEY":
            return `${person} removed ${amount} from ${secondPerson}`;
        case "SET_MONEY":
            return `${person} set ${secondPerson}'s balance to ${amount}`;
        case "PLAYER_JOIN":
            return `${person} joined the world`;
        case "PLAYER_LEAVE":
            return `${person} left the world`;
        case "BALANCE_CHECKPOINT":
            return `${person} balance checkpoint • ${event.reason || "checkpoint"}`;
        case "FULL_BALANCE_CHECKPOINT":
            return `Full balance checkpoint • ${event.fullCheckpointRows.length.toLocaleString()} player${event.fullCheckpointRows.length === 1 ? "" : "s"}`;
        case "LOGGING_ENABLED":
            return `${person} enabled LilyMoney logging`;
        case "LOGGING_DISABLED":
            return `${person} disabled LilyMoney logging`;
        default:
            return event.type;
    }
}

function formatWhen(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

function formatShortWhen(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatAxisWhen(timestamp: number, span: number): string {
    if (span <= 36 * 60 * 60 * 1000) {
        return new Date(timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    if (span <= 120 * 24 * 60 * 60 * 1000) {
        return new Date(timestamp).toLocaleDateString(undefined, {
            month: "short",
            day: "2-digit",
        });
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
    });
}

function niceMoneyAxis(minimum: number, maximum: number, targetTicks: number = 6): {
    minimum: number;
    maximum: number;
    ticks: number[];
} {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        return { minimum: 0, maximum: 100, ticks: [0, 20, 40, 60, 80, 100] };
    }

    if (minimum === maximum) {
        minimum -= 100;
        maximum += 100;
    }

    const rawStep = Math.max(1, (maximum - minimum) / Math.max(1, targetTicks - 1));
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = niceNormalized * magnitude;
    const axisMinimum = Math.floor(minimum / step) * step;
    const axisMaximum = Math.ceil(maximum / step) * step;
    const tickCount = Math.round((axisMaximum - axisMinimum) / step);
    const ticks = Array.from({ length: tickCount + 1 }, (_: unknown, index: number): number =>
        axisMinimum + step * index
    );

    return { minimum: axisMinimum, maximum: axisMaximum, ticks };
}

function formatSignedCents(cents: number): string {
    if (cents > 0) return `+${formatLilyMoneyCents(cents)}`;
    return formatLilyMoneyCents(cents);
}

function eventEffectForPlayer(
    event: ParsedLilyMoneyEvent,
    identityId: string
): LilyMoneyEventEffect | null {
    return (
        event.effects.find(
            (effect: LilyMoneyEventEffect): boolean => effect.identityId === identityId
        ) ?? null
    );
}

function playerBalanceTimeline(
    analysis: LilyMoneyAnalysis,
    selectedIdentityId: string
): BalanceTimeline {
    if (selectedIdentityId === "all") {
        const points: BalancePoint[] = [];

        for (const event of analysis.events) {
            if (event.type !== "FULL_BALANCE_CHECKPOINT") continue;

            const balances: number[] = event.fullCheckpointRows
                .map((row): number | null => row.balanceCents)
                .filter((value: number | null): value is number => value !== null);

            if (balances.length === 0) continue;

            points.push({
                recordId: event.record.id,
                timestamp: event.record.timestamp,
                balanceCents: balances.reduce(
                    (sum: number, value: number): number => sum + value,
                    0
                ),
            });
        }

        return {
            segments: points.length > 0 ? [points] : [],
            pointCount: points.length,
            cleanOfflineSpans: 0,
        };
    }

    const segments: BalancePoint[][] = [];
    let current: BalancePoint[] = [];
    let connected: boolean | null = null;
    let trusted = true;
    let lastDisplayBalance: number | null = null;
    let lastDisplayTimestamp: number | null = null;
    let pointCount = 0;
    let cleanOfflineSpans = 0;

    const appendPoint = (
        recordId: number,
        timestamp: number,
        balanceCents: number
    ): void => {
        const point: BalancePoint = {
            recordId,
            timestamp,
            balanceCents,
        };

        const previous = current[current.length - 1];
        if (
            !previous ||
            previous.timestamp !== point.timestamp ||
            previous.balanceCents !== point.balanceCents
        ) {
            current.push(point);
            pointCount += 1;
        }

        lastDisplayBalance = balanceCents;
        lastDisplayTimestamp = timestamp;
    };

    const closeSegment = (): void => {
        if (current.length > 0) {
            segments.push(current);
            current = [];
        }
    };

    for (const event of analysis.events) {
        if (event.type === "LOGGING_DISABLED") {
            closeSegment();
            trusted = false;
            connected = null;
            lastDisplayBalance = null;
            lastDisplayTimestamp = null;
            continue;
        }

        if (event.type === "LOGGING_ENABLED") {
            trusted = true;
            connected = null;
            lastDisplayBalance = null;
            lastDisplayTimestamp = null;
            continue;
        }

        const matchingEffects = event.effects.filter(
            (effect: LilyMoneyEventEffect): boolean =>
                effect.identityId === selectedIdentityId &&
                effect.balanceAfterCents !== null
        );

        for (const effect of matchingEffects) {
            if (!trusted || effect.balanceAfterCents === null) continue;

            const timestamp = event.record.timestamp;
            const balance = effect.balanceAfterCents;

            if (event.type === "PLAYER_JOIN") {
                if (
                    connected === false &&
                    lastDisplayBalance !== null &&
                    current.length > 0
                ) {
                    const leaveBalance = lastDisplayBalance;

                    // Cleanly known offline interval: keep the visual balance
                    // flat until reconnect, then show any offline change as an
                    // instantaneous jump at the JOIN timestamp.
                    appendPoint(event.record.id, timestamp, leaveBalance);

                    if (balance !== leaveBalance) {
                        appendPoint(event.record.id, timestamp, balance);
                    }

                    cleanOfflineSpans += 1;
                } else if (connected === true) {
                    // JOIN without a prior LEAVE: session boundary is ambiguous,
                    // so do not invent a continuous line across it.
                    closeSegment();
                    appendPoint(event.record.id, timestamp, balance);
                } else if (current.length > 0) {
                    closeSegment();
                    appendPoint(event.record.id, timestamp, balance);
                } else {
                    appendPoint(event.record.id, timestamp, balance);
                }

                connected = true;
                continue;
            }

            if (event.type === "PLAYER_LEAVE") {
                appendPoint(event.record.id, timestamp, balance);
                connected = false;
                continue;
            }

            if (connected === false) {
                // Exact money changes may occur while the player is offline,
                // but Balance History intentionally stays flat until reconnect.
                continue;
            }

            appendPoint(event.record.id, timestamp, balance);
        }
    }

    if (
        trusted &&
        connected === false &&
        current.length > 0 &&
        lastDisplayBalance !== null &&
        lastDisplayTimestamp !== null &&
        analysis.events.length > 0
    ) {
        const finalEvent = analysis.events[analysis.events.length - 1];
        if (finalEvent && finalEvent.record.timestamp > lastDisplayTimestamp) {
            appendPoint(
                finalEvent.record.id,
                finalEvent.record.timestamp,
                lastDisplayBalance
            );
        }
    }

    closeSegment();

    return {
        segments,
        pointCount,
        cleanOfflineSpans,
    };
}

function balanceChartMarkers(
    analysis: LilyMoneyAnalysis,
    selectedIdentityId: string
): ChartMarker[] {
    if (selectedIdentityId === "all") return [];

    const markers: ChartMarker[] = [];

    for (const event of analysis.events) {
        if (event.type === "LOGGING_DISABLED") {
            markers.push({
                timestamp: event.record.timestamp,
                label: "Logging disabled",
                tone: "logging",
            });
            continue;
        }

        if (event.type === "LOGGING_ENABLED") {
            markers.push({
                timestamp: event.record.timestamp,
                label: "Logging enabled",
                tone: "logging",
            });
            continue;
        }

        if (!eventMatchesPlayer(event, selectedIdentityId)) continue;

        if (event.type === "PLAYER_JOIN") {
            markers.push({
                timestamp: event.record.timestamp,
                label: "Joined",
                tone: "join",
            });
        } else if (event.type === "PLAYER_LEAVE") {
            markers.push({
                timestamp: event.record.timestamp,
                label: "Left",
                tone: "leave",
            });
        }
    }

    return markers;
}

function netLoggedFlowPoints(
    analysis: LilyMoneyAnalysis,
    selectedIdentityId: string
): BalancePoint[] {
    const points: BalancePoint[] = [];
    let cumulative: number = 0;

    for (const event of analysis.events) {
        let eventDelta: number = 0;

        for (const effect of event.effects) {
            if (effect.assignment || effect.deltaCents === null) continue;
            if (selectedIdentityId !== "all" && effect.identityId !== selectedIdentityId) {
                continue;
            }

            eventDelta += effect.deltaCents;
        }

        if (eventDelta === 0) continue;

        cumulative += eventDelta;
        points.push({
            recordId: event.record.id,
            timestamp: event.record.timestamp,
            balanceCents: cumulative,
        });
    }

    return points;
}

function sampleBalancePoints(points: BalancePoint[], maximum: number = 420): BalancePoint[] {
    if (points.length <= maximum) return points;

    const result: BalancePoint[] = [];
    const lastIndex: number = points.length - 1;

    for (let index: number = 0; index < maximum; index++) {
        const sourceIndex: number = Math.round((index / (maximum - 1)) * lastIndex);
        const point = points[sourceIndex];
        if (point) result.push(point);
    }

    return result;
}

function TimeSeriesChart(props: {
    theme: WorkspaceTheme;
    title: string;
    subtitle: string;
    segments: BalancePoint[][];
    emptyText: string;
    xMode: "time" | "events";
    markers?: ChartMarker[];
}): JSX.Element {
    const theme = props.theme;
    const nonEmptySegments = props.segments.filter(
        (segment: BalancePoint[]): boolean => segment.length > 0
    );
    const perSegmentMaximum = Math.max(
        90,
        Math.floor(600 / Math.max(1, nonEmptySegments.length))
    );
    const sampledSegments: BalancePoint[][] = nonEmptySegments.map(
        (segment: BalancePoint[]): BalancePoint[] =>
            sampleBalancePoints(segment, perSegmentMaximum)
    );
    const sampled: BalancePoint[] = sampledSegments.flat();

    if (sampled.length === 0) {
        return (
            <div
                style={{
                    ...panelStyle(theme),
                    minHeight: "310px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    textAlign: "center",
                    color: theme.muted,
                }}
            >
                <div style={{ fontWeight: 650, color: theme.text, marginBottom: "7px" }}>
                    {props.title}
                </div>
                {props.emptyText}
            </div>
        );
    }

    const width = 1000;
    const height = 330;
    const left = 104;
    const right = 26;
    const top = 26;
    const bottom = 58;

    const values: number[] = sampled.map((point: BalancePoint): number => point.balanceCents);
    const axis = niceMoneyAxis(Math.min(...values), Math.max(...values));
    const minimum = axis.minimum;
    const maximum = axis.maximum;
    const range: number = maximum - minimum;
    const xSpan: number = width - left - right;
    const ySpan: number = height - top - bottom;

    const minimumTime = Math.min(...sampled.map((point: BalancePoint): number => point.timestamp));
    const maximumTime = Math.max(...sampled.map((point: BalancePoint): number => point.timestamp));
    const timeSpan = Math.max(1, maximumTime - minimumTime);
    const visibleMarkers: ChartMarker[] = (props.markers ?? [])
        .filter((marker: ChartMarker): boolean => marker.timestamp >= minimumTime && marker.timestamp <= maximumTime)
        .slice(-60);

    const markerColor = (marker: ChartMarker): string =>
        marker.tone === "join"
            ? theme.teal
            : marker.tone === "leave"
              ? theme.warning
              : theme.danger;

    const eventIndexes = new Map<BalancePoint, number>();
    sampled.forEach((point: BalancePoint, index: number): void => {
        eventIndexes.set(point, index);
    });

    const pointX = (point: BalancePoint): number => {
        if (props.xMode === "time") {
            return left + ((point.timestamp - minimumTime) / timeSpan) * xSpan;
        }

        const index = eventIndexes.get(point) ?? 0;
        return sampled.length === 1
            ? left + xSpan / 2
            : left + (index / (sampled.length - 1)) * xSpan;
    };

    const pointY = (point: BalancePoint): number =>
        top + ((maximum - point.balanceCents) / range) * ySpan;

    const first = sampled[0]!;
    const last = sampled[sampled.length - 1]!;
    const zeroY = minimum < 0 && maximum > 0
        ? top + ((maximum - 0) / range) * ySpan
        : null;
    const yTicks = [...axis.ticks].reverse();
    const xTicks = Array.from({ length: 5 }, (_: unknown, index: number): number => index / 4);

    return (
        <div style={{ ...panelStyle(theme), padding: "16px", minHeight: "360px" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "8px",
                }}
            >
                <div>
                    <div style={{ fontWeight: 680 }}>{props.title}</div>
                    <div style={smallMutedStyle(theme)}>{props.subtitle}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 680 }}>
                        {formatLilyMoneyCents(last.balanceCents)}
                    </div>
                    <div style={smallMutedStyle(theme)}>latest value</div>
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: "14px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    ...smallMutedStyle(theme),
                }}
            >
                <span style={{ color: theme.positive, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", background: theme.positive }} /> Gain
                </span>
                <span style={{ color: theme.negative, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", background: theme.negative }} /> Loss
                </span>
                <span style={{ color: theme.muted, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", background: theme.muted }} /> No change
                </span>
                {visibleMarkers.some((marker: ChartMarker): boolean => marker.tone === "join") ? (
                    <span style={{ color: theme.teal }}>│ Join</span>
                ) : null}
                {visibleMarkers.some((marker: ChartMarker): boolean => marker.tone === "leave") ? (
                    <span style={{ color: theme.warning }}>│ Leave</span>
                ) : null}
                {visibleMarkers.some((marker: ChartMarker): boolean => marker.tone === "logging") ? (
                    <span style={{ color: theme.danger }}>┆ Logging boundary</span>
                ) : null}
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "100%", height: "315px", overflow: "visible", marginTop: "4px" }}
                aria-label={props.title}
            >
                {yTicks.map((tick: number, index: number): JSX.Element => {
                    const y = top + (index / (yTicks.length - 1)) * ySpan;
                    return (
                        <g key={`y-${index}`}>
                            <line
                                x1={left}
                                y1={y}
                                x2={width - right}
                                y2={y}
                                stroke={index === 0 || index === yTicks.length - 1 ? theme.borderStrong : theme.border}
                                stroke-width="1"
                                shape-rendering="crispEdges"
                            />
                            <text
                                x={left - 10}
                                y={y + 4}
                                text-anchor="end"
                                fill={theme.muted}
                                font-size="13"
                            >
                                {formatLilyMoneyCents(Math.round(tick))}
                            </text>
                        </g>
                    );
                })}

                {xTicks.map((ratio: number, index: number): JSX.Element => {
                    const x = left + ratio * xSpan;
                    const label = props.xMode === "time"
                        ? formatAxisWhen(Math.round(minimumTime + ratio * timeSpan), timeSpan)
                        : `${Math.round(ratio * Math.max(0, sampled.length - 1)).toLocaleString()}`;
                    return (
                        <g key={`x-${index}`}>
                            <line
                                x1={x}
                                y1={top}
                                x2={x}
                                y2={top + ySpan}
                                stroke={theme.border}
                                stroke-width="1"
                                opacity="0.45"
                                shape-rendering="crispEdges"
                            />
                            <text
                                x={x}
                                y={height - 18}
                                text-anchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
                                fill={theme.muted}
                                font-size="12"
                            >
                                {label}
                            </text>
                        </g>
                    );
                })}

                {zeroY !== null ? (
                    <line
                        x1={left}
                        y1={zeroY}
                        x2={width - right}
                        y2={zeroY}
                        stroke={theme.muted}
                        stroke-width="1.2"
                        stroke-dasharray="6 5"
                    />
                ) : null}

                {props.xMode === "time"
                    ? visibleMarkers.map((marker: ChartMarker, index: number): JSX.Element => {
                          const x = left + ((marker.timestamp - minimumTime) / timeSpan) * xSpan;
                          return (
                              <g key={`${marker.timestamp}-${marker.label}-${index}`}>
                                  <line
                                      x1={x}
                                      y1={top}
                                      x2={x}
                                      y2={top + ySpan}
                                      stroke={markerColor(marker)}
                                      stroke-width="1.5"
                                      stroke-dasharray={marker.tone === "logging" ? "3 4" : "5 5"}
                                      opacity="0.8"
                                  >
                                      <title>{`${marker.label} • ${formatWhen(marker.timestamp)}`}</title>
                                  </line>
                                  <rect x={x - 3} y={top + 2} width="6" height="6" fill={markerColor(marker)}>
                                      <title>{`${marker.label} • ${formatWhen(marker.timestamp)}`}</title>
                                  </rect>
                              </g>
                          );
                      })
                    : null}

                {sampledSegments.map((segment: BalancePoint[], segmentIndex: number): JSX.Element => (
                    <g key={`segment-${segmentIndex}`}>
                        {segment.length === 1 ? (
                            <rect
                                x={pointX(segment[0]!) - 4}
                                y={pointY(segment[0]!) - 4}
                                width="8"
                                height="8"
                                fill={theme.accent}
                            />
                        ) : null}

                        {segment.slice(0, -1).map((point: BalancePoint, index: number): JSX.Element => {
                            const next = segment[index + 1]!;
                            const directionColor = next.balanceCents > point.balanceCents
                                ? theme.positive
                                : next.balanceCents < point.balanceCents
                                  ? theme.negative
                                  : theme.muted;

                            return (
                                <line
                                    key={`${segmentIndex}-${point.recordId}-${index}`}
                                    x1={pointX(point)}
                                    y1={pointY(point)}
                                    x2={pointX(next)}
                                    y2={pointY(next)}
                                    stroke={directionColor}
                                    stroke-width="3"
                                    stroke-linecap="square"
                                />
                            );
                        })}
                    </g>
                ))}
            </svg>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    ...smallMutedStyle(theme),
                }}
            >
                <span>{formatShortWhen(first.timestamp)}</span>
                <span>{sampled.length.toLocaleString()} plotted points</span>
                <span>{formatShortWhen(last.timestamp)}</span>
            </div>
        </div>
    );
}

function HorizontalBarChart(props: {
    theme: WorkspaceTheme;
    title: string;
    subtitle?: string;
    rows: BarRow[];
    emptyText: string;
    maximumRows?: number;
    tone?: "positive" | "negative" | "mixed";
    headerRight?: JSX.Element;
}): JSX.Element {
    const theme = props.theme;
    const rows: BarRow[] = props.rows
        .filter((row: BarRow): boolean => row.valueCents !== 0)
        .sort((a: BarRow, b: BarRow): number => Math.abs(b.valueCents) - Math.abs(a.valueCents))
        .slice(0, props.maximumRows ?? 10);

    const maximum: number = rows.reduce(
        (value: number, row: BarRow): number => Math.max(value, Math.abs(row.valueCents)),
        0
    );

    return (
        <div style={{ ...panelStyle(theme), padding: "16px", minHeight: "220px" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div style={{ fontWeight: 680 }}>{props.title}</div>
                    {props.subtitle ? (
                        <div style={{ ...smallMutedStyle(theme), marginTop: "2px" }}>{props.subtitle}</div>
                    ) : null}
                </div>
                {props.headerRight ?? null}
            </div>

            {rows.length === 0 ? (
                <div style={{ color: theme.muted, padding: "42px 8px", textAlign: "center" }}>
                    {props.emptyText}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                    {rows.map((row: BarRow, index: number): JSX.Element => {
                        const widthPercent: number = maximum === 0
                            ? 0
                            : (Math.abs(row.valueCents) / maximum) * 100;
                        const mixedPalette = [
                            theme.accent,
                            theme.blue,
                            theme.teal,
                            theme.positive,
                            theme.warning,
                        ];
                        const color = props.tone === "positive"
                            ? theme.positive
                            : props.tone === "negative"
                              ? theme.negative
                              : row.valueCents < 0
                                ? theme.negative
                                : mixedPalette[index % mixedPalette.length]!;

                        return (
                            <div key={`${row.label}-${index}`}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        gap: "14px",
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                                            {row.label}
                                        </div>
                                        {row.detail ? (
                                            <div style={smallMutedStyle(theme)}>{row.detail}</div>
                                        ) : null}
                                    </div>
                                    <div style={{ fontWeight: 650, whiteSpace: "nowrap", color }}>
                                        {formatLilyMoneyCents(row.valueCents)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        height: "7px",
                                        borderRadius: "0",
                                        background: theme.panelStrong,
                                        marginTop: "6px",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${Math.max(2, widthPercent)}%`,
                                            borderRadius: "0",
                                            background: color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MoneyBarGraph(props: {
    theme: WorkspaceTheme;
    title: string;
    subtitle?: string;
    rows: BarRow[];
    emptyText: string;
    tone: "positive" | "negative";
    maximumRows?: number;
}): JSX.Element {
    const theme = props.theme;
    const rows = props.rows
        .filter((row: BarRow): boolean => row.valueCents > 0)
        .sort((a: BarRow, b: BarRow): number => b.valueCents - a.valueCents)
        .slice(0, props.maximumRows ?? 14);
    const color = props.tone === "positive" ? theme.positive : theme.negative;

    if (rows.length === 0) {
        return (
            <div
                style={{
                    ...panelStyle(theme),
                    minHeight: "320px",
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div style={{ fontWeight: 680 }}>{props.title}</div>
                {props.subtitle ? (
                    <div style={{ ...smallMutedStyle(theme), marginTop: "2px" }}>{props.subtitle}</div>
                ) : null}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.muted,
                        textAlign: "center",
                    }}
                >
                    {props.emptyText}
                </div>
            </div>
        );
    }

    const width = 1000;
    const top = 26;
    const bottom = 40;
    const labelWidth = 230;
    const valueWidth = 125;
    const rowHeight = 44;
    const plotLeft = labelWidth;
    const plotRight = width - valueWidth;
    const plotWidth = plotRight - plotLeft;
    const height = top + bottom + rows.length * rowHeight;
    const maximum = Math.max(...rows.map((row: BarRow): number => row.valueCents));
    const axis = niceMoneyAxis(0, maximum, 5);
    const axisMaximum = Math.max(1, axis.maximum);

    return (
        <div style={{ ...panelStyle(theme), padding: "18px", overflow: "hidden" }}>
            <div style={{ fontWeight: 680 }}>{props.title}</div>
            {props.subtitle ? (
                <div style={{ ...smallMutedStyle(theme), marginTop: "2px" }}>{props.subtitle}</div>
            ) : null}

            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                    width: "100%",
                    minHeight: "300px",
                    maxHeight: "540px",
                    marginTop: "10px",
                    display: "block",
                }}
                aria-label={props.title}
            >
                {axis.ticks.map((tick: number, index: number): JSX.Element => {
                    const fraction = tick / axisMaximum;
                    const x = plotLeft + plotWidth * fraction;
                    return (
                        <g key={`grid-${tick}`}>
                            <line
                                x1={x}
                                y1={top - 6}
                                x2={x}
                                y2={height - bottom + 4}
                                stroke={index === 0 ? theme.borderStrong : theme.border}
                                stroke-width="1"
                                shape-rendering="crispEdges"
                            />
                            <text
                                x={x}
                                y={height - 10}
                                fill={theme.muted}
                                font-size="12"
                                text-anchor={index === 0 ? "start" : index === axis.ticks.length - 1 ? "end" : "middle"}
                            >
                                {formatLilyMoneyCents(Math.round(tick))}
                            </text>
                        </g>
                    );
                })}

                {rows.map((row: BarRow, index: number): JSX.Element => {
                    const y = top + index * rowHeight;
                    const barHeight = 22;
                    const barY = y + 9;
                    const barWidth = maximum === 0
                        ? 0
                        : (row.valueCents / axisMaximum) * plotWidth;

                    return (
                        <g key={`${row.label}-${index}`}>
                            <text
                                x="4"
                                y={barY + 15}
                                fill={theme.text}
                                font-size="15"
                                font-weight="600"
                            >
                                {row.label.length > 28 ? `${row.label.slice(0, 27)}…` : row.label}
                            </text>
                            <rect
                                x={plotLeft}
                                y={barY}
                                width={plotWidth}
                                height={barHeight}
                                rx="0"
                                fill={theme.panelStrong}
                            />
                            <rect
                                x={plotLeft}
                                y={barY}
                                width={Math.max(2, barWidth)}
                                height={barHeight}
                                rx="0"
                                fill={color}
                            />
                            <text
                                x={plotRight + 12}
                                y={barY + 15}
                                fill={color}
                                font-size="15"
                                font-weight="700"
                            >
                                {formatLilyMoneyCents(row.valueCents)}
                            </text>
                        </g>
                    );
                })}

            </svg>
        </div>
    );
}

function MetricCard(props: {
    theme: WorkspaceTheme;
    title: string;
    value: string;
    detail?: string;
    large?: boolean;
    accent?: string;
}): JSX.Element {
    const theme = props.theme;

    return (
        <div
            style={{
                ...panelStyle(theme),
                padding: props.large ? "20px" : "16px",
                minWidth: 0,
                borderTop: `3px solid ${props.accent ?? theme.accent}`,
            }}
        >
            <div style={{ ...smallMutedStyle(theme), marginBottom: "8px" }}>{props.title}</div>
            <div
                style={{
                    fontSize: props.large ? "30px" : "22px",
                    fontWeight: 740,
                    lineHeight: 1.05,
                    overflowWrap: "anywhere",
                }}
            >
                {props.value}
            </div>
            {props.detail ? (
                <div style={{ ...smallMutedStyle(theme), marginTop: "8px" }}>{props.detail}</div>
            ) : null}
        </div>
    );
}

function Badge(props: {
    theme: WorkspaceTheme;
    label: string;
    tone?: "accent" | "positive" | "negative" | "warning" | "muted";
}): JSX.Element {
    const theme = props.theme;
    const color =
        props.tone === "positive"
            ? theme.positive
            : props.tone === "negative"
              ? theme.negative
              : props.tone === "warning"
                ? theme.warning
                : props.tone === "muted"
                  ? theme.muted
                  : theme.accent;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                border: `1px solid ${color}66`,
                borderRadius: "0",
                color,
                background: `${color}16`,
                padding: "2px 7px",
                fontSize: "11px",
                fontWeight: 650,
                lineHeight: 1.4,
                whiteSpace: "nowrap",
            }}
        >
            {props.label}
        </span>
    );
}

function EmptyState(props: {
    theme: WorkspaceTheme;
    title: string;
    detail: string;
}): JSX.Element {
    return (
        <div
            style={{
                ...panelStyle(props.theme),
                padding: "34px",
                textAlign: "center",
                color: props.theme.muted,
            }}
        >
            <div style={{ fontWeight: 680, color: props.theme.text }}>{props.title}</div>
            <div style={{ marginTop: "6px" }}>{props.detail}</div>
        </div>
    );
}

function RecentActivity(props: {
    theme: WorkspaceTheme;
    events: ParsedLilyMoneyEvent[];
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const events: ParsedLilyMoneyEvent[] = props.events
        .filter((event: ParsedLilyMoneyEvent): boolean =>
            eventMatchesPlayer(event, props.selectedIdentityId)
        )
        .slice(-10)
        .reverse();

    return (
        <div style={{ ...panelStyle(theme), overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ fontWeight: 680 }}>Recent Activity</div>
                <div style={smallMutedStyle(theme)}>Newest saved activity first</div>
            </div>

            {events.length === 0 ? (
                <div style={{ padding: "24px", color: theme.muted }}>No matching activity.</div>
            ) : (
                events.map((event: ParsedLilyMoneyEvent): JSX.Element => (
                    <div
                        key={event.record.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "76px minmax(0, 1fr) auto",
                            gap: "12px",
                            alignItems: "center",
                            padding: "12px 18px",
                            borderBottom: `1px solid ${theme.border}`,
                        }}
                    >
                        <code style={{ color: theme.muted }}>#{event.record.id}</code>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ overflowWrap: "anywhere" }}>{describeEvent(event)}</div>
                            <div style={smallMutedStyle(theme)}>{formatWhen(event.record.timestamp)}</div>
                        </div>
                        <Badge theme={theme} tone="muted" label={event.type} />
                    </div>
                ))
            )}
        </div>
    );
}

function TopBalances(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
}): JSX.Element {
    const rows = [...props.analysis.players]
        .map((player: LilyMoneyPlayerAnalysis) => ({
            player,
            balance: currentPlayerBalance(player),
        }))
        .filter((row): row is { player: LilyMoneyPlayerAnalysis; balance: number } => row.balance !== null)
        .sort((a, b): number => b.balance - a.balance)
        .slice(0, 8);

    return (
        <div style={{ ...panelStyle(props.theme), overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${props.theme.border}` }}>
                <div style={{ fontWeight: 680 }}>Top Balances</div>
                <div style={smallMutedStyle(props.theme)}>Current tracked balances</div>
            </div>
            {rows.length === 0 ? (
                <div style={{ padding: "24px", color: props.theme.muted }}>No balances available.</div>
            ) : (
                rows.map((row, index: number): JSX.Element => (
                    <div
                        key={row.player.identityId || row.player.displayName}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "42px minmax(0, 1fr) auto",
                            gap: "10px",
                            alignItems: "center",
                            padding: "11px 18px",
                            borderBottom: `1px solid ${props.theme.border}`,
                        }}
                    >
                        <div style={{ color: props.theme.muted }}>#{index + 1}</div>
                        <div>
                            <div style={{ fontWeight: 600 }}>{row.player.displayName}</div>
                            <div style={smallMutedStyle(props.theme)}>Identity {row.player.identityId || "unknown"}</div>
                        </div>
                        <div style={{ fontWeight: 680 }}>{formatLilyMoneyCents(row.balance)}</div>
                    </div>
                ))
            )}
        </div>
    );
}

const AUDIT_PAYMENT_CENTS = 5_000_000;
const AUDIT_AH_CENTS = 10_000_000;
const AUDIT_LARGE_CENTS = 25_000_000;

function auditReasonForEvent(event: ParsedLilyMoneyEvent): string | null {
    const amount = Math.abs(event.amountCents ?? 0);

    if (event.type === "SET_MONEY") {
        return "Administrative SET MONEY changed a player's balance.";
    }
    if (event.type === "ADD_MONEY") {
        return "Administrative ADD MONEY injected money into a player's balance.";
    }
    if (event.type === "REMOVE_MONEY") {
        return "Administrative REMOVE MONEY removed money from a player's balance.";
    }
    if (event.type === "PAY" && amount >= AUDIT_PAYMENT_CENTS) {
        return "Large direct player payment (at least $50,000).";
    }
    if (event.type === "AH_BUY" && amount >= AUDIT_AH_CENTS) {
        return "Large Auction House purchase (at least $100,000).";
    }
    if (amount >= AUDIT_LARGE_CENTS) {
        return "Very large single money movement (at least $250,000).";
    }

    return null;
}

function friendlyEventType(type: string): string {
    return type
        .toLocaleLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character: string): string => character.toLocaleUpperCase());
}

function latestServerCheckpoint(analysis: LilyMoneyAnalysis): ParsedLilyMoneyEvent | null {
    for (let index = analysis.events.length - 1; index >= 0; index--) {
        const event = analysis.events[index];
        if (event?.type === "FULL_BALANCE_CHECKPOINT" && event.fullCheckpointRows.length > 0) {
            return event;
        }
    }
    return null;
}

function serverCheckpointHistory(analysis: LilyMoneyAnalysis): Array<{
    recordId: number;
    timestamp: number;
    reason: string;
    playerCount: number;
    totalCents: number;
    changeCents: number | null;
}> {
    const rows: Array<{
        recordId: number;
        timestamp: number;
        reason: string;
        playerCount: number;
        totalCents: number;
        changeCents: number | null;
    }> = [];
    let previous: number | null = null;

    for (const event of analysis.events) {
        if (event.type !== "FULL_BALANCE_CHECKPOINT") continue;
        const balances = event.fullCheckpointRows
            .map((row): number | null => row.balanceCents)
            .filter((value: number | null): value is number => value !== null);
        if (balances.length === 0) continue;
        const totalCents = balances.reduce((sum: number, value: number): number => sum + value, 0);
        rows.push({
            recordId: event.record.id,
            timestamp: event.record.timestamp,
            reason: event.reason || "checkpoint",
            playerCount: balances.length,
            totalCents,
            changeCents: previous === null ? null : totalCents - previous,
        });
        previous = totalCents;
    }

    return rows;
}

function medianCents(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a: number, b: number): number => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[middle] ?? null;
    const left = sorted[middle - 1];
    const right = sorted[middle];
    return left === undefined || right === undefined ? null : Math.trunc((left + right) / 2);
}

function buildPlayerProfileMetrics(
    analysis: LilyMoneyAnalysis,
    identityId: string
): PlayerProfileMetrics | null {
    const player = getPlayer(analysis, identityId);
    if (!player) return null;

    const totals = {
        paySent: 0,
        payReceived: 0,
        shopBuy: 0,
        shopSell: 0,
        ahBuy: 0,
        ahSell: 0,
        buyCommand: 0,
        sellCommand: 0,
        adminAdd: 0,
        adminRemove: 0,
    };

    const boughtItems = new Map<string, { label: string; amountCents: number; quantity: number }>();
    const soldItems = new Map<string, { label: string; amountCents: number; quantity: number }>();
    const partners = new Map<string, { label: string; sentCents: number; receivedCents: number }>();
    const jobs = new Map<string, { label: string; amountCents: number; quantity: number }>();

    let transactionCount = 0;
    let jobRewardGroups = 0;
    let jobActions = 0;
    let exactObservationCount = 0;
    let firstExactBalanceCents: number | null = null;
    let firstSeen: number | null = null;
    let lastSeen: number | null = null;
    let biggestIncoming: { amountCents: number; label: string } | null = null;
    let biggestOutgoing: { amountCents: number; label: string } | null = null;
    let auditFlagCount = 0;
    let auditFlagVolumeCents = 0;
    let setMoneyCount = 0;

    const updateSeen = (timestamp: number): void => {
        firstSeen = firstSeen === null ? timestamp : Math.min(firstSeen, timestamp);
        lastSeen = lastSeen === null ? timestamp : Math.max(lastSeen, timestamp);
    };

    const addItem = (
        map: Map<string, { label: string; amountCents: number; quantity: number }>,
        label: string,
        amountCents: number,
        quantity: number
    ): void => {
        const key = label.toLocaleLowerCase();
        const row = map.get(key) ?? { label, amountCents: 0, quantity: 0 };
        row.amountCents += amountCents;
        row.quantity += quantity;
        map.set(key, row);
    };

    for (const event of analysis.events) {
        if (!eventMatchesPlayer(event, identityId)) continue;
        updateSeen(event.record.timestamp);

        const effect = eventEffectForPlayer(event, identityId);
        if (effect?.balanceAfterCents !== null && effect?.balanceAfterCents !== undefined) {
            exactObservationCount += 1;
            if (firstExactBalanceCents === null) firstExactBalanceCents = effect.balanceAfterCents;
        }

        if (event.type === "JOB_REWARD" && effect && event.amountCents !== null) {
            const jobId = event.jobId || "UNKNOWN";
            const label = prettifyIdentifier(jobId);
            const row = jobs.get(jobId) ?? { label, amountCents: 0, quantity: 0 };
            row.amountCents += event.amountCents;
            row.quantity += event.quantity ?? 0;
            jobs.set(jobId, row);
            jobRewardGroups += 1;
            jobActions += event.quantity ?? 0;
            continue;
        }

        const category = transactionCategory(event);
        if (category === null) continue;
        transactionCount += 1;

        const auditReason = auditReasonForEvent(event);
        if (auditReason) {
            auditFlagCount += 1;
            auditFlagVolumeCents += Math.abs(event.amountCents ?? 0);
        }

        if (!effect) continue;
        const amount = Math.abs(event.amountCents ?? effect.deltaCents ?? 0);
        const quantity = event.quantity ?? 0;
        const item = displayItemName(event);

        if (effect.deltaCents !== null && effect.deltaCents > 0) {
            const counterpart = event.type === "PAY"
                ? event.people.find((person): boolean => person.identityId !== identityId)?.displayName
                : event.type === "AH_BUY"
                  ? event.people.find((person): boolean => person.identityId !== identityId)?.displayName
                  : item;
            const candidate = { amountCents: effect.deltaCents, label: `${friendlyEventType(event.type)}${counterpart ? ` • ${counterpart}` : ""}` };
            if (!biggestIncoming || candidate.amountCents > biggestIncoming.amountCents) biggestIncoming = candidate;
        }
        if (effect.deltaCents !== null && effect.deltaCents < 0) {
            const counterpart = event.type === "PAY"
                ? event.people.find((person): boolean => person.identityId !== identityId)?.displayName
                : event.type === "AH_BUY"
                  ? event.people.find((person): boolean => person.identityId !== identityId)?.displayName
                  : item;
            const candidate = { amountCents: -effect.deltaCents, label: `${friendlyEventType(event.type)}${counterpart ? ` • ${counterpart}` : ""}` };
            if (!biggestOutgoing || candidate.amountCents > biggestOutgoing.amountCents) biggestOutgoing = candidate;
        }

        switch (event.type) {
            case "PAY": {
                const other = event.people.find((person): boolean => person.identityId !== identityId);
                if (effect.role === "sender") {
                    totals.paySent += amount;
                    if (other) {
                        const row = partners.get(other.identityId || other.displayName) ?? {
                            label: other.displayName,
                            sentCents: 0,
                            receivedCents: 0,
                        };
                        row.sentCents += amount;
                        partners.set(other.identityId || other.displayName, row);
                    }
                } else if (effect.role === "recipient") {
                    totals.payReceived += amount;
                    if (other) {
                        const row = partners.get(other.identityId || other.displayName) ?? {
                            label: other.displayName,
                            sentCents: 0,
                            receivedCents: 0,
                        };
                        row.receivedCents += amount;
                        partners.set(other.identityId || other.displayName, row);
                    }
                }
                break;
            }
            case "SHOP_BUY":
                totals.shopBuy += amount;
                addItem(boughtItems, item, amount, quantity);
                break;
            case "SHOP_SELL":
                totals.shopSell += amount;
                addItem(soldItems, item, amount, quantity);
                break;
            case "AH_BUY":
                if (effect.role === "buyer") {
                    totals.ahBuy += amount;
                    addItem(boughtItems, item, amount, quantity);
                } else if (effect.role === "seller") {
                    totals.ahSell += amount;
                    addItem(soldItems, item, amount, quantity);
                }
                break;
            case "BUY_COMMAND":
                if (effect.role === "target") totals.buyCommand += amount;
                break;
            case "SELL_COMMAND":
                if (effect.role === "target") totals.sellCommand += amount;
                break;
            case "ADD_MONEY":
                if (effect.role === "target") totals.adminAdd += amount;
                break;
            case "REMOVE_MONEY":
                if (effect.role === "target") totals.adminRemove += amount;
                break;
            case "SET_MONEY":
                if (effect.role === "target") setMoneyCount += 1;
                break;
        }
    }

    const pendingPlayer = analysis.pendingJobs.players.find(
        (pending): boolean => pending.identityId === identityId
    );
    if (pendingPlayer) {
        updateSeen(pendingPlayer.lastUpdatedAt);
        for (const reward of pendingPlayer.rewards) {
            if (reward.alreadyCanonical) continue;
            const row = jobs.get(reward.jobId) ?? {
                label: prettifyIdentifier(reward.jobId),
                amountCents: 0,
                quantity: 0,
            };
            row.amountCents += reward.amountCents;
            row.quantity += reward.quantity;
            jobs.set(reward.jobId, row);
            jobRewardGroups += 1;
            jobActions += reward.quantity;
        }
    }

    const topByAmount = <T extends { amountCents: number }>(rows: Iterable<T>): T | null => {
        let top: T | null = null;
        for (const row of rows) {
            if (!top || row.amountCents > top.amountCents) top = row;
        }
        return top;
    };

    let topPartner: { label: string; sentCents: number; receivedCents: number } | null = null;
    for (const partner of partners.values()) {
        if (!topPartner || partner.sentCents + partner.receivedCents > topPartner.sentCents + topPartner.receivedCents) {
            topPartner = partner;
        }
    }

    const breakdown: PlayerBreakdownRow[] = [
        { direction: "income", label: "Job rewards", amountCents: userFacingJobRewards(player) },
        { direction: "income", label: "Shop sales", amountCents: totals.shopSell },
        { direction: "income", label: "Auction House sales", amountCents: totals.ahSell },
        { direction: "income", label: "Player payments received", amountCents: totals.payReceived },
        { direction: "income", label: "Sell commands", amountCents: totals.sellCommand },
        { direction: "income", label: "Admin money added", amountCents: totals.adminAdd },
        { direction: "adjustment", label: "Unexplained money earned", amountCents: player.unexplainedEarnedCents },
        { direction: "spending", label: "Shop purchases", amountCents: totals.shopBuy },
        { direction: "spending", label: "Auction House purchases", amountCents: totals.ahBuy },
        { direction: "spending", label: "Player payments sent", amountCents: totals.paySent },
        { direction: "spending", label: "Buy commands", amountCents: totals.buyCommand },
        { direction: "spending", label: "Admin money removed", amountCents: totals.adminRemove },
        { direction: "adjustment", label: "Unexplained money lost", amountCents: player.unexplainedLostCents },
    ];

    return {
        identityId,
        displayName: player.displayName,
        aliases: player.aliases,
        firstSeen,
        lastSeen,
        transactionCount,
        jobRewardGroups,
        jobActions,
        exactObservationCount,
        firstExactBalanceCents,
        exactBalanceChangeCents:
            firstExactBalanceCents === null || currentPlayerBalance(player) === null
                ? null
                : (currentPlayerBalance(player) as number) - firstExactBalanceCents,
        breakdown,
        topJob: topByAmount(jobs.values()),
        topBought: topByAmount(boughtItems.values()),
        topSold: topByAmount(soldItems.values()),
        topPartner,
        biggestIncoming,
        biggestOutgoing,
        auditFlagCount,
        auditFlagVolumeCents,
        setMoneyCount,
    };
}

function playerLatestActivity(analysis: LilyMoneyAnalysis, identityId: string): number | null {
    let latest: number | null = null;
    for (const event of analysis.events) {
        if (!eventMatchesPlayer(event, identityId)) continue;
        latest = latest === null ? event.record.timestamp : Math.max(latest, event.record.timestamp);
    }
    const pending = analysis.pendingJobs.players.find((row): boolean => row.identityId === identityId);
    if (pending) latest = latest === null ? pending.lastUpdatedAt : Math.max(latest, pending.lastUpdatedAt);
    return latest;
}

function sortPlayersForSelector(
    analysis: LilyMoneyAnalysis,
    metricsById: Map<string, PlayerProfileMetrics>,
    mode: PlayerSortMode
): LilyMoneyPlayerAnalysis[] {
    const rows = [...analysis.players];
    const nameCompare = (a: LilyMoneyPlayerAnalysis, b: LilyMoneyPlayerAnalysis): number =>
        a.displayName.localeCompare(b.displayName);

    switch (mode) {
        case "richest":
            return rows.sort((a, b): number => (currentPlayerBalance(b) ?? Number.NEGATIVE_INFINITY) - (currentPlayerBalance(a) ?? Number.NEGATIVE_INFINITY) || nameCompare(a, b));
        case "poorest":
            return rows.sort((a, b): number => (currentPlayerBalance(a) ?? Number.POSITIVE_INFINITY) - (currentPlayerBalance(b) ?? Number.POSITIVE_INFINITY) || nameCompare(a, b));
        case "latest":
            return rows.sort((a, b): number => (playerLatestActivity(analysis, b.identityId) ?? 0) - (playerLatestActivity(analysis, a.identityId) ?? 0) || nameCompare(a, b));
        case "moneyMoved":
            return rows.sort((a, b): number => (b.moneyMovedCents + b.pendingJobRewardCents) - (a.moneyMovedCents + a.pendingJobRewardCents) || nameCompare(a, b));
        case "spending":
            return rows.sort((a, b): number => b.totalSpendingCents - a.totalSpendingCents || nameCompare(a, b));
        case "jobs":
            return rows.sort((a, b): number => userFacingJobRewards(b) - userFacingJobRewards(a) || nameCompare(a, b));
        case "audit":
            return rows.sort((a, b): number => (metricsById.get(b.identityId)?.auditFlagCount ?? 0) - (metricsById.get(a.identityId)?.auditFlagCount ?? 0) || nameCompare(a, b));
        case "name":
        default:
            return rows.sort(nameCompare);
    }
}

function RankingPanel(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    metricsById: Map<string, PlayerProfileMetrics>;
}): JSX.Element {
    const [metric, setMetric] = useState<"balance" | "moneyMoved" | "spending" | "jobs" | "audit">("balance");
    const rows = [...props.analysis.players]
        .map((player: LilyMoneyPlayerAnalysis) => {
            const metrics = props.metricsById.get(player.identityId);
            const value = metric === "balance"
                ? currentPlayerBalance(player) ?? Number.NEGATIVE_INFINITY
                : metric === "moneyMoved"
                  ? player.moneyMovedCents + player.pendingJobRewardCents
                  : metric === "spending"
                    ? player.totalSpendingCents
                    : metric === "jobs"
                      ? userFacingJobRewards(player)
                      : metrics?.auditFlagCount ?? 0;
            return { player, metrics, value };
        })
        .filter((row): boolean => Number.isFinite(row.value))
        .sort((a, b): number => b.value - a.value || a.player.displayName.localeCompare(b.player.displayName))
        .slice(0, 8);

    return (
        <div style={{ ...panelStyle(props.theme), overflow: "hidden" }}>
            <div
                style={{
                    padding: "14px 16px",
                    borderBottom: `1px solid ${props.theme.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div style={{ fontWeight: 680 }}>Rankings</div>
                    <div style={smallMutedStyle(props.theme)}>Compare players without adding separate leaderboards</div>
                </div>
                <select
                    class="search-mode-dropdown lilymoney-select"
                    value={metric}
                    onChange={(event: Event): void => setMetric((event.currentTarget as HTMLSelectElement).value as typeof metric)}
                    style={{ ...controlStyle(props.theme), minWidth: "160px" }}
                >
                    <option value="balance">Balance</option>
                    <option value="moneyMoved">Money moved</option>
                    <option value="spending">Spending</option>
                    <option value="jobs">Job rewards</option>
                    <option value="audit">Audit flags</option>
                </select>
            </div>
            {rows.map((row, index: number): JSX.Element => (
                <div
                    key={row.player.identityId || row.player.displayName}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "38px minmax(0, 1fr) auto",
                        gap: "10px",
                        alignItems: "center",
                        padding: "10px 16px",
                        borderBottom: `1px solid ${props.theme.border}`,
                    }}
                >
                    <div style={{ color: props.theme.muted }}>#{index + 1}</div>
                    <div>
                        <div style={{ fontWeight: 600 }}>{row.player.displayName}</div>
                        <div style={smallMutedStyle(props.theme)}>Identity {row.player.identityId || "unknown"}</div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 680 }}>
                        {metric === "audit" ? (
                            <>
                                <span style={{ color: row.value > 0 ? props.theme.warning : props.theme.muted }}>
                                    {row.value.toLocaleString()} flag{row.value === 1 ? "" : "s"}
                                </span>
                                {row.metrics && row.metrics.auditFlagVolumeCents > 0 ? (
                                    <div style={smallMutedStyle(props.theme)}>{formatLilyMoneyCents(row.metrics.auditFlagVolumeCents)} moved</div>
                                ) : null}
                            </>
                        ) : formatLilyMoneyCents(row.value)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function PlayerMoneyBreakdown(props: {
    theme: WorkspaceTheme;
    metrics: PlayerProfileMetrics;
}): JSX.Element {
    const rows = props.metrics.breakdown.filter((row): boolean => row.amountCents !== 0);
    return (
        <div style={{ ...panelStyle(props.theme), overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${props.theme.border}` }}>
                <div style={{ fontWeight: 680 }}>Money Breakdown</div>
                <div style={smallMutedStyle(props.theme)}>Where money came from and where it went</div>
            </div>
            {rows.length === 0 ? (
                <div style={{ padding: "24px", color: props.theme.muted }}>No money movement to break down.</div>
            ) : rows.map((row: PlayerBreakdownRow): JSX.Element => {
                const color = row.direction === "income"
                    ? props.theme.positive
                    : row.direction === "spending"
                      ? props.theme.negative
                      : props.theme.warning;
                return (
                    <div
                        key={`${row.direction}-${row.label}`}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "94px minmax(0, 1fr) auto",
                            gap: "10px",
                            padding: "9px 16px",
                            borderBottom: `1px solid ${props.theme.border}`,
                            alignItems: "center",
                        }}
                    >
                        <Badge
                            theme={props.theme}
                            tone={row.direction === "income" ? "positive" : row.direction === "spending" ? "negative" : "warning"}
                            label={row.direction === "income" ? "Income" : row.direction === "spending" ? "Spending" : "Audit"}
                        />
                        <span>{row.label}</span>
                        <strong style={{ color }}>{formatLilyMoneyCents(row.amountCents)}</strong>
                    </div>
                );
            })}
        </div>
    );
}

function PlayerHighlights(props: {
    theme: WorkspaceTheme;
    metrics: PlayerProfileMetrics;
}): JSX.Element {
    const rows: Array<{ label: string; value: string; tone?: "warning" }> = [
        {
            label: "Top job",
            value: props.metrics.topJob
                ? `${props.metrics.topJob.label} — ${formatLilyMoneyCents(props.metrics.topJob.amountCents)} from ${props.metrics.topJob.quantity.toLocaleString()} actions`
                : "None",
        },
        {
            label: "Top bought item",
            value: props.metrics.topBought
                ? `${props.metrics.topBought.label} — ${props.metrics.topBought.quantity.toLocaleString()} items / ${formatLilyMoneyCents(props.metrics.topBought.amountCents)}`
                : "None",
        },
        {
            label: "Top sold item",
            value: props.metrics.topSold
                ? `${props.metrics.topSold.label} — ${props.metrics.topSold.quantity.toLocaleString()} items / ${formatLilyMoneyCents(props.metrics.topSold.amountCents)}`
                : "None",
        },
        {
            label: "Top payment partner",
            value: props.metrics.topPartner
                ? `${props.metrics.topPartner.label} — sent ${formatLilyMoneyCents(props.metrics.topPartner.sentCents)}, received ${formatLilyMoneyCents(props.metrics.topPartner.receivedCents)}`
                : "None",
        },
        {
            label: "Largest incoming transaction",
            value: props.metrics.biggestIncoming
                ? `${formatLilyMoneyCents(props.metrics.biggestIncoming.amountCents)} — ${props.metrics.biggestIncoming.label}`
                : "None",
        },
        {
            label: "Largest outgoing transaction",
            value: props.metrics.biggestOutgoing
                ? `${formatLilyMoneyCents(props.metrics.biggestOutgoing.amountCents)} — ${props.metrics.biggestOutgoing.label}`
                : "None",
        },
        {
            label: "Audit flags",
            value: `${props.metrics.auditFlagCount.toLocaleString()} — ${formatLilyMoneyCents(props.metrics.auditFlagVolumeCents)} moved`,
            tone: "warning",
        },
        { label: "SET MONEY events", value: props.metrics.setMoneyCount.toLocaleString(), tone: props.metrics.setMoneyCount > 0 ? "warning" : undefined },
    ];

    return (
        <div style={{ ...panelStyle(props.theme), overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${props.theme.border}` }}>
                <div style={{ fontWeight: 680 }}>Highlights</div>
                <div style={smallMutedStyle(props.theme)}>Useful profile facts and audit-sensitive activity</div>
            </div>
            {rows.map((row): JSX.Element => (
                <div
                    key={row.label}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "190px minmax(0, 1fr)",
                        gap: "12px",
                        padding: "9px 16px",
                        borderBottom: `1px solid ${props.theme.border}`,
                    }}
                >
                    <span style={smallMutedStyle(props.theme)}>{row.label}</span>
                    <strong style={{ color: row.tone === "warning" ? props.theme.warning : props.theme.text }}>{row.value}</strong>
                </div>
            ))}
        </div>
    );
}

function PlayerDetails(props: {
    theme: WorkspaceTheme;
    metrics: PlayerProfileMetrics;
}): JSX.Element {
    const aliases = props.metrics.aliases.length > 0 ? props.metrics.aliases.join(", ") : props.metrics.displayName;
    return (
        <details style={{ ...panelStyle(props.theme), padding: "12px 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 680 }}>Player Details</summary>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                    gap: "10px 22px",
                    marginTop: "14px",
                    lineHeight: 1.5,
                }}
            >
                <div><strong>Identity:</strong> <code>{props.metrics.identityId || "unknown"}</code></div>
                <div><strong>Known names:</strong> {aliases}</div>
                <div><strong>First seen:</strong> {props.metrics.firstSeen === null ? "Unknown" : formatWhen(props.metrics.firstSeen)}</div>
                <div><strong>Last seen:</strong> {props.metrics.lastSeen === null ? "Unknown" : formatWhen(props.metrics.lastSeen)}</div>
                <div><strong>Transactions:</strong> {props.metrics.transactionCount.toLocaleString()}</div>
                <div><strong>Job reward groups:</strong> {props.metrics.jobRewardGroups.toLocaleString()}</div>
                <div><strong>Rewarded job actions:</strong> {props.metrics.jobActions.toLocaleString()}</div>
                <div><strong>Exact balance observations:</strong> {props.metrics.exactObservationCount.toLocaleString()}</div>
                <div><strong>First exact balance:</strong> {formatLilyMoneyCents(props.metrics.firstExactBalanceCents)}</div>
                <div><strong>Exact balance change:</strong> {formatLilyMoneyCents(props.metrics.exactBalanceChangeCents)}</div>
            </div>
        </details>
    );
}

function ServerCheckpointHistory(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
}): JSX.Element {
    const rows = serverCheckpointHistory(props.analysis).reverse();
    return (
        <details style={{ ...panelStyle(props.theme), padding: "12px 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 680 }}>
                Server Checkpoint History ({rows.length.toLocaleString()})
            </summary>
            <div style={{ overflow: "auto", marginTop: "12px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                    <thead>
                        <tr style={{ background: props.theme.panelAlt }}>
                            {["Record", "Date", "Reason", "Players", "Total Server Money", "Change"].map((heading): JSX.Element => (
                                <th key={heading} style={{ textAlign: heading === "Players" || heading.includes("Money") || heading === "Change" ? "right" : "left", padding: "9px 10px", color: props.theme.muted }}>
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row): JSX.Element => (
                            <tr key={row.recordId}>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}` }}><code>#{row.recordId}</code></td>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, whiteSpace: "nowrap" }}>{formatShortWhen(row.timestamp)}</td>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}` }}>{row.reason}</td>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right" }}>{row.playerCount.toLocaleString()}</td>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right", fontWeight: 650 }}>{formatLilyMoneyCents(row.totalCents)}</td>
                                <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right", color: row.changeCents === null ? props.theme.muted : row.changeCents > 0 ? props.theme.positive : row.changeCents < 0 ? props.theme.negative : props.theme.muted }}>
                                    {row.changeCents === null ? "—" : formatSignedCents(row.changeCents)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function OverviewPage(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    database: LilyMoneyDatabase;
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const selectedPlayer: LilyMoneyPlayerAnalysis | null =
        props.selectedIdentityId === "all"
            ? null
            : getPlayer(props.analysis, props.selectedIdentityId);
    const selectedMetrics = useMemo(
        (): PlayerProfileMetrics | null =>
            selectedPlayer ? buildPlayerProfileMetrics(props.analysis, selectedPlayer.identityId) : null,
        [props.analysis, selectedPlayer]
    );
    const allMetrics = useMemo((): Map<string, PlayerProfileMetrics> => {
        const result = new Map<string, PlayerProfileMetrics>();
        for (const player of props.analysis.players) {
            const metrics = buildPlayerProfileMetrics(props.analysis, player.identityId);
            if (metrics) result.set(player.identityId, metrics);
        }
        return result;
    }, [props.analysis]);

    const checkpoint = latestServerCheckpoint(props.analysis);
    const checkpointBalances = checkpoint
        ? checkpoint.fullCheckpointRows
              .map((row): number | null => row.balanceCents)
              .filter((value: number | null): value is number => value !== null)
        : [];
    const checkpointTotal = checkpointBalances.length > 0
        ? checkpointBalances.reduce((sum: number, value: number): number => sum + value, 0)
        : null;

    const balance: number | null = selectedPlayer
        ? currentPlayerBalance(selectedPlayer)
        : checkpointTotal ?? sumNullable(
              props.analysis.players.map(
                  (player: LilyMoneyPlayerAnalysis): number | null => currentPlayerBalance(player)
              )
          );

    const jobRewards: number = selectedPlayer
        ? userFacingJobRewards(selectedPlayer)
        : props.analysis.players.reduce(
              (sum: number, player: LilyMoneyPlayerAnalysis): number =>
                  sum + userFacingJobRewards(player),
              0
          );

    const income: number = selectedPlayer
        ? userFacingIncome(selectedPlayer)
        : props.analysis.players.reduce(
              (sum: number, player: LilyMoneyPlayerAnalysis): number =>
                  sum + userFacingIncome(player),
              0
          );

    const spending: number = selectedPlayer
        ? selectedPlayer.totalSpendingCents
        : props.analysis.players.reduce(
              (sum: number, player: LilyMoneyPlayerAnalysis): number =>
                  sum + player.totalSpendingCents,
              0
          );

    const balanceTimeline: BalanceTimeline = playerBalanceTimeline(
        props.analysis,
        props.selectedIdentityId
    );
    const markers = balanceChartMarkers(props.analysis, props.selectedIdentityId);

    const checkpointRows = serverCheckpointHistory(props.analysis);
    const firstCheckpoint = checkpointRows[0] ?? null;
    const lastCheckpoint = checkpointRows[checkpointRows.length - 1] ?? null;
    const exactServerChange = firstCheckpoint && lastCheckpoint
        ? lastCheckpoint.totalCents - firstCheckpoint.totalCents
        : null;
    const averageBalance = checkpointBalances.length > 0
        ? Math.trunc(checkpointBalances.reduce((sum, value): number => sum + value, 0) / checkpointBalances.length)
        : null;
    const medianBalance = medianCents(checkpointBalances);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>
                    {selectedPlayer ? selectedPlayer.displayName : "Economy Overview"}
                </h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    {selectedPlayer
                        ? `${selectedPlayer.participatingRecordCount.toLocaleString()} activity records • Identity ${selectedPlayer.identityId}`
                        : `${props.analysis.players.length.toLocaleString()} player${props.analysis.players.length === 1 ? "" : "s"} • ${props.database.records.length.toLocaleString()} saved records`}
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(240px, 1.35fr) repeat(3, minmax(170px, 1fr))",
                    gap: "12px",
                }}
            >
                <MetricCard
                    theme={theme}
                    title={selectedPlayer ? "Balance" : "Total Balance"}
                    value={formatLilyMoneyCents(balance)}
                    detail={selectedPlayer ? "Current tracked balance" : checkpoint ? `Latest full checkpoint • ${formatShortWhen(checkpoint.record.timestamp)}` : "Current tracked player total"}
                    large
                    accent={theme.accent}
                />
                <MetricCard
                    theme={theme}
                    title="Job Rewards"
                    value={formatLilyMoneyCents(jobRewards)}
                    detail="Rewards earned from jobs"
                    accent={theme.positive}
                />
                <MetricCard
                    theme={theme}
                    title="Income"
                    value={formatLilyMoneyCents(income)}
                    detail="Money received or earned"
                    accent={theme.positive}
                />
                <MetricCard
                    theme={theme}
                    title="Spending"
                    value={formatLilyMoneyCents(spending)}
                    detail="Money paid or spent"
                    accent={theme.negative}
                />
            </div>

            <TimeSeriesChart
                theme={theme}
                title="Balance History"
                subtitle={
                    props.selectedIdentityId === "all"
                        ? "Exact totals from full balance checkpoints"
                        : `${balanceTimeline.pointCount.toLocaleString()} exact observations • ${balanceTimeline.cleanOfflineSpans.toLocaleString()} offline span${balanceTimeline.cleanOfflineSpans === 1 ? "" : "s"} shown flat`
                }
                segments={balanceTimeline.segments}
                markers={markers}
                xMode="time"
                emptyText={
                    props.selectedIdentityId === "all"
                        ? "No full balance checkpoints are available yet."
                        : "No saved balance observations are available for this player yet."
                }
            />

            {props.selectedIdentityId === "all" ? (
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                            gap: "12px",
                        }}
                    >
                        <MetricCard theme={theme} title="Average Balance" value={formatLilyMoneyCents(averageBalance)} detail="Latest full checkpoint" accent={theme.blue} />
                        <MetricCard theme={theme} title="Median Balance" value={formatLilyMoneyCents(medianBalance)} detail="Latest full checkpoint" accent={theme.teal} />
                        <MetricCard theme={theme} title="Exact Server Change" value={formatLilyMoneyCents(exactServerChange)} detail={`${checkpointRows.length.toLocaleString()} full checkpoint${checkpointRows.length === 1 ? "" : "s"}`} accent={exactServerChange !== null && exactServerChange < 0 ? theme.negative : theme.positive} />
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(360px, 0.95fr) minmax(420px, 1.35fr)",
                            gap: "16px",
                        }}
                    >
                        <RankingPanel theme={theme} analysis={props.analysis} metricsById={allMetrics} />
                        <RecentActivity
                            theme={theme}
                            events={props.analysis.events}
                            selectedIdentityId={props.selectedIdentityId}
                        />
                    </div>
                    <ServerCheckpointHistory theme={theme} analysis={props.analysis} />
                </>
            ) : selectedMetrics ? (
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(360px, 1fr) minmax(420px, 1fr)",
                            gap: "16px",
                        }}
                    >
                        <PlayerMoneyBreakdown theme={theme} metrics={selectedMetrics} />
                        <PlayerHighlights theme={theme} metrics={selectedMetrics} />
                    </div>
                    <PlayerDetails theme={theme} metrics={selectedMetrics} />
                    <RecentActivity
                        theme={theme}
                        events={props.analysis.events}
                        selectedIdentityId={props.selectedIdentityId}
                    />
                </>
            ) : (
                <RecentActivity
                    theme={theme}
                    events={props.analysis.events}
                    selectedIdentityId={props.selectedIdentityId}
                />
            )}
        </div>
    );
}


function transactionCategory(event: ParsedLilyMoneyEvent): TransactionCategory | null {
    switch (event.type) {
        case "SHOP_BUY":
        case "SHOP_SELL":
            return "shop";
        case "PAY":
            return "payment";
        case "AH_BUY":
            return "auction";
        case "ADD_MONEY":
        case "REMOVE_MONEY":
        case "SET_MONEY":
            return "admin";
        case "BUY_COMMAND":
        case "SELL_COMMAND":
            return "command";
        default:
            return null;
    }
}

function transactionCategoryLabel(category: TransactionCategory): string {
    switch (category) {
        case "shop":
            return "Shop";
        case "payment":
            return "Payments";
        case "auction":
            return "Auction House";
        case "admin":
            return "Admin";
        case "command":
            return "Buy / Sell Commands";
    }
}

function amountLabelForEvent(event: ParsedLilyMoneyEvent, selectedIdentityId: string): string {
    if (selectedIdentityId !== "all") {
        const effect = eventEffectForPlayer(event, selectedIdentityId);

        if (effect) {
            if (effect.assignment && effect.balanceAfterCents !== null) {
                return `= ${formatLilyMoneyCents(effect.balanceAfterCents)}`;
            }

            if (effect.deltaCents !== null) {
                return formatSignedCents(effect.deltaCents);
            }
        }
    }

    if (event.amountCents === null) return "—";

    switch (event.type) {
        case "SHOP_SELL":
        case "ADD_MONEY":
        case "SELL_COMMAND":
            return `+${formatLilyMoneyCents(event.amountCents)}`;
        case "SHOP_BUY":
        case "REMOVE_MONEY":
        case "BUY_COMMAND":
            return formatLilyMoneyCents(-event.amountCents);
        case "SET_MONEY":
            return `= ${formatLilyMoneyCents(event.amountCents)}`;
        default:
            return formatLilyMoneyCents(event.amountCents);
    }
}

function balanceLabelForEvent(event: ParsedLilyMoneyEvent, selectedIdentityId: string): string {
    if (selectedIdentityId === "all") {
        if (event.effects.length !== 1) return "—";
        return formatLilyMoneyCents(event.effects[0]?.balanceAfterCents ?? null);
    }

    return formatLilyMoneyCents(
        eventEffectForPlayer(event, selectedIdentityId)?.balanceAfterCents ?? null
    );
}

function transactionDirection(
    event: ParsedLilyMoneyEvent,
    selectedIdentityId: string
): MoneyDirection {
    if (selectedIdentityId !== "all") {
        const effect = eventEffectForPlayer(event, selectedIdentityId);

        if (effect?.deltaCents !== null && effect?.deltaCents !== undefined) {
            if (effect.deltaCents > 0) return "gain";
            if (effect.deltaCents < 0) return "loss";
        }

        return "neutral";
    }

    switch (event.type) {
        case "SHOP_SELL":
        case "ADD_MONEY":
        case "SELL_COMMAND":
            return "gain";
        case "SHOP_BUY":
        case "REMOVE_MONEY":
        case "BUY_COMMAND":
            return "loss";
        default:
            // PAY and AH_BUY transfer money between players, so the
            // all-player view stays neutral. SET_MONEY is an assignment.
            return "neutral";
    }
}

function directionColor(theme: WorkspaceTheme, direction: MoneyDirection): string {
    if (direction === "gain") return theme.positive;
    if (direction === "loss") return theme.negative;
    return theme.text;
}

function transactionBackground(theme: WorkspaceTheme, direction: MoneyDirection): string {
    if (direction === "gain") return `${theme.positive}18`;
    if (direction === "loss") return `${theme.negative}18`;
    return "transparent";
}

function eventSearchText(event: ParsedLilyMoneyEvent): string {
    return [
        event.type,
        describeEvent(event),
        event.itemId ?? "",
        event.itemName ?? "",
        event.jobId ?? "",
        event.action ?? "",
        event.sourceId ?? "",
        event.people.map((person) => `${person.identityId} ${person.displayName}`).join(" "),
        stringifyForDisplay(event.record.payload),
        String(event.record.id),
    ]
        .join(" ")
        .toLocaleLowerCase();
}

function TransactionsPage(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const [search, setSearch] = useState<string>("");
    const [category, setCategory] = useState<string>("all");
    const [pageIndex, setPageIndex] = useState<number>(0);

    useEffect((): void => {
        setPageIndex(0);
    }, [props.selectedIdentityId, search, category]);

    const filtered: ParsedLilyMoneyEvent[] = useMemo((): ParsedLilyMoneyEvent[] => {
        const query = search.trim().toLocaleLowerCase();

        return props.analysis.events
            .filter((event: ParsedLilyMoneyEvent): boolean => {
                const eventCategory = transactionCategory(event);
                if (eventCategory === null) return false;
                if (!eventMatchesPlayer(event, props.selectedIdentityId)) return false;
                if (category !== "all" && eventCategory !== category) return false;
                if (query && !eventSearchText(event).includes(query)) return false;
                return true;
            })
            .reverse();
    }, [props.analysis.events, props.selectedIdentityId, search, category]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(pageIndex, pageCount - 1);
    const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Transactions</h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    Shop, payments, Auction House, admin, and buy / sell transactions • newest first
                </div>
            </div>

            <div
                style={{
                    ...panelStyle(theme),
                    padding: "12px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <input
                    class="search-text-input lilymoney-input"
                    type="search"
                    value={search}
                    placeholder="Search player, item, event, record ID…"
                    onInput={(event: Event): void =>
                        setSearch((event.currentTarget as HTMLInputElement).value)
                    }
                    style={{ ...controlStyle(theme), flex: "1 1 300px", minWidth: "220px" }}
                />
                <select
                    class="search-mode-dropdown lilymoney-select"
                    value={category}
                    onChange={(event: Event): void =>
                        setCategory((event.currentTarget as HTMLSelectElement).value)
                    }
                    style={{ ...controlStyle(theme), minWidth: "180px" }}
                >
                    <option value="all">All transactions</option>
                    <option value="shop">Shop</option>
                    <option value="payment">Payments</option>
                    <option value="auction">Auction House</option>
                    <option value="admin">Admin</option>
                    <option value="command">Buy / Sell Commands</option>
                </select>
                {(search || category !== "all") ? (
                    <button
                        type="button"
                        class="lilymoney-mc-button"
                        onClick={(): void => {
                            setSearch("");
                            setCategory("all");
                        }}
                        style={buttonStyle(theme)}
                    >
                        Reset filters
                    </button>
                ) : null}
                <div style={{ ...smallMutedStyle(theme), marginLeft: "auto" }}>
                    {filtered.length.toLocaleString()} result{filtered.length === 1 ? "" : "s"}
                </div>
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    theme={theme}
                    title="No matching transactions"
                    detail="Try clearing the search or changing the activity filter."
                />
            ) : (
                <div style={{ ...panelStyle(theme), overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                        <thead>
                            <tr style={{ background: theme.panelAlt }}>
                                {[
                                    "Record",
                                    "Date",
                                    "Type",
                                    "Details",
                                    "Amount",
                                    "Balance",
                                ].map((heading: string): JSX.Element => (
                                    <th
                                        key={heading}
                                        style={{
                                            textAlign: heading === "Amount" || heading === "Balance" ? "right" : "left",
                                            padding: "10px 12px",
                                            borderBottom: `1px solid ${theme.borderStrong}`,
                                            color: theme.muted,
                                            fontSize: "12px",
                                            position: "sticky",
                                            top: 0,
                                            background: theme.panelAlt,
                                            zIndex: 1,
                                        }}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((event: ParsedLilyMoneyEvent): JSX.Element => {
                                const categoryValue = transactionCategory(event);
                                const direction = transactionDirection(
                                    event,
                                    props.selectedIdentityId
                                );
                                const moneyColor = directionColor(theme, direction);
                                const auditReason = auditReasonForEvent(event);

                                return (
                                    <tr
                                        key={event.record.id}
                                        title={auditReason ?? undefined}
                                        style={{
                                            background: transactionBackground(theme, direction),
                                            boxShadow: auditReason ? `inset 4px 0 0 ${theme.warning}` : "none",
                                        }}
                                    >
                                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                            <code>#{event.record.id}</code>
                                        </td>
                                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${theme.border}`, whiteSpace: "nowrap" }}>
                                            {formatShortWhen(event.record.timestamp)}
                                        </td>
                                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${theme.border}`, whiteSpace: "nowrap" }}>
                                            <Badge
                                                theme={theme}
                                                tone={
                                                    direction === "gain"
                                                        ? "positive"
                                                        : direction === "loss"
                                                          ? "negative"
                                                          : "muted"
                                                }
                                                label={categoryValue ? transactionCategoryLabel(categoryValue) : event.type}
                                            />
                                            <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>{event.type}</div>
                                            {auditReason ? (
                                                <div style={{ marginTop: "5px" }}>
                                                    <Badge theme={theme} tone="warning" label="⚑ Audit" />
                                                </div>
                                            ) : null}
                                        </td>
                                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                            {describeEvent(event)}
                                        </td>
                                        <td
                                            style={{
                                                padding: "11px 12px",
                                                borderBottom: `1px solid ${theme.border}`,
                                                textAlign: "right",
                                                fontWeight: 700,
                                                whiteSpace: "nowrap",
                                                color: moneyColor,
                                            }}
                                        >
                                            {amountLabelForEvent(event, props.selectedIdentityId)}
                                        </td>
                                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${theme.border}`, textAlign: "right", whiteSpace: "nowrap" }}>
                                            {balanceLabelForEvent(event, props.selectedIdentityId)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {filtered.length > PAGE_SIZE ? (
                <Pagination
                    theme={theme}
                    page={safePage}
                    pageCount={pageCount}
                    onPage={setPageIndex}
                />
            ) : null}
        </div>
    );
}

function buildJobData(
    analysis: LilyMoneyAnalysis,
    selectedIdentityId: string
): {
    jobs: JobAggregate[];
    sources: JobSourceAggregate[];
    activity: JobActivityRow[];
} {
    const jobs = new Map<string, JobAggregate>();
    const sources = new Map<string, JobSourceAggregate>();
    const activity: JobActivityRow[] = [];

    const add = (
        identityId: string,
        playerName: string,
        jobId: string,
        action: string,
        sourceId: string,
        quantity: number,
        amountCents: number,
        timestamp: number,
        current: boolean,
        recordId: number | null,
        key: string
    ): void => {
        if (selectedIdentityId !== "all" && identityId !== selectedIdentityId) return;

        const normalizedJob = jobId || "UNKNOWN";
        const normalizedAction = action || "UNKNOWN";
        const normalizedSource = sourceId || "unknown";

        const job = jobs.get(normalizedJob) ?? {
            jobId: normalizedJob,
            amountCents: 0,
            canonicalAmountCents: 0,
            currentAmountCents: 0,
            quantity: 0,
            rewardGroups: 0,
            lastTimestamp: 0,
        };

        job.amountCents += amountCents;
        job.quantity += quantity;
        job.rewardGroups += 1;
        job.lastTimestamp = Math.max(job.lastTimestamp, timestamp);
        if (current) job.currentAmountCents += amountCents;
        else job.canonicalAmountCents += amountCents;
        jobs.set(normalizedJob, job);

        const sourceKey = `${normalizedJob}|${normalizedAction}|${normalizedSource}`;
        const source = sources.get(sourceKey) ?? {
            key: sourceKey,
            jobId: normalizedJob,
            action: normalizedAction,
            sourceId: normalizedSource,
            amountCents: 0,
            quantity: 0,
            rewardGroups: 0,
            lastTimestamp: 0,
        };
        source.amountCents += amountCents;
        source.quantity += quantity;
        source.rewardGroups += 1;
        source.lastTimestamp = Math.max(source.lastTimestamp, timestamp);
        sources.set(sourceKey, source);

        activity.push({
            key,
            recordId,
            timestamp,
            identityId,
            playerName,
            jobId: normalizedJob,
            action: normalizedAction,
            sourceId: normalizedSource,
            quantity,
            amountCents,
            current,
        });
    };

    for (const event of analysis.events) {
        if (event.type !== "JOB_REWARD") continue;
        const effect = event.effects[0];
        if (!effect || event.amountCents === null || event.quantity === null) continue;

        add(
            effect.identityId,
            effect.displayName,
            event.jobId ?? "UNKNOWN",
            event.action ?? "UNKNOWN",
            event.sourceId ?? "unknown",
            event.quantity,
            event.amountCents,
            event.record.timestamp,
            false,
            event.record.id,
            `record-${event.record.id}`
        );
    }

    for (const player of analysis.pendingJobs.players) {
        for (const reward of player.rewards) {
            if (reward.alreadyCanonical) continue;

            add(
                player.identityId,
                player.displayName,
                reward.jobId,
                reward.action,
                reward.sourceId,
                reward.quantity,
                reward.amountCents,
                reward.updatedAt,
                true,
                null,
                `current-${reward.batchId}`
            );
        }
    }

    return {
        jobs: [...jobs.values()].sort((a, b): number => b.amountCents - a.amountCents),
        sources: [...sources.values()].sort((a, b): number => b.amountCents - a.amountCents),
        activity: activity.sort((a, b): number => b.timestamp - a.timestamp),
    };
}

function JobsPage(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const data = useMemo(
        () => buildJobData(props.analysis, props.selectedIdentityId),
        [props.analysis, props.selectedIdentityId]
    );
    const [jobFilter, setJobFilter] = useState<string>("all");
    const [search, setSearch] = useState<string>("");
    const [pageIndex, setPageIndex] = useState<number>(0);

    useEffect((): void => {
        setJobFilter("all");
        setSearch("");
        setPageIndex(0);
    }, [props.selectedIdentityId]);

    useEffect((): void => setPageIndex(0), [jobFilter, search]);

    const totalRewards = data.jobs.reduce((sum, job): number => sum + job.amountCents, 0);
    const totalQuantity = data.jobs.reduce((sum, job): number => sum + job.quantity, 0);
    const totalGroups = data.jobs.reduce((sum, job): number => sum + job.rewardGroups, 0);
    const topJob = data.jobs[0] ?? null;
    const selectedSourceRows = data.sources.filter(
        (source: JobSourceAggregate): boolean =>
            jobFilter === "all" || source.jobId === jobFilter
    );

    const query = search.trim().toLocaleLowerCase();
    const filteredActivity = data.activity.filter((row: JobActivityRow): boolean => {
        if (jobFilter !== "all" && row.jobId !== jobFilter) return false;
        if (!query) return true;
        return `${row.playerName} ${row.jobId} ${row.action} ${row.sourceId}`
            .toLocaleLowerCase()
            .includes(query);
    });

    const pageCount = Math.max(1, Math.ceil(filteredActivity.length / PAGE_SIZE));
    const safePage = Math.min(pageIndex, pageCount - 1);
    const visible = filteredActivity.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Jobs</h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    Job rewards, actions, sources, and recent activity
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(170px, 1fr))",
                    gap: "12px",
                }}
            >
                <MetricCard
                    theme={theme}
                    title="Job Rewards"
                    value={formatLilyMoneyCents(totalRewards)}
                    accent={theme.positive}
                />
                <MetricCard
                    theme={theme}
                    title="Actions"
                    value={totalQuantity.toLocaleString()}
                    detail="Blocks / kills / job actions"
                    accent={theme.blue}
                />
                <MetricCard
                    theme={theme}
                    title="Reward Groups"
                    value={totalGroups.toLocaleString()}
                    detail="Saved and current reward groups"
                    accent={theme.teal}
                />
                <MetricCard
                    theme={theme}
                    title="Top Job"
                    value={topJob ? prettifyIdentifier(topJob.jobId) : "—"}
                    detail={topJob ? formatLilyMoneyCents(topJob.amountCents) : "No job rewards"}
                    accent={theme.accent}
                />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(350px, 1fr) minmax(350px, 1fr)",
                    gap: "16px",
                }}
            >
                <HorizontalBarChart
                    theme={theme}
                    title="Rewards by Job"
                    subtitle={`${data.jobs.length.toLocaleString()} job${data.jobs.length === 1 ? "" : "s"}`}
                    rows={data.jobs.map((job: JobAggregate): BarRow => ({
                        label: prettifyIdentifier(job.jobId),
                        valueCents: job.amountCents,
                        detail: `${job.quantity.toLocaleString()} actions • ${job.rewardGroups.toLocaleString()} reward groups`,
                    }))}
                    emptyText="No job rewards are available."
                    maximumRows={12}
                    tone="positive"
                />

                <HorizontalBarChart
                    theme={theme}
                    title="Top Job Sources"
                    subtitle={
                        jobFilter === "all"
                            ? "Highest earning blocks / sources across all jobs"
                            : `Highest earning sources for ${prettifyIdentifier(jobFilter)}`
                    }
                    rows={selectedSourceRows.slice(0, 12).map((source: JobSourceAggregate): BarRow => ({
                        label: prettifyIdentifier(source.sourceId),
                        valueCents: source.amountCents,
                        detail: `${prettifyIdentifier(source.jobId)} • ${source.quantity.toLocaleString()} actions`,
                    }))}
                    emptyText="No job source data is available for this job."
                    maximumRows={12}
                    tone="positive"
                    headerRight={
                        <select
                            class="search-mode-dropdown lilymoney-select"
                            value={jobFilter}
                            onChange={(event: Event): void =>
                                setJobFilter((event.currentTarget as HTMLSelectElement).value)
                            }
                            style={{ ...controlStyle(theme), minWidth: "170px" }}
                            aria-label="Select job for source details"
                        >
                            <option value="all">All jobs</option>
                            {data.jobs.map((job: JobAggregate): JSX.Element => (
                                <option key={job.jobId} value={job.jobId}>
                                    {prettifyIdentifier(job.jobId)}
                                </option>
                            ))}
                        </select>
                    }
                />
            </div>

            <div
                style={{
                    ...panelStyle(theme),
                    padding: "12px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <input
                    class="search-text-input lilymoney-input"
                    type="search"
                    value={search}
                    placeholder="Search block, source, player…"
                    onInput={(event: Event): void =>
                        setSearch((event.currentTarget as HTMLInputElement).value)
                    }
                    style={{ ...controlStyle(theme), flex: "1 1 280px", minWidth: "220px" }}
                />
                {(search || jobFilter !== "all") ? (
                    <button
                        type="button"
                        class="lilymoney-mc-button"
                        onClick={(): void => {
                            setSearch("");
                            setJobFilter("all");
                        }}
                        style={buttonStyle(theme)}
                    >
                        Reset filters
                    </button>
                ) : null}
                <div style={{ ...smallMutedStyle(theme), marginLeft: "auto" }}>
                    {filteredActivity.length.toLocaleString()} activit{filteredActivity.length === 1 ? "y" : "ies"}
                </div>
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    theme={theme}
                    title="No matching job activity"
                    detail="Try clearing the search or selecting another job."
                />
            ) : (
                <div style={{ ...panelStyle(theme), overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                        <thead>
                            <tr style={{ background: theme.panelAlt }}>
                                {[
                                    "Date",
                                    "Player",
                                    "Job",
                                    "Action",
                                    "Source",
                                    "Quantity",
                                    "Reward",
                                    "State",
                                ].map((heading: string): JSX.Element => (
                                    <th
                                        key={heading}
                                        style={{
                                            textAlign: heading === "Quantity" || heading === "Reward" ? "right" : "left",
                                            padding: "10px 12px",
                                            borderBottom: `1px solid ${theme.borderStrong}`,
                                            color: theme.muted,
                                            fontSize: "12px",
                                            position: "sticky",
                                            top: 0,
                                            background: theme.panelAlt,
                                            zIndex: 1,
                                        }}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((row: JobActivityRow): JSX.Element => (
                                <tr key={row.key}>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, whiteSpace: "nowrap" }}>
                                        {formatShortWhen(row.timestamp)}
                                        {row.recordId !== null ? (
                                            <div style={smallMutedStyle(theme)}>record #{row.recordId}</div>
                                        ) : null}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                        {row.playerName}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                        {prettifyIdentifier(row.jobId)}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                        {prettifyIdentifier(row.action)}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                        <code>{row.sourceId}</code>
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, textAlign: "right" }}>
                                        {row.quantity.toLocaleString()}
                                    </td>
                                    <td
                                        style={{
                                            padding: "10px 12px",
                                            borderBottom: `1px solid ${theme.border}`,
                                            textAlign: "right",
                                            fontWeight: 700,
                                            color: theme.positive,
                                        }}
                                    >
                                        {formatLilyMoneyCents(row.amountCents)}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}` }}>
                                        <Badge
                                            theme={theme}
                                            tone={row.current ? "positive" : "muted"}
                                            label={row.current ? "Current" : "History"}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredActivity.length > PAGE_SIZE ? (
                <Pagination
                    theme={theme}
                    page={safePage}
                    pageCount={pageCount}
                    onPage={setPageIndex}
                />
            ) : null}
        </div>
    );
}

function incomeSourceLabel(event: ParsedLilyMoneyEvent, effect: LilyMoneyEventEffect): string | null {
    if (effect.deltaCents === null || effect.deltaCents <= 0) return null;

    switch (event.type) {
        case "JOB_REWARD":
            return "Job Rewards";
        case "SHOP_SELL":
            return "Shop Sales";
        case "PAY":
            return "Payments Received";
        case "AH_BUY":
            return effect.role === "seller" ? "Auction Sales" : null;
        case "ADD_MONEY":
            return "Money Added";
        case "SELL_COMMAND":
            return "Sell Commands";
        default:
            return event.type;
    }
}

function spendingSourceLabel(event: ParsedLilyMoneyEvent, effect: LilyMoneyEventEffect): string | null {
    if (effect.deltaCents === null || effect.deltaCents >= 0) return null;

    switch (event.type) {
        case "SHOP_BUY":
            return "Shop Purchases";
        case "PAY":
            return "Payments Sent";
        case "AH_BUY":
            return effect.role === "buyer" ? "Auction Purchases" : null;
        case "REMOVE_MONEY":
            return "Money Removed";
        case "BUY_COMMAND":
            return "Buy Commands";
        default:
            return event.type;
    }
}

function moneySourceRows(
    analysis: LilyMoneyAnalysis,
    selectedIdentityId: string,
    direction: "income" | "spending"
): MoneySourceRow[] {
    const values = new Map<string, number>();

    for (const event of analysis.events) {
        for (const effect of event.effects) {
            if (selectedIdentityId !== "all" && effect.identityId !== selectedIdentityId) continue;
            const label = direction === "income"
                ? incomeSourceLabel(event, effect)
                : spendingSourceLabel(event, effect);
            if (!label || effect.deltaCents === null) continue;
            values.set(label, (values.get(label) ?? 0) + Math.abs(effect.deltaCents));
        }
    }

    if (direction === "income") {
        for (const player of analysis.pendingJobs.players) {
            if (selectedIdentityId !== "all" && player.identityId !== selectedIdentityId) continue;
            if (player.provisionalAmountCents <= 0) continue;
            values.set(
                "Job Rewards",
                (values.get("Job Rewards") ?? 0) + player.provisionalAmountCents
            );
        }
    }

    return [...values.entries()]
        .map(([label, amountCents]): MoneySourceRow => ({ label, amountCents }))
        .sort((a, b): number => b.amountCents - a.amountCents);
}

function GraphsPage(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const balanceTimeline = useMemo(
        () => playerBalanceTimeline(props.analysis, props.selectedIdentityId),
        [props.analysis, props.selectedIdentityId]
    );
    const balanceMarkers = useMemo(
        () => balanceChartMarkers(props.analysis, props.selectedIdentityId),
        [props.analysis, props.selectedIdentityId]
    );
    const netPoints = useMemo(
        () => netLoggedFlowPoints(props.analysis, props.selectedIdentityId),
        [props.analysis, props.selectedIdentityId]
    );
    const income = useMemo(
        () => moneySourceRows(props.analysis, props.selectedIdentityId, "income"),
        [props.analysis, props.selectedIdentityId]
    );
    const spending = useMemo(
        () => moneySourceRows(props.analysis, props.selectedIdentityId, "spending"),
        [props.analysis, props.selectedIdentityId]
    );
    const jobData = useMemo(
        () => buildJobData(props.analysis, props.selectedIdentityId),
        [props.analysis, props.selectedIdentityId]
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Graphs</h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    Balance, money flow, spending, income, and job earnings
                </div>
            </div>

            <TimeSeriesChart
                theme={theme}
                title="Balance History"
                subtitle={
                    props.selectedIdentityId === "all"
                        ? "Exact server totals from full balance checkpoints"
                        : `${balanceTimeline.cleanOfflineSpans.toLocaleString()} clean offline span${balanceTimeline.cleanOfflineSpans === 1 ? "" : "s"} shown flat; interrupted sessions break the line`
                }
                segments={balanceTimeline.segments}
                markers={balanceMarkers}
                xMode="time"
                emptyText="No exact balance history is available for this selection."
            />

            <TimeSeriesChart
                theme={theme}
                title="Net Logged Flow"
                subtitle={
                    props.selectedIdentityId === "all"
                        ? "Cumulative money created or removed by logged activity; transfers cancel out"
                        : "Cumulative logged gains and spending by money event; offline time is not stretched into flat segments"
                }
                segments={netPoints.length > 0 ? [netPoints] : []}
                xMode="events"
                emptyText="No money-flow records are available for this selection."
            />

            <MoneyBarGraph
                theme={theme}
                title="Income Sources"
                subtitle="Where earned or received money came from"
                rows={income.map((row: MoneySourceRow): BarRow => ({
                    label: row.label,
                    valueCents: row.amountCents,
                }))}
                emptyText="No income sources are available."
                tone="positive"
            />

            <MoneyBarGraph
                theme={theme}
                title="Spending Sources"
                subtitle="Where money was spent or removed"
                rows={spending.map((row: MoneySourceRow): BarRow => ({
                    label: row.label,
                    valueCents: row.amountCents,
                }))}
                emptyText="No spending sources are available."
                tone="negative"
            />

            <MoneyBarGraph
                theme={theme}
                title="Job Earnings"
                subtitle="Current and saved job rewards by job"
                rows={jobData.jobs.map((job: JobAggregate): BarRow => ({
                    label: prettifyIdentifier(job.jobId),
                    valueCents: job.amountCents,
                    detail: `${job.quantity.toLocaleString()} actions`,
                }))}
                emptyText="No job earnings are available."
                tone="positive"
                maximumRows={16}
            />
        </div>
    );
}

function stringifyForDisplay(value: unknown): string {
    try {
        return JSONB.stringify(value);
    } catch {
        return String(value);
    }
}

function csvEscape(value: string | number | null): string {
    const text = value === null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename: string, text: string, mimeType: string): void {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function exportRawRecords(records: LilyMoneyRecord[]): void {
    const header = [
        "record_id",
        "timestamp_ms",
        "timestamp_iso",
        "event_type",
        "shard_index",
        "source",
        "source_key",
        "payload_json",
    ];

    const rows = records.map((record: LilyMoneyRecord): string =>
        [
            record.id,
            record.timestamp,
            new Date(record.timestamp).toISOString(),
            record.type,
            record.shardIndex,
            record.source,
            record.sourceKey,
            stringifyForDisplay(record.payload),
        ]
            .map((value) => csvEscape(value))
            .join(",")
    );

    const csv = [header.map((value: string) => csvEscape(value)).join(","), ...rows].join("\r\n");
    const stamp = new Date().toISOString().replaceAll(":", "-");
    downloadTextFile(`LilyMoney_raw_records_${stamp}.csv`, csv, "text/csv;charset=utf-8");
}

function RawRecordsPage(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
    database: LilyMoneyDatabase;
    selectedIdentityId: string;
}): JSX.Element {
    const theme = props.theme;
    const [search, setSearch] = useState<string>("");
    const [eventType, setEventType] = useState<string>("all");
    const [shard, setShard] = useState<string>("all");
    const [pageIndex, setPageIndex] = useState<number>(0);

    useEffect((): void => setPageIndex(0), [props.selectedIdentityId, search, eventType, shard]);

    const eventById = useMemo(() => {
        const map = new Map<number, ParsedLilyMoneyEvent>();
        for (const event of props.analysis.events) map.set(event.record.id, event);
        return map;
    }, [props.analysis.events]);

    const eventTypes = useMemo(
        () => [...new Set(props.database.records.map((record: LilyMoneyRecord): string => record.type))].sort(),
        [props.database.records]
    );

    const shards = useMemo(
        () => [...new Set(props.database.records.map((record: LilyMoneyRecord): number | null => record.shardIndex))]
            .filter((value): value is number => value !== null)
            .sort((a: number, b: number): number => a - b),
        [props.database.records]
    );

    const filtered = useMemo((): LilyMoneyRecord[] => {
        const query = search.trim().toLocaleLowerCase();

        return props.database.records.filter((record: LilyMoneyRecord): boolean => {
            if (eventType !== "all" && record.type !== eventType) return false;
            if (shard !== "all" && record.shardIndex !== Number(shard)) return false;

            if (props.selectedIdentityId !== "all") {
                const parsed = eventById.get(record.id);
                if (!parsed || !eventMatchesPlayer(parsed, props.selectedIdentityId)) return false;
            }

            if (query) {
                const haystack = `${record.id} ${record.timestamp} ${record.type} ${record.shardIndex ?? ""} ${record.source} ${record.sourceKey} ${stringifyForDisplay(record.payload)}`.toLocaleLowerCase();
                if (!haystack.includes(query)) return false;
            }

            return true;
        });
    }, [props.database.records, props.selectedIdentityId, eventType, shard, search, eventById]);

    const newestFirst = [...filtered].reverse();
    const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
    const safePage = Math.min(pageIndex, pageCount - 1);
    const visible = newestFirst.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Raw Records</h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    Literal canonical DB-v1 records in global record-ID order
                </div>
            </div>

            <div
                style={{
                    ...panelStyle(theme),
                    padding: "12px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <input
                    class="search-text-input lilymoney-input"
                    type="search"
                    value={search}
                    placeholder="Search payload, ID, type, source…"
                    onInput={(event: Event): void =>
                        setSearch((event.currentTarget as HTMLInputElement).value)
                    }
                    style={{ ...controlStyle(theme), flex: "1 1 300px", minWidth: "220px" }}
                />
                <select
                    class="search-mode-dropdown lilymoney-select"
                    value={eventType}
                    onChange={(event: Event): void =>
                        setEventType((event.currentTarget as HTMLSelectElement).value)
                    }
                    style={{ ...controlStyle(theme), minWidth: "180px" }}
                >
                    <option value="all">All event types</option>
                    {eventTypes.map((type: string): JSX.Element => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
                <select
                    class="search-mode-dropdown lilymoney-select"
                    value={shard}
                    onChange={(event: Event): void =>
                        setShard((event.currentTarget as HTMLSelectElement).value)
                    }
                    style={{ ...controlStyle(theme), minWidth: "130px" }}
                >
                    <option value="all">All shards</option>
                    {shards.map((value: number): JSX.Element => (
                        <option key={value} value={String(value)}>Shard {value}</option>
                    ))}
                </select>
                <button
                    type="button"
                    class="lilymoney-mc-button"
                    onClick={(): void => exportRawRecords(filtered)}
                    style={buttonStyle(theme)}
                    disabled={filtered.length === 0}
                >
                    Export filtered CSV
                </button>
                {(search || eventType !== "all" || shard !== "all") ? (
                    <button
                        type="button"
                        class="lilymoney-mc-button"
                        onClick={(): void => {
                            setSearch("");
                            setEventType("all");
                            setShard("all");
                        }}
                        style={buttonStyle(theme)}
                    >
                        Reset filters
                    </button>
                ) : null}
            </div>

            <div style={{ ...smallMutedStyle(theme) }}>
                {filtered.length.toLocaleString()} matching record{filtered.length === 1 ? "" : "s"}
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    theme={theme}
                    title="No matching raw records"
                    detail="Try clearing one of the filters."
                />
            ) : (
                <div style={{ ...panelStyle(theme), overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1120px" }}>
                        <thead>
                            <tr style={{ background: theme.panelAlt }}>
                                {[
                                    "ID",
                                    "Timestamp",
                                    "Event",
                                    "Shard",
                                    "Source",
                                    "Payload",
                                ].map((heading: string): JSX.Element => (
                                    <th
                                        key={heading}
                                        style={{
                                            textAlign: "left",
                                            padding: "10px 12px",
                                            borderBottom: `1px solid ${theme.borderStrong}`,
                                            color: theme.muted,
                                            fontSize: "12px",
                                            position: "sticky",
                                            top: 0,
                                            background: theme.panelAlt,
                                            zIndex: 1,
                                        }}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((record: LilyMoneyRecord): JSX.Element => (
                                <tr key={`${record.source}-${record.shardIndex}-${record.id}`}>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top" }}>
                                        <code>#{record.id}</code>
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top", whiteSpace: "nowrap" }}>
                                        {formatShortWhen(record.timestamp)}
                                        <div style={smallMutedStyle(theme)}><code>{record.timestamp}</code></div>
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top" }}>
                                        <code>{record.type}</code>
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top" }}>
                                        {record.shardIndex ?? "?"}
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top" }}>
                                        <div>{record.source}</div>
                                        <div style={{ ...smallMutedStyle(theme), maxWidth: "240px", overflowWrap: "anywhere" }}>
                                            <code>{record.sourceKey}</code>
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, verticalAlign: "top" }}>
                                        <code style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                                            {stringifyForDisplay(record.payload)}
                                        </code>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filtered.length > PAGE_SIZE ? (
                <Pagination
                    theme={theme}
                    page={safePage}
                    pageCount={pageCount}
                    onPage={setPageIndex}
                />
            ) : null}
        </div>
    );
}

function PropertyTable(props: {
    theme: WorkspaceTheme;
    properties: LilyMoneyPropertySummary[];
}): JSX.Element {
    if (props.properties.length === 0) {
        return <div style={{ color: props.theme.muted }}>No properties found.</div>;
    }

    return (
        <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "780px" }}>
                <thead>
                    <tr style={{ background: props.theme.panelAlt }}>
                        {[
                            "Category",
                            "Key",
                            "Type",
                            "Value / Preview",
                        ].map((heading: string): JSX.Element => (
                            <th
                                key={heading}
                                style={{
                                    textAlign: "left",
                                    padding: "9px 10px",
                                    borderBottom: `1px solid ${props.theme.borderStrong}`,
                                    color: props.theme.muted,
                                    fontSize: "12px",
                                }}
                            >
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {props.properties.map((property: LilyMoneyPropertySummary): JSX.Element => (
                        <tr key={property.key}>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid ${props.theme.border}`, verticalAlign: "top" }}>
                                {property.category}
                            </td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid ${props.theme.border}`, verticalAlign: "top" }}>
                                <code>{property.key}</code>
                            </td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid ${props.theme.border}`, verticalAlign: "top" }}>
                                {property.type}
                            </td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid ${props.theme.border}`, verticalAlign: "top", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                                <code>{property.preview}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function buildBalanceAuditRows(
    analysis: LilyMoneyAnalysis,
    identityId: string
): BalanceAuditRow[] {
    const rows: BalanceAuditRow[] = [];
    let previousBalance: number | null = null;
    let trusted = true;

    for (const event of analysis.events) {
        if (event.type === "LOGGING_DISABLED") {
            trusted = false;
            previousBalance = null;
            continue;
        }
        if (event.type === "LOGGING_ENABLED") {
            trusted = true;
            previousBalance = null;
            continue;
        }

        const effects = event.effects.filter(
            (effect: LilyMoneyEventEffect): boolean =>
                effect.identityId === identityId && effect.balanceAfterCents !== null
        );

        for (const effect of effects) {
            if (effect.balanceAfterCents === null) continue;
            const actual = effect.balanceAfterCents;

            if (effect.assignment) {
                rows.push({
                    recordId: event.record.id,
                    timestamp: event.record.timestamp,
                    eventType: event.type,
                    previousBalanceCents: previousBalance,
                    loggedDeltaCents: null,
                    setBalanceCents: actual,
                    expectedBalanceCents: actual,
                    actualBalanceCents: actual,
                    differenceCents: 0,
                    baseline: previousBalance === null,
                });
                previousBalance = actual;
                continue;
            }

            if (previousBalance === null || !trusted) {
                rows.push({
                    recordId: event.record.id,
                    timestamp: event.record.timestamp,
                    eventType: event.type,
                    previousBalanceCents: null,
                    loggedDeltaCents: effect.deltaCents,
                    setBalanceCents: null,
                    expectedBalanceCents: actual,
                    actualBalanceCents: actual,
                    differenceCents: null,
                    baseline: true,
                });
                previousBalance = actual;
                continue;
            }

            const expected = effect.deltaCents === null
                ? previousBalance
                : previousBalance + effect.deltaCents;
            const difference = actual - expected;

            rows.push({
                recordId: event.record.id,
                timestamp: event.record.timestamp,
                eventType: event.type,
                previousBalanceCents: previousBalance,
                loggedDeltaCents: effect.deltaCents,
                setBalanceCents: null,
                expectedBalanceCents: expected,
                actualBalanceCents: actual,
                differenceCents: difference,
                baseline: false,
            });
            previousBalance = actual;
        }
    }

    return rows;
}

function BalanceAuditPanel(props: {
    theme: WorkspaceTheme;
    analysis: LilyMoneyAnalysis;
}): JSX.Element {
    const firstIdentity = props.analysis.players[0]?.identityId ?? "";
    const [identityId, setIdentityId] = useState<string>(firstIdentity);
    const [differencesOnly, setDifferencesOnly] = useState<boolean>(false);

    useEffect((): void => {
        if (!identityId || !getPlayer(props.analysis, identityId)) {
            setIdentityId(props.analysis.players[0]?.identityId ?? "");
        }
    }, [props.analysis, identityId]);

    const rows = useMemo(
        () => identityId ? buildBalanceAuditRows(props.analysis, identityId) : [],
        [props.analysis, identityId]
    );
    const filtered = differencesOnly
        ? rows.filter((row: BalanceAuditRow): boolean => (row.differenceCents ?? 0) !== 0)
        : rows;
    const visible = filtered.slice(-100).reverse();
    const unexplainedEarned = rows.reduce(
        (sum: number, row: BalanceAuditRow): number =>
            sum + (row.differenceCents !== null && row.differenceCents > 0 ? row.differenceCents : 0),
        0
    );
    const unexplainedLost = rows.reduce(
        (sum: number, row: BalanceAuditRow): number =>
            sum + (row.differenceCents !== null && row.differenceCents < 0 ? -row.differenceCents : 0),
        0
    );

    return (
        <details style={{ ...panelStyle(props.theme), padding: "12px 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 680 }}>Balance Audit</summary>
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ ...smallMutedStyle(props.theme), lineHeight: 1.5 }}>
                    Replays exact balance observations in canonical record-ID order. Each row starts from the previous known balance, applies the logged movement (or SET MONEY assignment), then compares the expected balance with the stored exact balance.
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                        class="search-mode-dropdown lilymoney-select"
                        value={identityId}
                        onChange={(event: Event): void => setIdentityId((event.currentTarget as HTMLSelectElement).value)}
                        style={{ ...controlStyle(props.theme), minWidth: "220px" }}
                        aria-label="Player for balance audit"
                    >
                        {props.analysis.players.map((player: LilyMoneyPlayerAnalysis): JSX.Element => (
                            <option key={player.identityId || player.displayName} value={player.identityId}>
                                {player.displayName} • {player.identityId}
                            </option>
                        ))}
                    </select>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: props.theme.muted }}>
                        <input
                            type="checkbox"
                            checked={differencesOnly}
                            onChange={(event: Event): void => setDifferencesOnly((event.currentTarget as HTMLInputElement).checked)}
                        />
                        Differences only
                    </label>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                        <span style={{ color: props.theme.warning }}><strong>Unexplained +:</strong> {formatLilyMoneyCents(unexplainedEarned)}</span>
                        <span style={{ color: props.theme.negative }}><strong>Unexplained -:</strong> {formatLilyMoneyCents(unexplainedLost)}</span>
                    </div>
                </div>

                {visible.length === 0 ? (
                    <div style={{ padding: "20px", color: props.theme.muted }}>
                        {differencesOnly ? "No unexplained balance differences for this player." : "No exact balance observations are available for this player."}
                    </div>
                ) : (
                    <div style={{ overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1080px" }}>
                            <thead>
                                <tr style={{ background: props.theme.panelAlt }}>
                                    {["Record", "Date", "Event", "Start", "Logged Change", "Set Money", "Expected", "Actual", "Difference"].map((heading: string): JSX.Element => (
                                        <th
                                            key={heading}
                                            style={{
                                                textAlign: ["Start", "Logged Change", "Set Money", "Expected", "Actual", "Difference"].includes(heading) ? "right" : "left",
                                                padding: "9px 10px",
                                                color: props.theme.muted,
                                                fontSize: "12px",
                                            }}
                                        >
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((row: BalanceAuditRow): JSX.Element => {
                                    const differenceColor = row.differenceCents === null || row.differenceCents === 0
                                        ? props.theme.muted
                                        : row.differenceCents > 0
                                          ? props.theme.warning
                                          : props.theme.negative;
                                    return (
                                        <tr key={`${identityId}-${row.recordId}`} style={{ background: row.differenceCents ? `${differenceColor}12` : "transparent" }}>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}` }}><code>#{row.recordId}</code></td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, whiteSpace: "nowrap" }}>{formatShortWhen(row.timestamp)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}` }}>{friendlyEventType(row.eventType)}{row.baseline ? <div style={smallMutedStyle(props.theme)}>baseline</div> : null}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right" }}>{formatLilyMoneyCents(row.previousBalanceCents)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right", color: row.loggedDeltaCents === null ? props.theme.muted : row.loggedDeltaCents > 0 ? props.theme.positive : row.loggedDeltaCents < 0 ? props.theme.negative : props.theme.muted }}>{row.loggedDeltaCents === null ? "—" : formatSignedCents(row.loggedDeltaCents)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right" }}>{formatLilyMoneyCents(row.setBalanceCents)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right" }}>{formatLilyMoneyCents(row.expectedBalanceCents)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right" }}>{formatLilyMoneyCents(row.actualBalanceCents)}</td>
                                            <td style={{ padding: "9px 10px", borderTop: `1px solid ${props.theme.border}`, textAlign: "right", color: differenceColor, fontWeight: 700 }}>{row.differenceCents === null ? "—" : formatSignedCents(row.differenceCents)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {filtered.length > 100 ? (
                    <div style={smallMutedStyle(props.theme)}>Showing the newest 100 of {filtered.length.toLocaleString()} audit rows.</div>
                ) : null}
            </div>
        </details>
    );
}

function DatabasePage(props: {
    theme: WorkspaceTheme;
    result: LilyMoneyDiscoveryResult;
    database: LilyMoneyDatabase;
    analysis: LilyMoneyAnalysis;
    health: DatabaseHealth;
}): JSX.Element {
    const theme = props.theme;
    const messages: string[] = [
        ...props.result.errors.map((message: string): string => `Scan: ${message}`),
        ...props.database.errors.map((message: string): string => `Database: ${message}`),
        ...props.analysis.errors.map((message: string): string => `Analysis: ${message}`),
    ];

    const warnings: string[] = [
        ...props.database.warnings,
        ...props.analysis.warnings,
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h2 style={{ margin: 0 }}>Database</h2>
                <div style={{ ...smallMutedStyle(theme), marginTop: "4px" }}>
                    Storage, integrity, versions, continuity, and advanced LilyMoney state
                </div>
            </div>

            <div
                style={{
                    ...panelStyle(theme),
                    padding: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                }}
            >
                <div
                    style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "0",
                        background: healthColor(theme, props.health.level),
                        boxShadow: `0 0 0 4px ${healthColor(theme, props.health.level)}22`,
                        flex: "0 0 auto",
                    }}
                />
                <div>
                    <div style={{ fontWeight: 700, fontSize: "18px" }}>{props.health.label}</div>
                    <div style={{ color: theme.muted }}>{props.health.detail}</div>
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
                    gap: "12px",
                }}
            >
                <MetricCard
                    theme={theme}
                    title="Canonical Records"
                    value={props.database.records.length.toLocaleString()}
                    detail={
                        props.database.firstRecordId === null
                            ? "No record range"
                            : `#${props.database.firstRecordId} → #${props.database.lastRecordId}`
                    }
                    accent={theme.blue}
                />
                <MetricCard
                    theme={theme}
                    title="Selected Shards"
                    value={props.database.selectedShards.length.toLocaleString()}
                    detail={`${props.database.sealedShardCount} sealed • ${props.database.activeShardFound ? "active found" : "no active shard"}`}
                    accent={theme.accent}
                />
                <MetricCard
                    theme={theme}
                    title="Global ID Continuity"
                    value={props.database.idsContinuous === false ? "BROKEN" : "VALID"}
                    detail={`${props.database.duplicateRecordIds.length} duplicate IDs • ${props.database.missingRecordRanges.length} missing ranges`}
                    accent={props.database.idsContinuous === false ? theme.danger : theme.positive}
                />
                <MetricCard
                    theme={theme}
                    title="Shard Continuity"
                    value={props.database.shardIndexesContinuous === false ? "BROKEN" : "VALID"}
                    detail={`Expected active shard ${props.result.activeShardIndex ?? "unknown"}`}
                    accent={props.database.shardIndexesContinuous === false ? theme.danger : theme.positive}
                />
            </div>

            <div style={{ ...panelStyle(theme), padding: "16px" }}>
                <h3 style={{ marginTop: 0 }}>World Metadata</h3>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
                        gap: "8px 22px",
                    }}
                >
                    <div><strong>World ID:</strong> <code>{props.result.worldId ?? "unknown"}</code></div>
                    <div><strong>Logging:</strong> {props.result.loggingEnabled === null ? "unknown" : props.result.loggingEnabled ? "enabled" : "disabled"}</div>
                    <div><strong>Active open:</strong> {props.result.activeOpen === null ? "unknown" : String(props.result.activeOpen)}</div>
                    <div><strong>Expected active shard:</strong> {props.result.activeShardIndex ?? "unknown"}</div>
                    <div><strong>Last sealed record:</strong> {props.result.lastSealedRecordId ?? "none"}</div>
                    <div><strong>Sealed structure keys:</strong> {props.result.structureKeys.length.toLocaleString()}</div>
                    <div><strong>ActorPrefix entries scanned:</strong> {props.result.actorKeysScanned.toLocaleString()}</div>
                    <div><strong>Storage ActorPrefix candidates:</strong> {props.result.activeStorages.length.toLocaleString()}</div>
                    <div><strong>Name DB players:</strong> {props.result.nameDatabase.entries.length.toLocaleString()}</div>
                    <div><strong>Name DB chunks:</strong> {props.result.nameDatabase.chunkCountRead.toLocaleString()}</div>
                    <div><strong>Persistent JOB state:</strong> {props.analysis.pendingJobs.present ? props.analysis.pendingJobs.valid ? "VALID" : "INVALID" : "not present"}</div>
                    <div><strong>Recovery properties:</strong> {props.result.recoveryPropertyCount.toLocaleString()}</div>
                    <div><strong>Parsed events:</strong> {props.analysis.events.length.toLocaleString()}</div>
                    <div><strong>Sessions reconstructed:</strong> {props.analysis.sessions.length.toLocaleString()}</div>
                    <div><strong>Balance anomalies:</strong> {props.analysis.anomalies.length.toLocaleString()}</div>
                    <div><strong>Invalid events:</strong> {props.analysis.invalidEventCount.toLocaleString()}</div>
                </div>
            </div>

            <BalanceAuditPanel theme={theme} analysis={props.analysis} />

            <details style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 680 }}>
                    Audit Flags ({props.analysis.events.filter((event: ParsedLilyMoneyEvent): boolean => transactionCategory(event) !== null && auditReasonForEvent(event) !== null).length.toLocaleString()})
                </summary>
                <div style={{ marginTop: "12px" }}>
                    <div style={{ ...smallMutedStyle(theme), marginBottom: "10px", lineHeight: 1.5 }}>
                        Audit flags are review hints, not proof of wrongdoing. Administrative balance changes are always flagged; PAY ≥ $50,000, Auction House purchases ≥ $100,000, and any single movement ≥ $250,000 are also flagged.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                        {props.analysis.events
                            .filter((event: ParsedLilyMoneyEvent): boolean => transactionCategory(event) !== null && auditReasonForEvent(event) !== null)
                            .slice(-100)
                            .reverse()
                            .map((event: ParsedLilyMoneyEvent): JSX.Element => (
                                <div
                                    key={event.record.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "86px 160px minmax(0, 1fr)",
                                        gap: "10px",
                                        padding: "9px 10px",
                                        border: `1px solid ${theme.warning}44`,
                                        borderRadius: "0",
                                        background: `${theme.warning}0d`,
                                    }}
                                >
                                    <code>#{event.record.id}</code>
                                    <span style={{ whiteSpace: "nowrap" }}>{formatShortWhen(event.record.timestamp)}</span>
                                    <span><strong style={{ color: theme.warning }}>⚑ {friendlyEventType(event.type)}</strong> — {auditReasonForEvent(event)}</span>
                                </div>
                            ))}
                        {props.analysis.events.every((event: ParsedLilyMoneyEvent): boolean => transactionCategory(event) === null || auditReasonForEvent(event) === null) ? (
                            <div style={{ color: theme.muted }}>No audit-sensitive transactions were found.</div>
                        ) : null}
                    </div>
                </div>
            </details>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={{ margin: 0 }}>Shards</h3>
                {props.database.selectedShards.map(
                    (storage: LilyMoneyStorageSummary): JSX.Element => (
                        <details key={storage.sourceKey} style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                            <summary style={{ cursor: "pointer", fontWeight: 650 }}>
                                Shard {storage.shardIndex ?? "?"} • {storage.source === "sealed" ? "sealed structure" : "active ActorPrefix"} • {storage.records.length.toLocaleString()} records
                            </summary>
                            <div style={{ marginTop: "12px", lineHeight: 1.65 }}>
                                <div><strong>Source:</strong> <code>{storage.sourceKey}</code></div>
                                <div><strong>Identifier:</strong> <code>{storage.identifier ?? "unknown"}</code></div>
                                <div><strong>World ID:</strong> <code>{storage.worldId ?? "unknown"}</code></div>
                                <div><strong>DB kind:</strong> <code>{storage.dbKind ?? "unknown"}</code></div>
                                <div><strong>DB / record format:</strong> {storage.dbFormat ?? "?"} / {storage.recordFormat ?? "?"}</div>
                                <div><strong>Record range:</strong> #{storage.firstRecordId ?? "?"} → #{storage.lastRecordId ?? "?"}</div>
                                <div><strong>Metadata record count:</strong> {storage.recordCount ?? "unknown"}</div>
                                <div><strong>Decoded records:</strong> {storage.records.length.toLocaleString()}</div>
                                <div><strong>Pages:</strong> {storage.pageKeys.length.toLocaleString()} ({storage.pageCharacters.toLocaleString()} characters)</div>
                                <div><strong>ID continuity:</strong> {storage.idsContinuous === false ? "BROKEN" : "VALID"}</div>
                                <div><strong>Sealed flag:</strong> {storage.sealed === null ? "unknown" : String(storage.sealed)}</div>
                                <div><strong>Stored checksum:</strong> <code>{storage.checksum ?? "none"}</code></div>
                                <div><strong>Calculated checksum:</strong> <code>{storage.checksumActual ?? "not calculated"}</code></div>
                                <div><strong>Checksum:</strong> {storage.checksumValid === null ? storage.sealed ? "not available" : "active shard — not sealed" : storage.checksumValid ? "VALID" : "INVALID"}</div>
                                <div><strong>Pending JOB state property:</strong> {storage.pendingJobBatchStateRaw === null ? "not present" : `${storage.pendingJobBatchStateRaw.length.toLocaleString()} characters`}</div>

                                {storage.recordDecodeErrors.length > 0 ? (
                                    <div style={{ marginTop: "8px" }}>
                                        <strong>Decoder errors:</strong>
                                        <ul>{storage.recordDecodeErrors.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                                    </div>
                                ) : null}
                                {storage.recordDecodeWarnings.length > 0 ? (
                                    <div style={{ marginTop: "8px" }}>
                                        <strong>Decoder warnings:</strong>
                                        <ul>{storage.recordDecodeWarnings.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                                    </div>
                                ) : null}

                                <details style={{ marginTop: "12px" }}>
                                    <summary style={{ cursor: "pointer" }}>Page keys ({storage.pageKeys.length})</summary>
                                    <ul>
                                        {storage.pageKeys.map((key: string): JSX.Element => <li key={key}><code>{key}</code></li>)}
                                    </ul>
                                </details>

                                <details style={{ marginTop: "12px" }}>
                                    <summary style={{ cursor: "pointer" }}>All storage dynamic properties</summary>
                                    <div style={{ marginTop: "10px" }}>
                                        <PropertyTable theme={theme} properties={storage.properties} />
                                    </div>
                                </details>
                            </div>
                        </details>
                    )
                )}
            </div>

            <details style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 650 }}>
                    Shared Name Database ({props.result.nameDatabase.entries.length.toLocaleString()} players)
                </summary>
                <div style={{ marginTop: "12px" }}>
                    <div style={{ ...smallMutedStyle(theme), marginBottom: "10px" }}>
                        Existing <code>lilynames:nameDataBase</code> format; identity ID remains the primary key.
                    </div>
                    <div style={{ overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "420px" }}>
                            <thead>
                                <tr style={{ background: theme.panelAlt }}>
                                    <th style={{ textAlign: "left", padding: "9px 10px", color: theme.muted }}>Identity ID</th>
                                    <th style={{ textAlign: "left", padding: "9px 10px", color: theme.muted }}>Current Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.result.nameDatabase.entries.map((entry): JSX.Element => (
                                    <tr key={entry.identityId}>
                                        <td style={{ padding: "9px 10px", borderTop: `1px solid ${theme.border}` }}><code>{entry.identityId}</code></td>
                                        <td style={{ padding: "9px 10px", borderTop: `1px solid ${theme.border}` }}>{entry.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {props.result.nameDatabase.errors.length > 0 ? (
                        <ul>{props.result.nameDatabase.errors.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                    ) : null}
                    {props.result.nameDatabase.warnings.length > 0 ? (
                        <ul>{props.result.nameDatabase.warnings.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                    ) : null}
                </div>
            </details>

            <details style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 650 }}>
                    Persistent JOB Batch State
                </summary>
                <div style={{ marginTop: "12px" }}>
                    <div><strong>Present:</strong> {String(props.analysis.pendingJobs.present)}</div>
                    <div><strong>Valid:</strong> {String(props.analysis.pendingJobs.valid)}</div>
                    <div><strong>Version:</strong> {props.analysis.pendingJobs.version ?? "none"}</div>
                    <div><strong>Players:</strong> {props.analysis.pendingJobs.players.length.toLocaleString()}</div>

                    {props.analysis.pendingJobs.players.map((player): JSX.Element => (
                        <details key={player.identityId} style={{ marginTop: "10px", borderTop: `1px solid ${theme.border}`, paddingTop: "10px" }}>
                            <summary style={{ cursor: "pointer" }}>
                                {player.displayName} • {player.rewards.length.toLocaleString()} reward groups
                            </summary>
                            <div style={{ marginTop: "8px" }}>
                                <div><strong>Identity:</strong> <code>{player.identityId}</code></div>
                                <div><strong>Window started:</strong> {formatWhen(player.windowStartedAt)}</div>
                                <div><strong>Last updated:</strong> {formatWhen(player.lastUpdatedAt)}</div>
                                <div><strong>Base balance:</strong> {formatLilyMoneyCents(player.baseBalanceCents)}</div>
                                <div><strong>Stored final:</strong> {formatLilyMoneyCents(player.finalBalanceCents)}</div>
                                <div><strong>State rewards:</strong> {formatLilyMoneyCents(player.totalStateAmountCents)}</div>
                                <div><strong>Uncommitted rewards:</strong> {formatLilyMoneyCents(player.provisionalAmountCents)}</div>
                                <ul>
                                    {player.rewards.map((reward): JSX.Element => (
                                        <li key={reward.batchId}>
                                            <code>{reward.batchId}</code> • {reward.jobId} / {reward.action} / {reward.sourceId} • x{reward.quantity.toLocaleString()} • {formatLilyMoneyCents(reward.amountCents)} {reward.alreadyCanonical ? "• already canonical" : ""}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </details>
                    ))}
                </div>
            </details>

            <details style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 650 }}>
                    World Dynamic Properties ({props.result.worldProperties.length.toLocaleString()})
                </summary>
                <div style={{ marginTop: "10px" }}>
                    <PropertyTable theme={theme} properties={props.result.worldProperties} />
                </div>
            </details>

            {props.analysis.anomalies.length > 0 ? (
                <details style={{ ...panelStyle(theme), padding: "12px 16px" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 650 }}>
                        Balance Reconciliation Anomalies ({props.analysis.anomalies.length.toLocaleString()})
                    </summary>
                    <ul>
                        {props.analysis.anomalies.map((anomaly): JSX.Element => (
                            <li key={`${anomaly.recordId}-${anomaly.identityId}`}>
                                Record #{anomaly.recordId} • {anomaly.playerName} • {anomaly.eventType} • expected {formatLilyMoneyCents(anomaly.expectedBalanceCents)}, got {formatLilyMoneyCents(anomaly.actualBalanceCents)} • difference {formatSignedCents(anomaly.differenceCents)}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}

            {messages.length > 0 || warnings.length > 0 ? (
                <div style={{ ...panelStyle(theme), padding: "16px" }}>
                    <h3 style={{ marginTop: 0 }}>Diagnostics</h3>
                    {messages.length > 0 ? (
                        <>
                            <strong style={{ color: theme.danger }}>Errors</strong>
                            <ul>{messages.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                        </>
                    ) : null}
                    {warnings.length > 0 ? (
                        <>
                            <strong style={{ color: theme.warning }}>Warnings</strong>
                            <ul>{warnings.map((message: string): JSX.Element => <li key={message}><code>{message}</code></li>)}</ul>
                        </>
                    ) : null}
                </div>
            ) : (
                <div style={{ ...panelStyle(theme), padding: "16px", color: theme.positive }}>
                    No database, decoder, or analysis diagnostics were reported.
                </div>
            )}
        </div>
    );
}

function Pagination(props: {
    theme: WorkspaceTheme;
    page: number;
    pageCount: number;
    onPage(page: number): void;
}): JSX.Element {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
            }}
        >
            <button
                type="button"
                class="lilymoney-mc-button"
                style={buttonStyle(props.theme)}
                disabled={props.page <= 0}
                onClick={(): void => props.onPage(Math.max(0, props.page - 1))}
            >
                Previous
            </button>
            <div style={smallMutedStyle(props.theme)}>
                Page {(props.page + 1).toLocaleString()} of {props.pageCount.toLocaleString()}
            </div>
            <button
                type="button"
                class="lilymoney-mc-button"
                style={buttonStyle(props.theme)}
                disabled={props.page >= props.pageCount - 1}
                onClick={(): void => props.onPage(Math.min(props.pageCount - 1, props.page + 1))}
            >
                Next
            </button>
        </div>
    );
}

export default function LilyMoneyWorkspace(props: LilyMoneyWorkspaceProps): JSX.Element {
    const theme = BWE_THEME;
    const database: LilyMoneyDatabase = useMemo(
        () => assembleLilyMoneyDatabase(props.result),
        [props.result]
    );
    const analysis: LilyMoneyAnalysis = useMemo(
        () => analyzeLilyMoneyDatabase(database, props.result, props.result.nameDatabase),
        [database, props.result]
    );

    const [page, setPage] = useState<LilyMoneyWorkspacePage>("overview");
    const [selectedIdentityId, setSelectedIdentityId] = useState<string>("all");
    const [playerSearch, setPlayerSearch] = useState<string>("");
    const [playerSort, setPlayerSort] = useState<PlayerSortMode>("name");

    const playerMetricsById = useMemo((): Map<string, PlayerProfileMetrics> => {
        const result = new Map<string, PlayerProfileMetrics>();
        for (const player of analysis.players) {
            const metrics = buildPlayerProfileMetrics(analysis, player.identityId);
            if (metrics) result.set(player.identityId, metrics);
        }
        return result;
    }, [analysis]);

    const sortedPlayerOptions = useMemo(
        (): LilyMoneyPlayerAnalysis[] => sortPlayersForSelector(analysis, playerMetricsById, playerSort),
        [analysis, playerMetricsById, playerSort]
    );
    const filteredPlayerOptions = useMemo((): LilyMoneyPlayerAnalysis[] => {
        const query = playerSearch.trim().toLocaleLowerCase();
        if (!query) return sortedPlayerOptions;
        return sortedPlayerOptions.filter((player: LilyMoneyPlayerAnalysis): boolean => {
            const metrics = playerMetricsById.get(player.identityId);
            const haystack = `${player.displayName} ${player.identityId} ${(metrics?.aliases ?? []).join(" ")}`.toLocaleLowerCase();
            return haystack.includes(query);
        });
    }, [sortedPlayerOptions, playerSearch, playerMetricsById]);

    const selectedPlayerExists: boolean =
        selectedIdentityId === "all" || getPlayer(analysis, selectedIdentityId) !== null;
    const effectiveIdentityId: string = selectedPlayerExists ? selectedIdentityId : "all";
    const health: DatabaseHealth = useMemo(
        () => databaseHealth(props.result, database, analysis),
        [props.result, database, analysis]
    );

    const navItems: Array<{
        id: LilyMoneyWorkspacePage;
        label: string;
    }> = [
        { id: "overview", label: "Overview" },
        { id: "transactions", label: "Transactions" },
        { id: "jobs", label: "Jobs" },
        { id: "graphs", label: "Graphs" },
        { id: "raw", label: "Raw Records" },
        { id: "database", label: "Database" },
        { id: "addonInfo", label: "Addon Information" },
    ];

    let content: JSX.Element;

    switch (page) {
        case "overview":
            content = (
                <OverviewPage
                    theme={theme}
                    analysis={analysis}
                    database={database}
                    selectedIdentityId={effectiveIdentityId}
                />
            );
            break;
        case "transactions":
            content = (
                <TransactionsPage
                    theme={theme}
                    analysis={analysis}
                    selectedIdentityId={effectiveIdentityId}
                />
            );
            break;
        case "jobs":
            content = (
                <JobsPage
                    theme={theme}
                    analysis={analysis}
                    selectedIdentityId={effectiveIdentityId}
                />
            );
            break;
        case "graphs":
            content = (
                <GraphsPage
                    theme={theme}
                    analysis={analysis}
                    selectedIdentityId={effectiveIdentityId}
                />
            );
            break;
        case "raw":
            content = (
                <RawRecordsPage
                    theme={theme}
                    analysis={analysis}
                    database={database}
                    selectedIdentityId={effectiveIdentityId}
                />
            );
            break;
        case "database":
            content = (
                <DatabasePage
                    theme={theme}
                    result={props.result}
                    database={database}
                    analysis={analysis}
                    health={health}
                />
            );
            break;
        case "addonInfo":
            content = <LilyMoneyAddonInfo />;
            break;
    }

    return (
        <div
            class="lilymoney-workspace"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxSizing: "border-box",
                background: theme.bg,
                color: theme.text,
                forcedColorAdjust: "none",
            }}
        >
            <header
                class="lilymoney-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "12px 16px",
                    borderBottom: `1px solid ${theme.border}`,
                    background: theme.panel,
                    flex: "0 0 auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <button
                        type="button"
                        class="lilymoney-mc-button"
                        onClick={props.onBack}
                        style={buttonStyle(theme)}
                    >
                        Back
                    </button>

                    <div style={{ minWidth: 0 }}>
                        <div class="lilymoney-title" style={{ fontSize: "20px", fontWeight: 760, lineHeight: 1.1 }}>
                            LilyMoney
                        </div>
                        <div style={smallMutedStyle(theme)}>Economy & Transaction History</div>
                    </div>
                </div>

                <button
                    type="button"
                    class="lilymoney-mc-button"
                    onClick={props.onRescan}
                    style={buttonStyle(theme)}
                >
                    Rescan
                </button>
            </header>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${theme.border}`,
                    background: theme.panelAlt,
                    flex: "0 0 auto",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        minWidth: 0,
                        flex: "1 1 auto",
                        flexWrap: "wrap",
                    }}
                >
                    <span style={{ fontWeight: 650 }}>Player</span>
                    <input
                        class="search-text-input lilymoney-input"
                        type="search"
                        value={playerSearch}
                        placeholder="Search players…"
                        onInput={(event: Event): void =>
                            setPlayerSearch((event.currentTarget as HTMLInputElement).value)
                        }
                        style={{ ...controlStyle(theme), width: "190px" }}
                    />
                    <select
                        class="search-mode-dropdown lilymoney-select"
                        value={playerSort}
                        onChange={(event: Event): void =>
                            setPlayerSort((event.currentTarget as HTMLSelectElement).value as PlayerSortMode)
                        }
                        style={{ ...controlStyle(theme), minWidth: "150px" }}
                        aria-label="Sort players"
                    >
                        <option value="name">Name</option>
                        <option value="richest">Richest</option>
                        <option value="poorest">Poorest</option>
                        <option value="latest">Latest activity</option>
                        <option value="moneyMoved">Money moved</option>
                        <option value="spending">Spending</option>
                        <option value="jobs">Job rewards</option>
                        <option value="audit">Audit flags</option>
                    </select>
                    <select
                        class="search-mode-dropdown lilymoney-select"
                        value={effectiveIdentityId}
                        onChange={(event: Event): void => {
                            setSelectedIdentityId((event.currentTarget as HTMLSelectElement).value);
                            setPlayerSearch("");
                        }}
                        style={{
                            ...controlStyle(theme),
                            minWidth: "240px",
                            maxWidth: "420px",
                        }}
                    >
                        <option value="all">All Players ({analysis.players.length.toLocaleString()})</option>
                        {effectiveIdentityId !== "all" && !filteredPlayerOptions.some((player: LilyMoneyPlayerAnalysis): boolean => player.identityId === effectiveIdentityId) ? (() => {
                            const current = getPlayer(analysis, effectiveIdentityId);
                            return current ? (
                                <option key={`selected-${current.identityId}`} value={current.identityId}>
                                    {current.displayName}{current.identityId ? ` • ${current.identityId}` : ""}
                                </option>
                            ) : null;
                        })() : null}
                        {filteredPlayerOptions.map(
                            (player: LilyMoneyPlayerAnalysis): JSX.Element => (
                                <option key={player.identityId || player.displayName} value={player.identityId}>
                                    {player.displayName}{player.identityId ? ` • ${player.identityId}` : ""}
                                </option>
                            )
                        )}
                    </select>
                    {playerSearch ? (
                        <span style={smallMutedStyle(theme)}>
                            {filteredPlayerOptions.length.toLocaleString()} match{filteredPlayerOptions.length === 1 ? "" : "es"}
                        </span>
                    ) : null}
                </div>

                <div style={{ ...smallMutedStyle(theme), textAlign: "right" }}>
                    {props.progress} • World <code>{props.result.worldId ?? "unknown"}</code>
                </div>
            </div>

            <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
                <nav
                    class="lilymoney-nav"
                    style={{
                        width: "190px",
                        flex: "0 0 190px",
                        padding: "14px 10px",
                        borderRight: `1px solid ${theme.border}`,
                        overflowY: "auto",
                        boxSizing: "border-box",
                        background: theme.panel,
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {navItems.map((item): JSX.Element => {
                            const selected: boolean = page === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    class={`sidebar_button lilymoney-nav-button${selected ? " active" : ""}`}
                                    onClick={(): void => setPage(item.id)}
                                    style={{
                                        width: "100%",
                                        border: "none",
                                        padding: "10px 11px",
                                        textAlign: "left",
                                        color: theme.text,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        fontWeight: selected ? 680 : 500,
                                    }}
                                >
                                    <span style={{ flex: "1 1 auto" }}>{item.label}</span>
                                    {item.id === "database" && health.level !== "healthy" ? (
                                        <span
                                            title={health.label}
                                            style={{
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "0",
                                                background: healthColor(theme, health.level),
                                                flex: "0 0 auto",
                                            }}
                                        />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ margin: "18px 8px 0", paddingTop: "14px", borderTop: `1px solid ${theme.border}` }}>
                        <div style={smallMutedStyle(theme)}>Database</div>
                        <div style={{ fontWeight: 650, marginTop: "3px" }}>
                            {database.records.length.toLocaleString()} records
                        </div>
                        <div style={{ ...smallMutedStyle(theme), marginTop: "3px" }}>
                            {database.selectedShards.length} shard{database.selectedShards.length === 1 ? "" : "s"}
                        </div>
                    </div>
                </nav>

                <main
                    class="lilymoney-main"
                    style={{
                        flex: "1 1 auto",
                        minWidth: 0,
                        overflow: "auto",
                        padding: "18px",
                        boxSizing: "border-box",
                        background: theme.bg,
                    }}
                >
                    <div style={{ width: "100%", maxWidth: "1500px", margin: "0 auto" }}>
                        {content}
                    </div>
                </main>
            </div>
        </div>
    );
}
