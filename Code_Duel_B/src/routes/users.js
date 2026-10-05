const express = require("express");
const router  = express.Router();
const { db }  = require("../config/firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { authenticateToken } = require("../middlewares/auth");

/**
 * POST /api/users/init
 *
 * Called by the frontend immediately after Firebase Auth sign-in.
 * Creates the user document only if it doesn't already exist,
 * so repeat logins never overwrite the rating or stats.
 *
 * Expects Bearer ID token in Authorization header.
 * Body: { displayName, photoURL }
 */
router.post("/init", authenticateToken, async (req, res) => {
    const { uid, email } = req.user;
    const { displayName, photoURL, username: rawUsername } = req.body;

    if (!uid || !email) {
        return res.status(400).json({ error: "uid and email are required in token" });
    }

    // Generate a username from displayName/email if not supplied
    function generateUsername(base) {
        return (base || email.split("@")[0])
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/__+/g, '_')
            .slice(0, 20);
    }

    try {
        const ref  = db.collection("users").doc(uid);
        const snap = await ref.get();

        if (snap.exists) {
            const existing = snap.data();
            // Backfill username for old accounts that don't have one
            if (!existing.username) {
                const autoUsername = generateUsername(existing.displayName || existing.email);
                // Best-effort backfill (no uniqueness check for migration)
                await ref.update({ username: autoUsername }).catch(() => {});
            }
            return res.status(200).json({ created: false, user: existing });
        }

        // Determine final username, ensure uniqueness
        let username = rawUsername
            ? rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20)
            : generateUsername(displayName || email.split("@")[0]);

        // Check uniqueness
        const usernameSnap = await db.collection("users").where("username", "==", username).limit(1).get();
        if (!usernameSnap.empty) {
            if (rawUsername) {
                // User explicitly chose this username — reject so they can pick another
                return res.status(409).json({ error: "Username already taken. Please choose a different one." });
            }
            // Auto-generated username — append a suffix to avoid blocking sign-in
            username = `${username.slice(0, 16)}_${Math.random().toString(36).slice(2, 6)}`;
        }

        const newUser = {
            uid,
            displayName: displayName || email.split("@")[0],
            username,
            email,
            photoURL:    photoURL || null,
            createdAt:   FieldValue.serverTimestamp(),
            rating:      1000,

            // ── Public match stats ──
            matchesPlayedPublic: 0,
            matchesWonPublic:    0,
            matchesLostPublic:   0,
            matchesTiedPublic:   0,

            // ── Private match stats ──
            matchesPlayedPrivate: 0,
            matchesWonPrivate:    0,
            matchesLostPrivate:   0,
            matchesTiedPrivate:   0,
        };

        await ref.set(newUser);
        console.log(`[users/init] Created user document for ${uid} (username: ${username})`);

        return res.status(201).json({ created: true, user: newUser });
    } catch (err) {
        console.error("[POST /api/users/init] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * GET /api/users/check-username/:username
 * Public endpoint — returns { available: true/false }.
 * Used by the signup form to validate before creating the Firebase account.
 */
router.get("/check-username/:username", async (req, res) => {
    const { username } = req.params;
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length < 3 || clean.length > 20) {
        return res.status(400).json({ available: false, error: "Invalid username format" });
    }
    try {
        const snap = await db.collection("users").where("username", "==", clean).limit(1).get();
        return res.status(200).json({ available: snap.empty });
    } catch (err) {
        console.error(`[GET /api/users/check-username/${username}] Error:`, err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});


/**
 * GET /api/users/by-username/:username
 * Resolves a username string to the full user profile.
 */
router.get("/by-username/:username", async (req, res) => {
    const { username } = req.params;
    try {
        const snap = await db.collection("users")
            .where("username", "==", username.toLowerCase())
            .limit(1)
            .get();
        if (snap.empty) return res.status(404).json({ error: "User not found" });
        return res.status(200).json(snap.docs[0].data());
    } catch (err) {
        console.error(`[GET /api/users/by-username/${username}] Error:`, err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * PATCH /api/users/profile
 *
 * Lets the authenticated user update their own displayName and/or username.
 * Body: { displayName?, username? }
 */
router.patch("/profile", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { displayName, username: rawUsername } = req.body;

    if (displayName === undefined && rawUsername === undefined) {
        return res.status(400).json({ error: "Provide displayName and/or username to update" });
    }

    const updates = {};

    if (displayName !== undefined) {
        const name = displayName.trim();
        if (!name || name.length > 50) {
            return res.status(400).json({ error: "Display name must be 1–50 characters" });
        }
        updates.displayName = name;
    }

    if (rawUsername !== undefined) {
        const username = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
        if (!username || username.length < 3) {
            return res.status(400).json({ error: "Username must be 3–20 chars (a-z, 0-9, _)" });
        }
        const mySnap = await db.collection("users").doc(uid).get();
        const currentUsername = mySnap.exists ? mySnap.data().username : null;

        if (username !== currentUsername) {
            const taken = await db.collection("users").where("username", "==", username).limit(1).get();
            if (!taken.empty) {
                return res.status(409).json({ error: "Username already taken. Please choose a different one." });
            }
        }
        updates.username = username;
    }

    try {
        await db.collection("users").doc(uid).update(updates);
        console.log(`[PATCH /api/users/profile] uid=${uid} updated:`, Object.keys(updates).join(', '));
        return res.status(200).json({ success: true, updated: updates });
    } catch (err) {
        console.error("[PATCH /api/users/profile] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * GET /api/users/leaderboard
 * Returns top 20 users sorted by ELO rating descending.
 */
router.get("/leaderboard", async (req, res) => {
    try {
        const snap = await db.collection("users")
            .orderBy("rating", "desc")
            .limit(20)
            .get();
        
        const leaderboard = snap.docs.map((doc, idx) => {
            const data = doc.data();
            return {
                rank: idx + 1,
                uid: doc.id,
                displayName: data.displayName || data.email?.split("@")[0] || "Anonymous",
                username: data.username || null,
                rating: data.rating ?? 1000,
                photoURL: data.photoURL || null,
                matchesWonPublic: data.matchesWonPublic ?? 0,
                matchesPlayedPublic: data.matchesPlayedPublic ?? 0,
            };
        });
        return res.status(200).json(leaderboard);
    } catch (err) {
        console.error("[GET /api/users/leaderboard] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * GET /api/users/friends
 * Returns authenticated user's mutual friends list.
 */
router.get("/friends", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: "User not found" });
        }
        const userData = userSnap.data();
        const friendUids = userData.friends || [];
        
        if (friendUids.length === 0) {
            return res.status(200).json([]);
        }

        // Fetch all friend profiles in parallel
        const docRefs = friendUids.map(fId => db.collection("users").doc(fId));
        const snaps = await db.getAll(...docRefs);
        
        const friendsList = snaps
            .filter(snap => snap.exists)
            .map(snap => {
                const data = snap.data();
                return {
                    uid: snap.id,
                    displayName: data.displayName || data.email?.split("@")[0] || "Anonymous",
                    rating: data.rating ?? 1000,
                    photoURL: data.photoURL || null,
                };
            });
        return res.status(200).json(friendsList);
    } catch (err) {
        console.error("[GET /api/users/friends] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * POST /api/users/friends/request
 * Sends a friend request (stored in the target's pendingRequests array).
 * Body: { email }
 */
router.post("/friends/request", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });
    if (email.toLowerCase() === req.user.email.toLowerCase())
        return res.status(400).json({ error: "You cannot send a request to yourself" });

    try {
        const querySnap = await db.collection("users")
            .where("email", "==", email.trim().toLowerCase())
            .limit(1).get();

        if (querySnap.empty)
            return res.status(404).json({ error: "No user found with that email" });

        const targetDoc = querySnap.docs[0];
        const targetId  = targetDoc.id;
        const targetData = targetDoc.data();

        const mySnap = await db.collection("users").doc(uid).get();
        const myData = mySnap.data();

        if ((myData.friends || []).includes(targetId))
            return res.status(400).json({ error: "Already friends" });

        if ((targetData.pendingRequests || []).some(r => r.fromUid === uid))
            return res.status(400).json({ error: "Friend request already sent" });

        await targetDoc.ref.update({
            pendingRequests: FieldValue.arrayUnion({
                fromUid:       uid,
                fromName:      myData.displayName || req.user.email.split("@")[0],
                fromEmail:     req.user.email,
                fromPhotoURL:  myData.photoURL || null,
                fromRating:    myData.rating ?? 1000,
                sentAt:        Date.now(),
            })
        });

        return res.status(200).json({ success: true, message: "Friend request sent" });
    } catch (err) {
        console.error("[POST /api/users/friends/request] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * GET /api/users/friends/pending
 * Returns the list of inbound pending friend requests for the auth'd user.
 */
router.get("/friends/pending", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    try {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) return res.status(404).json({ error: "User not found" });
        const pending = snap.data().pendingRequests || [];
        return res.status(200).json(pending);
    } catch (err) {
        console.error("[GET /api/users/friends/pending] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * POST /api/users/friends/accept
 * Accepts a pending friend request.
 * Body: { fromUid }
 */
router.post("/friends/accept", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { fromUid } = req.body;
    if (!fromUid) return res.status(400).json({ error: "fromUid is required" });

    try {
        const myRef     = db.collection("users").doc(uid);
        const fromRef   = db.collection("users").doc(fromUid);
        const mySnap    = await myRef.get();
        if (!mySnap.exists) return res.status(404).json({ error: "User not found" });

        const pending = mySnap.data().pendingRequests || [];
        const request = pending.find(r => r.fromUid === fromUid);
        if (!request) return res.status(404).json({ error: "Request not found" });

        const batch = db.batch();
        // Remove from pending, add to mutual friends
        batch.update(myRef,  {
            pendingRequests: FieldValue.arrayRemove(request),
            friends:         FieldValue.arrayUnion(fromUid),
        });
        batch.update(fromRef, {
            friends: FieldValue.arrayUnion(uid),
        });
        await batch.commit();

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[POST /api/users/friends/accept] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * POST /api/users/friends/decline
 * Declines / removes a pending friend request.
 * Body: { fromUid }
 */
router.post("/friends/decline", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { fromUid } = req.body;
    if (!fromUid) return res.status(400).json({ error: "fromUid is required" });

    try {
        const myRef  = db.collection("users").doc(uid);
        const mySnap = await myRef.get();
        if (!mySnap.exists) return res.status(404).json({ error: "User not found" });

        const pending = mySnap.data().pendingRequests || [];
        const request = pending.find(r => r.fromUid === fromUid);
        if (!request) return res.status(404).json({ error: "Request not found" });

        await myRef.update({ pendingRequests: FieldValue.arrayRemove(request) });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[POST /api/users/friends/decline] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * POST /api/users/friends/add
 * Legacy direct-add (kept for backward compat — now just calls request flow).
 * Adds a mutual friend by searching for their email.
 */
router.post("/friends/add", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });
    if (email.toLowerCase() === req.user.email.toLowerCase())
        return res.status(400).json({ error: "You cannot add yourself as a friend" });

    try {
        const querySnap = await db.collection("users")
            .where("email", "==", email.trim().toLowerCase())
            .limit(1).get();

        if (querySnap.empty)
            return res.status(404).json({ error: "User with this email not found" });

        const friendDoc = querySnap.docs[0];
        const friendId  = friendDoc.id;
        const userRef   = db.collection("users").doc(uid);
        const userSnap  = await userRef.get();
        const friends   = userSnap.data().friends || [];

        if (friends.includes(friendId))
            return res.status(400).json({ error: "User is already in your friend list" });

        const batch = db.batch();
        batch.update(userRef,        { friends: FieldValue.arrayUnion(friendId) });
        batch.update(friendDoc.ref,  { friends: FieldValue.arrayUnion(uid) });
        await batch.commit();

        return res.status(200).json({
            success: true,
            friend: {
                uid:         friendId,
                displayName: friendDoc.data().displayName || email.split("@")[0],
                rating:      friendDoc.data().rating ?? 1000,
                photoURL:    friendDoc.data().photoURL || null,
            }
        });
    } catch (err) {
        console.error("[POST /api/users/friends/add] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

/**
 * POST /api/users/friends/remove
 * Removes a mutual friend.
 */
router.post("/friends/remove", authenticateToken, async (req, res) => {
    const { uid } = req.user;
    const { friendId } = req.body;

    if (!friendId) {
        return res.status(400).json({ error: "Friend ID is required" });
    }

    try {
        const userRef = db.collection("users").doc(uid);
        const friendRef = db.collection("users").doc(friendId);

        const batch = db.batch();
        batch.update(userRef, {
            friends: FieldValue.arrayRemove(friendId)
        });
        batch.update(friendRef, {
            friends: FieldValue.arrayRemove(uid)
        });
        await batch.commit();

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[POST /api/users/friends/remove] Error:", err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});


/**
 * GET /api/users/:uid
 * Returns the user's profile document.
 * Also accepts a username string as the :uid param (fallback query).
 */
router.get("/:uid", async (req, res) => {
    const { uid } = req.params;
    try {
        // Try direct UID lookup first
        const snap = await db.collection("users").doc(uid).get();
        if (snap.exists) {
            return res.status(200).json(snap.data());
        }
        // Fallback: treat param as username
        const usnap = await db.collection("users")
            .where("username", "==", uid.toLowerCase())
            .limit(1)
            .get();
        if (!usnap.empty) {
            return res.status(200).json(usnap.docs[0].data());
        }
        return res.status(404).json({ error: "User not found" });
    } catch (err) {
        console.error(`[GET /api/users/${uid}] Error:`, err.message);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

const { internalAuth } = require("../middlewares/internalAuth");

/**
 * POST /api/users/update-ratings-internal
 *
 * Internal-only endpoint called by the ELO worker after a match completes.
 * Atomically updates both players' ratings and match stats in Firestore.
 *
 * Protected by x-internal-secret header (no Firebase Auth).
 *
 * Body: {
 *   roomId, winnerId, loserId,
 *   newWinnerRating, newLoserRating,
 *   winnerDelta, loserDelta,
 *   matchType: 'public' | 'private',
 *   isDraw: boolean,
 * }
 * Returns { success: true }
 */
router.post("/update-ratings-internal", internalAuth, async (req, res) => {
  const {
    winnerId,
    loserId,
    newWinnerRating,
    newLoserRating,
    winnerDelta,
    loserDelta,
    roomId,
    matchType = "public",
    isDraw    = false,
  } = req.body;

  // For a draw, winnerId and loserId represent both participants
  if (!winnerId || !loserId || newWinnerRating == null || newLoserRating == null) {
    return res.status(400).json({
      error: "winnerId, loserId, newWinnerRating, newLoserRating are required",
    });
  }

  const isPublic  = matchType === "public";
  const winnerRef = db.collection("users").doc(winnerId);
  const loserRef  = db.collection("users").doc(loserId);

  try {
    const batch = db.batch();

    if (isDraw) {
      // Tie: both players' ratings unchanged, increment tied counter for both
      const tiedField   = isPublic ? "matchesTiedPublic"   : "matchesTiedPrivate";
      const playedField = isPublic ? "matchesPlayedPublic"  : "matchesPlayedPrivate";

      batch.update(winnerRef, {
        [playedField]:   FieldValue.increment(1),
        [tiedField]:     FieldValue.increment(1),
        lastMatchAt:     FieldValue.serverTimestamp(),
      });
      batch.update(loserRef, {
        [playedField]:   FieldValue.increment(1),
        [tiedField]:     FieldValue.increment(1),
        lastMatchAt:     FieldValue.serverTimestamp(),
      });
    } else {
      // Win/Loss: update per-mode counters; only update ELO rating for PUBLIC matches
      const winnerPlayedField = isPublic ? "matchesPlayedPublic"  : "matchesPlayedPrivate";
      const winnerWonField    = isPublic ? "matchesWonPublic"     : "matchesWonPrivate";
      const loserPlayedField  = isPublic ? "matchesPlayedPublic"  : "matchesPlayedPrivate";
      const loserLostField    = isPublic ? "matchesLostPublic"    : "matchesLostPrivate";

      // Build winner update — rating only changes for public matches
      const winnerUpdate = {
        [winnerPlayedField]: FieldValue.increment(1),
        [winnerWonField]:    FieldValue.increment(1),
        lastMatchAt:         FieldValue.serverTimestamp(),
      };
      if (isPublic) winnerUpdate.rating = newWinnerRating;

      // Build loser update — rating only changes for public matches
      const loserUpdate = {
        [loserPlayedField]:  FieldValue.increment(1),
        [loserLostField]:    FieldValue.increment(1),
        lastMatchAt:         FieldValue.serverTimestamp(),
      };
      if (isPublic) loserUpdate.rating = newLoserRating;

      batch.update(winnerRef, winnerUpdate);
      batch.update(loserRef,  loserUpdate);
    }

    await batch.commit();

    console.log(
      `[POST /api/users/update-ratings-internal] roomId=${roomId} matchType=${matchType} isDraw=${isDraw} — ` +
      (isDraw
        ? `tie between ${winnerId} and ${loserId}`
        : `${winnerId}: +${winnerDelta} → ${newWinnerRating} | ${loserId}: ${loserDelta} → ${newLoserRating}`)
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[POST /api/users/update-ratings-internal] Error:", err.message);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

module.exports = router;
