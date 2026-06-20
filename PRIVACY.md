# Privacy Policy

**Last updated:** June 20, 2026

This privacy policy describes how **WHOOP MCP** (“the Application”) handles information when you connect your WHOOP account for personal use with an MCP-compatible AI client (such as Cursor or Claude Desktop).

## Summary

WHOOP MCP is a **local, personal-use application**. It runs on your own computer. It does not operate a cloud service, does not sell data, and does not share your WHOOP data with third parties except as required to call the official WHOOP API on your behalf.

## Information We Access

With your explicit OAuth authorization, the Application may read WHOOP data you have granted access to, including:

- Profile information (name, email)
- Body measurements (height, weight, max heart rate)
- Physiological cycles (strain, heart rate, energy)
- Recovery metrics (recovery score, HRV, resting heart rate, SpO2, skin temperature)
- Sleep data (duration, stages, performance, efficiency)
- Workout data (activity type, strain, heart rate zones, distance)

The Application is **read-only**. It cannot modify your WHOOP account or health records.

## How Information Is Used

WHOOP data is used solely to:

- Display your health and fitness information in your local AI assistant when you ask questions
- Authenticate with the official WHOOP API using OAuth 2.0

Data is not used for advertising, profiling, or analytics.

## Where Data Is Stored

- **OAuth tokens** are stored locally on your device at `~/.whoop-mcp/tokens.json` with restricted file permissions.
- **WHOOP health data** is fetched on demand from the WHOOP API and passed to your local MCP client. It is not persisted to a remote database by this Application.
- Your AI client (Cursor, Claude Desktop, etc.) may retain conversation history according to its own privacy policy.

## Data Sharing

The Application does not transmit your WHOOP data to any server operated by the Application author. The only external communication is with the **WHOOP API** ([developer.whoop.com](https://developer.whoop.com)) to authenticate and retrieve your authorized data.

We do not sell, rent, or trade your personal information.

## Your Choices

- You choose which WHOOP OAuth scopes to grant when authorizing the Application.
- You can revoke access at any time via the `whoop_revoke_access` tool or by removing the app in your WHOOP account settings.
- You can delete locally stored tokens by removing `~/.whoop-mcp/tokens.json`.

## Contact

For questions about this privacy policy, contact the Application operator at the email address associated with this WHOOP developer application.

---

*WHOOP MCP is an independent project and is not affiliated with, endorsed by, or sponsored by WHOOP, Inc.*
