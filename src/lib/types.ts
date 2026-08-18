export type Role = "student" | "staff" | "admin" | "warden" | "lab_incharge";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  preferred_language?: string | null;
  notification_prefs?: Record<string, boolean> | null;
  notification_preferences?: Record<string, boolean> | null;
}

export interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  title?: string;
  description?: string;
  department?: string | null;
  session_id?: string | null;
  sla_due_at?: string | null;
  created_at?: string;
  updated_at?: string;
  timeline?: WorkflowStep[];
}

export interface WorkflowStep {
  id?: string;
  status: string;
  actor?: string | null;
  note?: string | null;
  created_at?: string;
}

export interface Paginated<T> {
  data?: T[];
  items?: T[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  cited_chunk_ids?: string[];
  created_at?: string;
  pending?: boolean;
}

export interface PlanStep {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  tool?: string;
  risk_level?: string;
}

export interface Approval {
  id: string;
  status: string;
  risk_level?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  reasoning?: string;
  request_id?: string | null;
  session_id?: string | null;
  requester_name?: string | null;
  original_request?: string | null;
  cited_chunk_ids?: string[];
  evidence?: { document_id?: string; version?: string; page?: number; clause?: string; similarity?: number; text?: string }[];
  created_at?: string;
}

export interface LabResource {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
}

export interface LabBooking {
  id: string;
  resource_id: string;
  resource_name?: string;
  start_time: string;
  end_time: string;
  course_code?: string;
  faculty_reference?: string;
  user_id?: string;
  status?: string;
}

export interface Grievance {
  id: string;
  category: string;
  description: string;
  status: string;
  escalation_level?: number | string;
  is_anonymous?: boolean;
  evidence_urls?: string[];
  created_at?: string;
}

export interface Notification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  read?: boolean;
  is_read?: boolean;
  deepLink?: string;
  created_at?: string;
}

export interface KbDocument {
  id: string;
  title: string;
  version?: string;
  status?: string;
  chunk_count?: number;
  updated_at?: string;
}

export interface KbChunk {
  id?: string;
  chunk_id?: string;
  document_id?: string;
  version?: string;
  page?: number;
  clause?: string;
  similarity?: number;
  content?: string;
  text?: string;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string;
  hash?: string;
  prev_hash?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
}

export interface PolicyConflict {
  id: string;
  document_a?: Record<string, unknown>;
  document_b?: Record<string, unknown>;
  summary?: string;
  detected_at?: string;
}

export interface RequestsSummary {
  by_type: { request_type: string; count: number }[];
  by_status: { status: string; count: number }[];
}

export interface ResolutionTimePoint {
  date: string;
  avg_resolution_hours: number;
}

export interface ResolutionTimeSeries {
  points: ResolutionTimePoint[];
}

export interface BottleneckItem {
  department: string;
  step_name: string;
  overdue_count: number;
}

export interface BottlenecksResponse {
  items: BottleneckItem[];
}

export interface AuditVerifyResponse {
  intact: boolean;
}
