import type { LilyMoneyDatabase } from "./LilyMoneyDatabase";

import type { LilyMoneyDiscoveryResult } from "./LilyMoneyData";

import { parseLilyMoneyEvent, type LilyMoneyEventEffect, type ParsedLilyMoneyEvent } from "./LilyMoneyEvents";

import type { LilyMoneyNameDatabase } from "./LilyMoneyNames";

import { parseLilyMoneyPendingJobState, type LilyMoneyPendingState } from "./LilyMoneyPending";

export interface LilyMoneyBalanceAnomaly {
    recordId: number;
    timestamp: number;

    identityId: string;
    playerName: string;

    eventType: string;

    differenceCents: number;

    previousBalanceCents: number;

    expectedBalanceCents: number;

    actualBalanceCents: number;
}

export interface LilyMoneyPlayerAnalysis {
    identityId: string;
    displayName: string;

    aliases: string[];

    latestCommittedBalanceCents: number | null;

    latestRecordId: number | null;

    totalIncomeCents: number;
    totalSpendingCents: number;

    jobIncomeCents: number;

    moneyMovedCents: number;

    effectCount: number;

    participatingRecordCount: number;

    unexplainedEarnedCents: number;

    unexplainedLostCents: number;

    anomalyCount: number;

    pendingJobRewardCents: number;

    provisionalBalanceCents: number | null;

    pendingRewardGroups: number;
}

export interface LilyMoneySession {
    identityId: string;
    playerName: string;

    joinRecordId: number;
    joinTimestamp: number;

    joinBalanceCents: number | null;

    leaveRecordId: number | null;

    leaveTimestamp: number | null;

    leaveBalanceCents: number | null;

    status: "clean" | "open" | "interrupted";
}

export interface LilyMoneyAnalysis {
    events: ParsedLilyMoneyEvent[];

    validEventCount: number;
    invalidEventCount: number;

    eventTypeCounts: Record<string, number>;

    players: LilyMoneyPlayerAnalysis[];

    anomalies: LilyMoneyBalanceAnomaly[];

    sessions: LilyMoneySession[];

    pendingJobs: LilyMoneyPendingState;

    errors: string[];
    warnings: string[];
}

interface MutablePlayer {
    identityId: string;
    displayName: string;

    aliases: Set<string>;

    latestCommittedBalanceCents: number | null;

    latestRecordId: number | null;

    totalIncomeCents: number;
    totalSpendingCents: number;

    jobIncomeCents: number;

    moneyMovedCents: number;

    effectCount: number;

    participatingRecordIds: Set<number>;

    unexplainedEarnedCents: number;

    unexplainedLostCents: number;

    anomalyCount: number;

    pendingJobRewardCents: number;

    provisionalBalanceCents: number | null;

    pendingRewardGroups: number;
}

function playerKey(identityId: string, displayName: string): string {
    if (identityId) {
        return `id:${identityId}`;
    }

    if (displayName) {
        return `name:` + displayName.toLocaleLowerCase();
    }

    return "";
}

function getExpectedActivePendingRaw(discovery: LilyMoneyDiscoveryResult): string | null {
    const candidates = discovery.activeStorages.filter((storage): boolean => storage.isExpectedActiveShard);

    if (candidates.length !== 1) {
        return null;
    }

    const candidate = candidates[0];

    if (!candidate) {
        return null;
    }

    return candidate.pendingJobBatchStateRaw;
}

