// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TwinCheck
/// @notice Dual-principal dual-explorer source-verification cards for Monad registry addresses.
/// @dev Closes the gap filed in monad-crypto/protocols#369: automatic check that contracts are
///      verified on BOTH Monadscan and MonadVision. Two independent attestors (principals A + B)
///      each report observations; when both agree, status settles. A flip vs prior settled state
///      emits DualStatusPulse — a public on-chain integrity signal a private CSV cannot provide.
contract TwinCheck {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotAttestor(address caller);
    error ZeroAddress();
    error SameAttestors();
    error NotWatched(address target);
    error AlreadyWatched(address target);
    error ZeroEvidence();

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Observation {
        bool scanOK; // Monadscan (or etherscan-family) source verified
        bool visionOK; // MonadVision / BlockVision Sourcify verified
        bytes32 evidenceHash; // hash of checker evidence blob (URL set, timestamps, raw signals)
        uint64 reportedAt;
        bool exists;
    }

    struct Card {
        bool watched;
        bool settled;
        bool scanOK;
        bool visionOK;
        uint64 checkedAt;
        bytes32 evidenceHash;
        address settlerA;
        address settlerB;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Watched(address indexed target, address indexed by, uint64 at);
    event Reported(
        address indexed target,
        address indexed attestor,
        bool scanOK,
        bool visionOK,
        bytes32 evidenceHash,
        uint64 at
    );
    event DualStatusSettled(
        address indexed target,
        bool scanOK,
        bool visionOK,
        bool dualOK,
        bytes32 evidenceHash,
        uint64 checkedAt
    );
    /// @notice Emitted when settled dual status differs from the previous settled status.
    event DualStatusPulse(
        address indexed target,
        bool prevScanOK,
        bool prevVisionOK,
        bool scanOK,
        bool visionOK,
        bool dualOK,
        uint64 checkedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    address public immutable attestorA;
    address public immutable attestorB;
    uint64 public constant MAX_REPORT_AGE = 5 minutes;

    mapping(address target => Card) public cards;
    mapping(address target => mapping(address attestor => Observation)) public reports;

    address[] private _watched;
    mapping(address target => uint256) private _watchIndex; // 1-based; 0 = not in list

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address a, address b) {
        if (a == address(0) || b == address(0)) revert ZeroAddress();
        if (a == b) revert SameAttestors();
        attestorA = a;
        attestorB = b;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyAttestor() {
        if (msg.sender != attestorA && msg.sender != attestorB) revert NotAttestor(msg.sender);
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Watchlist
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Mark a registry (or any) address as watched. Idempotent for already-watched.
    function watch(address target) external onlyAttestor {
        if (target == address(0)) revert ZeroAddress();
        if (cards[target].watched) revert AlreadyWatched(target);
        cards[target].watched = true;
        _watched.push(target);
        _watchIndex[target] = _watched.length; // 1-based
        emit Watched(target, msg.sender, uint64(block.timestamp));
    }

    function watchBatch(address[] calldata targets) external onlyAttestor {
        uint256 n = targets.length;
        for (uint256 i = 0; i < n; i++) {
            address target = targets[i];
            if (target == address(0)) revert ZeroAddress();
            if (cards[target].watched) continue;
            cards[target].watched = true;
            _watched.push(target);
            _watchIndex[target] = _watched.length;
            emit Watched(target, msg.sender, uint64(block.timestamp));
        }
    }

    function watchedCount() external view returns (uint256) {
        return _watched.length;
    }

    function watchedAt(uint256 i) external view returns (address) {
        return _watched[i];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dual-principal report + settle
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Attestor posts dual-explorer observation for a watched target.
    /// @dev When both attestors have posted matching (scanOK, visionOK), status settles.
    ///      If settled bits flip vs previous settled card, emits DualStatusPulse.
    function report(address target, bool scanOK, bool visionOK, bytes32 evidenceHash)
        external
        onlyAttestor
    {
        if (!cards[target].watched) revert NotWatched(target);
        if (evidenceHash == bytes32(0)) revert ZeroEvidence();

        reports[target][msg.sender] = Observation({
            scanOK: scanOK,
            visionOK: visionOK,
            evidenceHash: evidenceHash,
            reportedAt: uint64(block.timestamp),
            exists: true
        });

        emit Reported(target, msg.sender, scanOK, visionOK, evidenceHash, uint64(block.timestamp));

        Observation memory oa = reports[target][attestorA];
        Observation memory ob = reports[target][attestorB];
        // Wait until both attestors have posted matching bits. A solo re-report
        // after a prior settle must not revert — the other principal still has
        // the old observation until they re-check.
        if (!oa.exists || !ob.exists) return;
        uint64 oldestReport = oa.reportedAt < ob.reportedAt ? oa.reportedAt : ob.reportedAt;
        if (uint64(block.timestamp) - oldestReport > MAX_REPORT_AGE) return;
        if (oa.scanOK != ob.scanOK || oa.visionOK != ob.visionOK) return;

        // Bind BOTH principals' evidence into the settled commitment so the dual
        // card represents a genuine consensus, not just attestorA's evidence.
        bytes32 dualEvidence = keccak256(abi.encode(oa.evidenceHash, ob.evidenceHash));
        _settle(target, oa.scanOK, oa.visionOK, dualEvidence);

        // Consume both observations. Each settlement must be backed by a FRESH
        // dual report from both principals; without this a single attestor could
        // unilaterally re-settle (and re-emit DualStatusSettled/Pulse) forever by
        // replaying the counterparty's one-time stale observation.
        delete reports[target][attestorA];
        delete reports[target][attestorB];
    }

    function _settle(address target, bool scanOK, bool visionOK, bytes32 evidenceHash) internal {
        Card storage c = cards[target];
        bool hadSettled = c.settled;
        bool prevScan = c.scanOK;
        bool prevVision = c.visionOK;

        c.settled = true;
        c.scanOK = scanOK;
        c.visionOK = visionOK;
        c.checkedAt = uint64(block.timestamp);
        c.evidenceHash = evidenceHash;
        c.settlerA = attestorA;
        c.settlerB = attestorB;

        bool bothOK = scanOK && visionOK;
        emit DualStatusSettled(target, scanOK, visionOK, bothOK, evidenceHash, c.checkedAt);

        if (hadSettled && (prevScan != scanOK || prevVision != visionOK)) {
            emit DualStatusPulse(
                target, prevScan, prevVision, scanOK, visionOK, bothOK, c.checkedAt
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function dualOK(address target) external view returns (bool) {
        Card memory c = cards[target];
        return c.settled && c.scanOK && c.visionOK;
    }

    function isSettled(address target) external view returns (bool) {
        return cards[target].settled;
    }

    function getCard(address target)
        external
        view
        returns (
            bool watched,
            bool settled,
            bool scanOK,
            bool visionOK,
            bool isDualOK,
            uint64 checkedAt,
            bytes32 evidenceHash
        )
    {
        Card memory c = cards[target];
        return (
            c.watched,
            c.settled,
            c.scanOK,
            c.visionOK,
            c.settled && c.scanOK && c.visionOK,
            c.checkedAt,
            c.evidenceHash
        );
    }
}
