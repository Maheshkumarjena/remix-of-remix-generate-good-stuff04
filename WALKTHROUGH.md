Frontend API & Field Synchronization Walkthrough
All frontend features, fields, request bodies, and response handlers have been synchronized with the backend specifications in 
API_ENDPOINTS.md
.

Key Synchronizations Implemented
1. Unified Dual-Schema Data Models
Updated 
src/lib/types.ts
 with full dual-casing support (camelCase and snake_case) and all missing fields:

User: Added department_id?: string | null.
Approval: Added workflowStepId, reviewerId, decision, reason, question, contextJson, decidedAt, createdAt, workflowStep, result.
WorkflowStep: Added stepName, step_name, toolName, tool_name, riskLevel, risk_level, executedAt, executed_at, rationale, and nested request.
LabBooking: Added resourceId, userId, startTime, endTime, courseCode, facultyRef.
Grievance: Added anonymous, escalationLevel, slaDueAt, createdAt, and escalation_history.
AuditEvent: Added entityType, entityId, entryHash, prevHash, createdAt, actor, payloadJson.
PolicyConflict: Added doc_a, doc_b, raised_at, status.
Notification: Added readFlag, createdAt, userId.
PlanStep: Added step_name, tool_name, rationale, riskLevel.
2. Audit Trail & Hash-Chain Verification
In 
src/routes/admin.audit.tsx
:
Normalized event.entityType ?? event.entity_type and event.entityId ?? event.entity_id.
Fixed "Verify chain" button to send valid /audit/verify/:entityType/:entityId requests.
Fixed "View entity trail" to fetch /audit/:entityType/:entityId.
Displayed event.entryHash ?? event.hash and event.actor ?? event.actor_id.
3. Human-in-the-Loop Approvals Queue
In 
src/routes/staff.approvals.tsx
 and 
src/routes/staff.index.tsx
:
Extracted tool name from a.workflowStep?.toolName ?? a.tool_name.
Extracted risk level from a.workflowStep?.riskLevel ?? a.risk_level.
Extracted decision/status from a.decision ?? a.workflowStep?.status ?? a.status.
Displayed original request and student info from a.workflowStep?.request?.description and a.workflowStep?.request?.userId.
Displayed step name and rationale from a.workflowStep?.stepName and a.workflowStep?.rationale.
4. Lab Slot Bookings & Conflict Handling
In 
src/routes/labs.tsx
:
Displayed slot start & end dates from b.startTime ?? b.start_time and b.endTime ?? b.end_time.
Rendered b.courseCode ?? b.course_code and b.facultyRef ?? b.faculty_reference.
Fixed delete button permission to check (b.userId ?? b.user_id) === user.id.
5. Grievances & Redressal Redesign
In 
src/routes/grievances.tsx
:
Request payload for POST /grievances now sends anonymous: form.is_anonymous.
Checks g.anonymous ?? g.is_anonymous for Anonymous badge.
Displays SLA Due date (g.sla_due_at ?? g.slaDueAt), created date (g.createdAt ?? g.created_at), and escalation history timeline.
6. AI Agent Chat & Plan Sidebar
In 
src/routes/chat.tsx
:
Normalized historic session messages: maps msg.sender === "user" to user bubbles.
Initialized agent session with user's preferred language (language: user.preferred_language ?? "en").
Plan sidebar displays step.step_name, step.rationale, and step.risk_level.
7. Policy Conflicts & Governance Overview
In 
src/routes/admin.policy-conflicts.tsx
 and 
src/routes/admin.index.tsx
:
Visualized doc_a vs doc_b document IDs, clauses, and versions.
Formatted conflict.raised_at ?? conflict.detected_at timestamps and conflict statuses.
8. Notifications & Service Requests
In 
src/routes/notifications.tsx
:
Handled readFlag and createdAt.
In 
src/routes/requests.$requestId.tsx
 & 
src/routes/requests.index.tsx
:
Timeline displays step_name, risk_level, and executed_at.
Request details display request_type, department_id, sla_due_at, resolvedAt, and sessionId.