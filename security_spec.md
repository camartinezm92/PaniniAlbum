# Security Specification - Panini 2026 Sticker Tracker

## 1. Data Invariants
- **User Profiles**: Every user must have a profile document in `users/{userId}` where `userId` matches their authentication UID. The `email` must match the authenticated user's email.
- **Album Ownership**: An album in `albums/{userId}` belongs exclusively to the user with that UID.
- **Sticker Integrity**: Sticker IDs must follow the format `TEAM-NUMBER` (e.g., `COL-1`, `FWC-5`, `CC-14`).
- **Data Types**: Counts must be integers >= 0.
- **Audit Trails**: All writes must include a server-side `updatedAt` timestamp.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Identity Spoofing**: Attempting to write to `users/attacker_uid` with `uid: "victim_uid"`.
2. **Privilege Escalation**: Attempting to add `role: "admin"` to a user profile.
3. **Cross-User Write**: User A attempting to update `albums/UserB`.
4. **Invalid State**: Setting a sticker count to `-5`.
5. **ID Poisoning**: Using a 2KB string as a sticker ID key in the `stickers` map.
6. **Timestamp Spoofing**: Sending a manual string date instead of `request.time` for `updatedAt`.
7. **Shadow Field Injection**: Adding `isVerified: true` to an album document.
8. **Unauthenticated Read**: Attempting to list all users without being logged in.
9. **Email Hijacking**: User A trying to set their profile email to User B's verified email.
10. **Resource Exhaustion**: Sending an album with 50,000 unique (invalid) sticker keys.
11. **Immutable Violation**: Attempting to change the `userId` field once an album is created.
12. **Delete Attack**: Attempting to delete the `admins` collection (if it existed) or other users' profiles.

## 3. Conflict Report & Mitigation
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| `users` | Blocked by `isOwner(userId)` | N/A | Blocked by `isValidUser()` |
| `albums` | Blocked by `isOwner(userId)` | N/A | Blocked by `isValidAlbum()` |

## 4. Verification Plan
- Deploy rules to Firebase.
- Verify that `set_up_firebase` works correctly for the current user.
- Test comparison mode with a mock ID to ensure read-only access works.
