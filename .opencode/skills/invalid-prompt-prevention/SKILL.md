---
name: invalid-prompt-prevention
description: Use when a request or tool call may trigger an Invalid prompt error; normalize malformed prompts before execution and avoid repeating the same invalid request.
---

# Invalid Prompt Prevention

Use this skill before executing a request when the current session has shown
`Invalid prompt`, or when the user's request contains malformed tool syntax,
conflicting instructions, missing required context, or an unsupported action.

## Rules

- Do not retry the exact same prompt or tool call after an `Invalid prompt`
  error.
- Identify the rejected part before retrying: malformed syntax, unsupported
  tool arguments, invalid file path, missing required field, conflicting
  requirements, or an empty/ambiguous operation.
- Rewrite the request as one concise, explicit operation with the required
  context included.
- Keep user intent unchanged. Do not silently drop requirements; ask one short
  clarifying question when the request is genuinely ambiguous.
- Separate compound requests into sequential steps when a single prompt would
  mix planning, editing, tool execution, and verification ambiguously.
- For tool calls, validate the argument shape against the tool schema before
  calling it. Use exact target references returned by the latest snapshot or
  search result, not stale references.
- Use absolute paths for file reads and uploads when the tool requires them.
- Never put analysis, XML-like control text, tool names, or internal reasoning
  in the user-facing prompt passed to a tool.
- If a tool call fails because the target is stale or missing, refresh the
  relevant file search, page snapshot, or tab list before retrying.
- If the same request fails twice for different validation reasons, stop
  automatic retries and report the concrete blocker to the user.

## Recovery Pattern

1. Record the failing operation and exact validation error.
2. Reduce the operation to the smallest valid request.
3. Re-check required fields, paths, targets, and conflicting constraints.
4. Execute the corrected request once.
5. If it fails again, explain what input is required instead of repeating it.

## Examples

Bad recovery:

```text
Retry the same malformed tool call.
```

Good recovery:

```text
The previous call was rejected because the target reference is stale. Refresh
the page snapshot, select the current target reference, and retry the click
with the newly returned target.
```

For a vague coding request:

```text
The request could mean either changing the application code or changing the
OpenCode configuration. Ask which one is intended before editing files.
```
