import { ref, get, set, update, remove, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase/config";

// Generates a 6-character code with no ambiguous characters (no 0, O, 1, I, L)
function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function generateInviteCode(patientId, patientName) {
  if (!patientId) throw new Error("patientId is required to generate invite code");

  // Revoke any existing active invites first
  const activeQuery = query(ref(db, "careInvites"), orderByChild("patientId"), equalTo(patientId));
  const activeSnap = await get(activeQuery);
  if (activeSnap.exists()) {
    const updates = {};
    activeSnap.forEach((child) => {
      const invite = child.val();
      if (!invite.used) {
        updates[`careInvites/${child.key}/used`] = true;
        updates[`careInvites/${child.key}/revoked`] = true;
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  }

  // Generate code and check collision
  let code = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    code = generateRandomCode();
    const snap = await get(ref(db, `careInvites/${code}`));
    if (!snap.exists()) {
      isUnique = true;
    }
    attempts++;
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + 48 * 60 * 60 * 1000; // 48 hours

  const inviteData = {
    code,
    patientId,
    patientName: patientName || "Patient",
    createdAt,
    expiresAt,
    used: false,
    usedBy: null,
    usedAt: null
  };

  await set(ref(db, `careInvites/${code}`), inviteData);
  return inviteData;
}

export async function getActiveInvitesForPatient(patientId) {
  if (!patientId) return [];
  const inviteQuery = query(ref(db, "careInvites"), orderByChild("patientId"), equalTo(patientId));
  const snap = await get(inviteQuery);
  const results = [];
  if (snap.exists()) {
    const now = Date.now();
    snap.forEach((child) => {
      const val = child.val();
      if (!val.used && !val.revoked && val.expiresAt > now) {
        results.push(val);
      }
    });
  }
  return results;
}

export async function redeemInviteCode(code, caregiverUid, caregiverName) {
  if (!code) throw new Error("not_found");
  const cleanCode = code.trim().toUpperCase();

  const inviteRef = ref(db, `careInvites/${cleanCode}`);
  const inviteSnap = await get(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("not_found");
  }

  const invite = inviteSnap.val();
  if (invite.used || invite.revoked) {
    throw new Error("already_used");
  }

  if (invite.expiresAt < Date.now()) {
    throw new Error("expired");
  }

  const patientId = invite.patientId;

  // Perform updates in database
  const updates = {};

  // 1. Mark invite as used
  updates[`careInvites/${cleanCode}/used`] = true;
  updates[`careInvites/${cleanCode}/usedBy`] = caregiverUid;
  updates[`careInvites/${cleanCode}/usedAt`] = Date.now();

  // 2. Link caregiver in patient record
  updates[`patients/${patientId}/caregiverId`] = caregiverUid;

  // 3. Link patient in caregiver user record
  updates[`users/${caregiverUid}/linkedPatientIds/${patientId}`] = true;

  // 4. Create caregiverAssignment for queries used by Caregiver Dashboard/Patients list
  updates[`caregiverAssignments/${patientId}`] = {
    caregiverId: caregiverUid,
    patientId: patientId,
    assignedAt: Date.now()
  };

  // 5. Add to Care Room/Care Triangle participants
  updates[`careRooms/${patientId}/caregiverIds/${caregiverUid}`] = true;
  updates[`careRooms/${patientId}/caregiverNames/${caregiverUid}`] = caregiverName;

  // 6. Add to direct conversations if one exists under the patient's ID
  updates[`conversations/${patientId}/participants/${caregiverUid}`] = {
    role: "caregiver",
    name: caregiverName,
    uid: caregiverUid
  };

  await update(ref(db), updates);
  return invite;
}

export async function revokeInvite(inviteCode, patientId) {
  if (!inviteCode) return;
  const cleanCode = inviteCode.trim().toUpperCase();
  const inviteRef = ref(db, `careInvites/${cleanCode}`);
  const snap = await get(inviteRef);
  if (snap.exists()) {
    const val = snap.val();
    if (val.patientId === patientId) {
      await update(inviteRef, { used: true, revoked: true });
    }
  }
}

export async function unlinkCaregiver(patientId, caregiverUid) {
  if (!patientId || !caregiverUid) return;

  const updates = {};
  updates[`patients/${patientId}/caregiverId`] = null;
  updates[`users/${caregiverUid}/linkedPatientIds/${patientId}`] = null;
  updates[`caregiverAssignments/${patientId}`] = null;
  updates[`careRooms/${patientId}/caregiverIds/${caregiverUid}`] = null;
  updates[`careRooms/${patientId}/caregiverNames/${caregiverUid}`] = null;
  updates[`conversations/${patientId}/participants/${caregiverUid}`] = null;

  await update(ref(db), updates);
}
