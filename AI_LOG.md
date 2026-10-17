# AI Usage Log

## Tool used

- GitHub Copilot: assignment analysis, modular Node/React implementation, edge-case review, and test drafting.

## Three useful prompts

1. "Read the attached MIS Assistant Assignment fully; identify every deliverable and edge case before coding."
2. "Use Node.js where the assignment permits it, keep the implementation modular, and choose current non-deprecated packages."
3. "Route by the first three pincode digits, clean the legacy CSV, and write one reconciliation row per input with exactly the specified columns."

## Where AI was wrong and correction

An initial dependency choice followed Firebase's newest client release without checking its engine requirement. That release required Node 24.12, while this workspace has Node 22.18; the Firebase Admin SDK also introduced deprecated transitive packages. I checked the package engine metadata, pinned the current Node-22-compatible Firebase 12 SDK, removed the Admin SDK, and implemented the optional importer with Node's built-in crypto/fetch against Google's OAuth and Firestore REST APIs. The build and importer tests were run again after the correction.