export function analyzeLilyMoneyDatabase(
    database: LilyMoneyDatabase,

    discovery: LilyMoneyDiscoveryResult,

    names: LilyMoneyNameDatabase
): LilyMoneyAnalysis {
    const errors: string[] = [];

    const warnings: string[] = [];

    // IMPORTANT:
    // database.records is already
    // canonical ID order.
    //
    // DO NOT timestamp-sort this.
    const events = database.records.map((record): ParsedLilyMoneyEvent => parseLilyMoneyEvent(record, names));

    const eventTypeCounts: Record<string, number> = {};

    for (const event of events) {
        eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;

        if (!event.valid) {
            for (const error of event.errors) {
                errors.push(`Record #${event.record.id} ${event.type}: ${error}`);
            }
        }
    }

    const players = new Map<string, MutablePlayer>();

    const touchPlayer = (
        identityId: string,

        displayName: string,

        rawName: string = ""
    ): MutablePlayer | null => {
        const key: string = playerKey(identityId, displayName);

        if (!key) {
            return null;
        }

        let player = players.get(key);

        if (!player) {
            player = {
                identityId,
                displayName,

                aliases: new Set(),

                latestCommittedBalanceCents: null,

                latestRecordId: null,

                totalIncomeCents: 0,

                totalSpendingCents: 0,

                jobIncomeCents: 0,

                moneyMovedCents: 0,

                effectCount: 0,

                participatingRecordIds: new Set(),

                unexplainedEarnedCents: 0,

                unexplainedLostCents: 0,

                anomalyCount: 0,

                pendingJobRewardCents: 0,

                provisionalBalanceCents: null,

                pendingRewardGroups: 0,
            };

            players.set(key, player);
        }

        if (rawName) {
            player.aliases.add(rawName);
        }

        if (displayName) {
            player.aliases.add(displayName);

            player.displayName = displayName;
        }

        return player;
    };

    // Seed player list from the
    // shared Name Database.
    for (const entry of names.entries) {
        touchPlayer(entry.identityId, entry.name, entry.name);
    }

    // --------------------------------
    // PLAYER STATS
    // --------------------------------

    for (const event of events) {
        // All participants, including
        // command/admin actors.
        for (const person of event.people) {
            const player = touchPlayer(person.identityId, person.displayName, person.rawName);

            player?.participatingRecordIds.add(event.record.id);
        }

        // Actual balance effects.
        for (const effect of event.effects) {
            const player = touchPlayer(effect.identityId, effect.displayName, effect.rawName);

            if (!player) {
                continue;
            }

            player.effectCount++;

            player.latestRecordId = event.record.id;

            if (effect.balanceAfterCents !== null) {
                player.latestCommittedBalanceCents = effect.balanceAfterCents;
            }

            if (effect.deltaCents !== null) {
                player.moneyMovedCents += Math.abs(effect.deltaCents);

                if (effect.deltaCents > 0) {
                    player.totalIncomeCents += effect.deltaCents;
                }

                if (effect.deltaCents < 0) {
                    player.totalSpendingCents += -effect.deltaCents;
                }

                if (event.type === "JOB_REWARD" && effect.deltaCents > 0) {
                    player.jobIncomeCents += effect.deltaCents;
                }
            }
        }
    }

    // --------------------------------
    // FORENSIC RECONCILIATION
    // --------------------------------

    const anomalies: LilyMoneyBalanceAnomaly[] = [];

    const balances = new Map<string, number>();

    let trusted: boolean = true;

    let resetBaseline: boolean = false;

    const effectKey = (effect: LilyMoneyEventEffect): string => playerKey(effect.identityId, effect.displayName);

    for (const event of events) {
        if (event.type === "LOGGING_DISABLED") {
            trusted = false;
            resetBaseline = true;

            continue;
        }

        if (event.type === "LOGGING_ENABLED") {
            trusted = true;
            resetBaseline = true;

            continue;
        }

        for (const effect of event.effects) {
            const key = effectKey(effect);

            if (!key) {
                continue;
            }

            const previous = balances.get(key);

            // SET_MONEY is an exact
            // assignment, not a delta.
            if (effect.assignment) {
                if (effect.balanceAfterCents !== null) {
                    balances.set(key, effect.balanceAfterCents);
                }

                continue;
            }

            // Normal money movement.
            if (effect.deltaCents !== null) {
                const expected: number | null = previous === undefined ? null : previous + effect.deltaCents;

                if (effect.balanceAfterCents !== null) {
                    if (trusted && !resetBaseline && previous !== undefined && expected !== null && effect.balanceAfterCents !== expected) {
                        anomalies.push({
                            recordId: event.record.id,

                            timestamp: event.record.timestamp,

                            identityId: effect.identityId,

                            playerName: effect.displayName,

                            eventType: event.type,

                            differenceCents: effect.balanceAfterCents - expected,

                            previousBalanceCents: previous,

                            expectedBalanceCents: expected,

                            actualBalanceCents: effect.balanceAfterCents,
                        });
                    }

                    balances.set(
                        key,

                        effect.balanceAfterCents
                    );
                } else if (previous !== undefined) {
                    balances.set(
                        key,

                        previous + effect.deltaCents
                    );
                }

                continue;
            }

            // JOIN / LEAVE /
            // checkpoint exact
            // observations.
            if (effect.balanceAfterCents !== null) {
                if (trusted && !resetBaseline && previous !== undefined && effect.balanceAfterCents !== previous) {
                    anomalies.push({
                        recordId: event.record.id,

                        timestamp: event.record.timestamp,

                        identityId: effect.identityId,

                        playerName: effect.displayName,

                        eventType: event.type,

                        differenceCents: effect.balanceAfterCents - previous,

                        previousBalanceCents: previous,

                        expectedBalanceCents: previous,

                        actualBalanceCents: effect.balanceAfterCents,
                    });
                }

                balances.set(
                    key,

                    effect.balanceAfterCents
                );
            }
        }

        // Same logging-gap semantics
        // as the current Python
        // viewer.
        if (resetBaseline && event.effects.some((effect): boolean => effect.balanceAfterCents !== null)) {
            resetBaseline = false;
        }
    }

    for (const anomaly of anomalies) {
        const key = playerKey(anomaly.identityId, anomaly.playerName);

        const player = players.get(key);

        if (!player) {
            continue;
        }

        player.anomalyCount++;

        if (anomaly.differenceCents > 0) {
            player.unexplainedEarnedCents += anomaly.differenceCents;
        } else {
            player.unexplainedLostCents += -anomaly.differenceCents;
        }
    }

    // --------------------------------
    // PENDING JOB STATE
    // --------------------------------

    const pendingJobs: LilyMoneyPendingState = parseLilyMoneyPendingJobState(
        getExpectedActivePendingRaw(discovery),

        database.records,

        names
    );

    errors.push(...pendingJobs.errors.map((error: string): string => `Pending JOB state: ${error}`));

    warnings.push(...pendingJobs.warnings.map((warning: string): string => `Pending JOB state: ${warning}`));

    for (const pending of pendingJobs.players) {
        const player = touchPlayer(pending.identityId, pending.displayName, pending.rawName);

        if (!player) {
            continue;
        }

        player.pendingJobRewardCents = pending.provisionalAmountCents;

        player.pendingRewardGroups = pending.provisionalRewardCount;

        player.provisionalBalanceCents =
            player.latestCommittedBalanceCents !== null ? player.latestCommittedBalanceCents + pending.provisionalAmountCents : pending.finalBalanceCents;

        if (player.latestCommittedBalanceCents !== null && player.provisionalBalanceCents !== pending.finalBalanceCents) {
            warnings.push(
                `Pending JOB state for ${pending.displayName} ends at ${pending.finalBalanceCents}, but committed balance + uncommitted rewards gives ${player.provisionalBalanceCents}.`
            );
        }
    }

    // --------------------------------
    // SESSIONS
    // --------------------------------

    const sessions: LilyMoneySession[] = [];

    const openSessions = new Map<string, LilyMoneySession>();

    for (const event of events) {
        if (event.type !== "PLAYER_JOIN" && event.type !== "PLAYER_LEAVE") {
            continue;
        }

        const effect = event.effects[0];

        if (!effect) {
            continue;
        }

        const key = effectKey(effect);

        if (!key) {
            continue;
        }

        if (event.type === "PLAYER_JOIN") {
            const old = openSessions.get(key);

            if (old) {
                old.status = "interrupted";

                sessions.push(old);
            }

            openSessions.set(key, {
                identityId: effect.identityId,

                playerName: effect.displayName,

                joinRecordId: event.record.id,

                joinTimestamp: event.record.timestamp,

                joinBalanceCents: effect.balanceAfterCents,

                leaveRecordId: null,

                leaveTimestamp: null,

                leaveBalanceCents: null,

                status: "open",
            });
        } else {
            let session = openSessions.get(key);

            if (session) {
                openSessions.delete(key);
            } else {
                // Logging can begin in
                // the middle of an
                // existing session.
                session = {
                    identityId: effect.identityId,

                    playerName: effect.displayName,

                    joinRecordId: event.record.id,

                    joinTimestamp: event.record.timestamp,

                    joinBalanceCents: null,

                    leaveRecordId: null,

                    leaveTimestamp: null,

                    leaveBalanceCents: null,

                    status: "interrupted",
                };
            }

            session.leaveRecordId = event.record.id;

            session.leaveTimestamp = event.record.timestamp;

            session.leaveBalanceCents = effect.balanceAfterCents;

            if (session.status !== "interrupted") {
                session.status = "clean";
            }

            sessions.push(session);
        }
    }

    sessions.push(...openSessions.values());

    sessions.sort((a: LilyMoneySession, b: LilyMoneySession): number => a.joinTimestamp - b.joinTimestamp || a.joinRecordId - b.joinRecordId);

    const finalPlayers: LilyMoneyPlayerAnalysis[] = [...players.values()]
        .map(
            (player): LilyMoneyPlayerAnalysis => ({
                identityId: player.identityId,

                displayName: player.displayName,

                aliases: [...player.aliases].sort((a, b) => a.localeCompare(b)),

                latestCommittedBalanceCents: player.latestCommittedBalanceCents,

                latestRecordId: player.latestRecordId,

                totalIncomeCents: player.totalIncomeCents,

                totalSpendingCents: player.totalSpendingCents,

                jobIncomeCents: player.jobIncomeCents,

                moneyMovedCents: player.moneyMovedCents,

                effectCount: player.effectCount,

                participatingRecordCount: player.participatingRecordIds.size,

                unexplainedEarnedCents: player.unexplainedEarnedCents,

                unexplainedLostCents: player.unexplainedLostCents,

                anomalyCount: player.anomalyCount,

                pendingJobRewardCents: player.pendingJobRewardCents,

                provisionalBalanceCents: player.provisionalBalanceCents,

                pendingRewardGroups: player.pendingRewardGroups,
            })
        )
        .sort((a, b): number => a.displayName.localeCompare(b.displayName));

    return {
        events,

        validEventCount: events.filter((event): boolean => event.valid).length,

        invalidEventCount: events.filter((event): boolean => !event.valid).length,

        eventTypeCounts,

        players: finalPlayers,

        anomalies,

        sessions,

        pendingJobs,

        errors,
        warnings,
    };
}

export function formatLilyMoneyCents(cents: number | null): string {
    if (cents === null) {
        return "—";
    }

    const sign: string = cents < 0 ? "-" : "";

    const value: number = Math.abs(cents);

    return `${sign}$` + `${Math.floor(value / 100).toLocaleString()}.` + `${String(value % 100).padStart(2, "0")}`;
}
