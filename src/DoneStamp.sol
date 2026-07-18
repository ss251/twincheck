// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DoneStamp
/// @notice Dual-principal completion receipts for agent "done" claims.
/// @dev Worker posts gate hashes; a *different* accepter re-runs evidence and co-signs.
///      Worker cannot forge accepter; accepter cannot backdate worker commit.
///      Local databases fail this trust boundary. Monad makes per-task receipts free.
contract DoneStamp {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error TaskExists(bytes32 taskId);
    error TaskNotFound(bytes32 taskId);
    error AlreadyDecided(bytes32 taskId);
    error EvidenceMismatch(bytes32 taskId, bytes32 expected, bytes32 provided);
    error SelfAccept(bytes32 taskId);
    error GateFailed(bytes32 taskId);
    error ZeroHash();

    // ─────────────────────────────────────────────────────────────────────────
    // Events (append-only history for dashboard / indexers)
    // ─────────────────────────────────────────────────────────────────────────

    event Committed(
        bytes32 indexed taskId,
        address indexed worker,
        bytes32 specHash,
        bytes32 evidenceHash,
        bool gatePass,
        uint64 committedAt
    );

    event Accepted(
        bytes32 indexed taskId,
        address indexed accepter,
        bytes32 evidenceHash,
        uint64 decidedAt
    );

    event Rejected(
        bytes32 indexed taskId,
        address indexed accepter,
        bytes32 reason,
        uint64 decidedAt
    );

    /// @notice Loud onchain refusal: accepter presented evidence that does not match commit.
    event Denied(
        bytes32 indexed taskId,
        address indexed caller,
        bytes32 providedHash,
        bytes32 expectedHash
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Storage — live receipt only (no history arrays)
    // ─────────────────────────────────────────────────────────────────────────

    struct Receipt {
        address worker;
        address accepter;
        bytes32 specHash;
        bytes32 evidenceHash;
        bool gatePass;
        bool accepted;
        bool rejected;
        uint64 committedAt;
        uint64 decidedAt;
        bool exists;
    }

    mapping(bytes32 taskId => Receipt) public receipts;

    // ─────────────────────────────────────────────────────────────────────────
    // Worker path
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Worker commits a completion claim after running a deterministic gate.
    /// @param taskId Stable id for the task (e.g. keccak of repo+issue+run).
    /// @param specHash Hash of the acceptance spec / checklist.
    /// @param evidenceHash Hash of gate outputs (diff, test log, lint, …).
    /// @param gatePass Whether the deterministic gate passed (honest fail allowed).
    function commit(
        bytes32 taskId,
        bytes32 specHash,
        bytes32 evidenceHash,
        bool gatePass
    ) external {
        if (receipts[taskId].exists) revert TaskExists(taskId);
        if (specHash == bytes32(0) || evidenceHash == bytes32(0)) revert ZeroHash();

        uint64 ts = uint64(block.timestamp);
        receipts[taskId] = Receipt({
            worker: msg.sender,
            accepter: address(0),
            specHash: specHash,
            evidenceHash: evidenceHash,
            gatePass: gatePass,
            accepted: false,
            rejected: false,
            committedAt: ts,
            decidedAt: 0,
            exists: true
        });

        emit Committed(taskId, msg.sender, specHash, evidenceHash, gatePass, ts);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Accepter path (second principal)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Second principal re-runs evidence and co-signs if hashes match.
    /// @dev On mismatch: emits Denied and returns false (event survives — no revert).
    ///      Worker cannot accept own work. Failed gates cannot be accepted (use reject).
    function accept(bytes32 taskId, bytes32 evidenceHash) external returns (bool ok) {
        Receipt storage r = receipts[taskId];
        if (!r.exists) revert TaskNotFound(taskId);
        if (r.accepted || r.rejected) revert AlreadyDecided(taskId);
        if (msg.sender == r.worker) revert SelfAccept(taskId);
        if (!r.gatePass) revert GateFailed(taskId);

        if (evidenceHash != r.evidenceHash) {
            emit Denied(taskId, msg.sender, evidenceHash, r.evidenceHash);
            return false;
        }

        uint64 ts = uint64(block.timestamp);
        r.accepter = msg.sender;
        r.accepted = true;
        r.decidedAt = ts;
        emit Accepted(taskId, msg.sender, evidenceHash, ts);
        return true;
    }

    /// @notice Second principal rejects a claim (gate fail, bad work, etc.).
    function reject(bytes32 taskId, bytes32 reason) external {
        Receipt storage r = receipts[taskId];
        if (!r.exists) revert TaskNotFound(taskId);
        if (r.accepted || r.rejected) revert AlreadyDecided(taskId);
        if (msg.sender == r.worker) revert SelfAccept(taskId);

        uint64 ts = uint64(block.timestamp);
        r.accepter = msg.sender;
        r.rejected = true;
        r.decidedAt = ts;
        emit Rejected(taskId, msg.sender, reason, ts);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice True only when a second principal accepted a passing gate commit.
    function isDone(bytes32 taskId) public view returns (bool) {
        Receipt storage r = receipts[taskId];
        return r.exists && r.gatePass && r.accepted && !r.rejected;
    }

    /// @notice Check whether provided evidence matches the onchain commit (no state change).
    function verify(bytes32 taskId, bytes32 evidenceHash) public view returns (bool) {
        Receipt storage r = receipts[taskId];
        if (!r.exists) return false;
        return r.evidenceHash == evidenceHash;
    }

    /// @notice Pending = committed, not yet accepted or rejected.
    function isPending(bytes32 taskId) public view returns (bool) {
        Receipt storage r = receipts[taskId];
        return r.exists && !r.accepted && !r.rejected;
    }
}
