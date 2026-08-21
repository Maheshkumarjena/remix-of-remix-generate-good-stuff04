export type Role = "student" | "staff" | "admin" | "warden" | "lab_incharge";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  department_id?: string | null;
  preferred_language?: string | null;
  notification_prefs?: Record<string, boolean> | null;
  notification_preferences?: Record<string, boolean> | null;
}

export interface ServiceRequest {
  id: string;
  type?: string;
  request_type?: string;
  status: string;
  title?: string;
  description?: string;
  department?: string | null;
  department_id?: string | null;
  departmentId?: string | null;
  session_id?: string | null;
  sessionId?: string | null;
  userId?: string;
  requestTypeId?: string;
  sla_due_at?: string | null;
  slaDueAt?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  resolvedAt?: string | null;
  timeline?: WorkflowStep[];
}

export interface WorkflowStep {
  id?: string;
  status: string;
  step_name?: string;
  stepName?: string;
  tool_name?: string;
  toolName?: string;
  risk_level?: string;
  riskLevel?: string;
  actor?: string | null;
  note?: string | null;
  rationale?: string | null;
  executed_at?: string | null;
  executedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  request?: {
    id?: string;
    userId?: string;
    description?: string;
  };
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
  role?: "user" | "assistant" | "system";
  sender?: "user" | "agent" | "assistant" | "system";
  content: string;
  confidence_score?: number | null;
  cited_chunk_ids?: string[];
  created_at?: string;
  createdAt?: string;
  pending?: boolean;
}

export interface PlanStep {
  id?: string;
  step_name?: string;
  tool_name?: string;
  title?: string;
  description?: string;
  rationale?: string;
  status?: string;
  tool?: string;
  risk_level?: string;
  riskLevel?: string;
}

export interface Approval {
  id: string;
  workflowStepId?: string;
  reviewerId?: string | null;
  decision?: string | null;
  reason?: string | null;
  question?: string | null;
  contextJson?: Record<string, unknown>;
  decidedAt?: string | null;
  createdAt?: string;
  workflowStep?: WorkflowStep;
  status?: string;
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
  executed?: boolean;
  executed_at?: string;
  result?: Record<string, unknown>;
}

export interface LabResource {
  id: string;
  name: string;
  departmentId?: string;
  department_id?: string;
  location?: string;
  capacity?: number;
  restrictions?: string;
}

export interface LabBooking {
  id: string;
  resource_id?: string;
  resourceId?: string;
  resource_name?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  course_code?: string;
  courseCode?: string;
  faculty_reference?: string;
  facultyRef?: string;
  user_id?: string;
  userId?: string;
  status?: string;
}

export interface Grievance {
  id: string;
  category: string;
  description: string;
  status: string;
  anonymous?: boolean;
  is_anonymous?: boolean;
  escalation_level?: number | string;
  escalationLevel?: number | string;
  sla_due_at?: string;
  slaDueAt?: string;
  evidence_urls?: string[];
  created_at?: string;
  createdAt?: string;
  user_id?: string;
  userId?: string;
  ownerUserId?: string;
  escalation_history?: Array<{
    level: number;
    escalated_at: string;
    escalated_by?: string;
    reason?: string;
  }>;
}

export interface Notification {
  id: string;
  userId?: string;
  user_id?: string;
  title?: string;
  message?: string;
  body?: string;
  read?: boolean;
  is_read?: boolean;
  readFlag?: boolean;
  deepLink?: string;
  created_at?: string;
  createdAt?: string;
}

export interface KbDocument {
  id: string;
  title: string;
  document_id?: string;
  version?: string;
  status?: string;
  chunk_count?: number;
  effective_date?: string;
  uploaded_by?: string;
  file_url?: string | null;
  updated_at?: string;
  createdAt?: string;
}

export interface KbChunk {
  id?: string;
  chunk_id?: string;
  document_id?: string;
  source_document?: string;
  document_version?: string;
  version?: string;
  page?: number;
  clause?: string;
  similarity?: number;
  content?: string;
  text?: string;
}

export interface AuditEvent {
  id: string;
  entity_type?: string;
  entityType?: string;
  entity_id?: string;
  entityId?: string;
  action: string;
  actor?: string;
  actor_id?: string;
  payloadJson?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  prevHash?: string;
  prev_hash?: string;
  entryHash?: string;
  hash?: string;
  createdAt?: string;
  created_at?: string;
}

export interface PolicyConflict {
  id: string;
  doc_a?: {
    document_id?: string;
    clause?: string;
    version?: string;
  };
  doc_b?: {
    document_id?: string;
    clause?: string;
    version?: string;
  };
  document_a?: Record<string, unknown>;
  document_b?: Record<string, unknown>;
  summary?: string;
  raised_at?: string;
  detected_at?: string;
  status?: string;
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
  broken_at_entry_id?: string;
}

export interface StudentProfile {
  registrationNo: string;
  rollNo?: string;
  name: string;
  email?: string;
  departmentName?: string;
  departmentId?: string;
  sectionName?: string;
  batchLabel?: string;
  year?: number;
  semester?: number;
  admissionYear?: number;
  status?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface AnnualFeeSummary {
  student?: {
    registrationNo?: string;
    name?: string;
    departmentName?: string;
  };
  academicYear: number;
  totalTuitionFee: number;
  totalHostelFee: number;
  totalExamFee: number;
  totalAnnualScheduledFee: number;
  totalAmountPaid: number;
  outstandingBalance: number;
  isFullyPaid: boolean;
  paymentStatus: "paid" | "partial" | "unpaid" | string;
  recentReceiptNo?: string | null;
}

export interface FeeStatusItem {
  id: string;
  amountPaid: number;
  paymentStatus: string;
  paymentDate?: string;
  receiptNo?: string;
  paymentMode?: string;
  structure?: {
    year?: number;
    semester?: number;
    tuitionFee?: number;
    hostelFee?: number;
    examFee?: number;
    dueDate?: string;
  };
}

export interface ExamRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  examType: "mid_sem" | "end_sem" | "supplementary" | string;
  marksObtained: number;
  maxMarks: number;
  status: "published" | "pending" | "under_review" | string;
  publishedAt?: string;
}

export interface SeminarHall {
  id: string;
  name: string;
  departmentId?: string | null;
  capacity: number;
  hasProjector: boolean;
  hasAc: boolean;
  location?: string;
}

export interface SeminarHallBooking {
  id: string;
  hallId: string;
  purpose: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "pending_approval" | "cancelled" | string;
  approvalRequired: boolean;
  hall?: {
    name?: string;
    capacity?: number;
    location?: string;
  };
  bookedByUserId?: string;
}

