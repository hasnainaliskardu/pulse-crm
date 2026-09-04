export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "FOUNDER" | "MEMBER" | "ADMIN";
export type LeadSource =
  | "GOOGLE_MAPS" | "HOUZZ" | "YELP" | "BBB" | "SUNBIZ" | "PERMIT"
  | "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "OTHER";
export type WebsiteStatus = "NONE" | "BROKEN" | "POOR_SEO" | "GOOD";
export type LeadStatus =
  | "NEW" | "RESEARCHING" | "READY" | "CONTACTED" | "REPLIED" | "INTERESTED"
  | "NOT_INTERESTED" | "CALL_BOOKED" | "PROPOSAL" | "WON" | "LOST" | "DORMANT";
export type ReplyType = "NONE" | "NEUTRAL" | "POSITIVE" | "NEGATIVE";
export type TouchChannel = "EMAIL" | "IG_DM" | "WHATSAPP" | "CALL" | "LINKEDIN" | "FACEBOOK";
export type TouchDirection = "OUT" | "IN";
export type TargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY";
export type ClientStatus = "ACTIVE" | "CHURNED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type Workspace = "INTL" | "CALLS";
export type CallOutcome =
  | "INTERESTED" | "REJECTED" | "NO_ANSWER" | "WRONG_NUMBER" | "SWITCHED_OFF"
  | "WHATSAPP_REQUEST" | "MEETING_BOOKED" | "CALLBACK_LATER" | "OTHER";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";
export type MeetingStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type MemberRow = {
  id: string;
  full_name: string;
  email: string;
  position: string;
  role: MemberRole;
  is_active: boolean;
  daily_research_target: number;
  daily_touch_target: number;
  points: number;
  created_at: string;
  workspaces?: Workspace[];
  joining_date?: string | null;
  salary_monthly?: number;
}
export type MemberInsert = {
  id: string;
  full_name: string;
  email: string;
  position?: string;
  role?: MemberRole;
  is_active?: boolean;
  daily_research_target?: number;
  daily_touch_target?: number;
  points?: number;
  created_at?: string;
  workspaces?: Workspace[];
  joining_date?: string | null;
  salary_monthly?: number;
}
export type MemberUpdate = {
  full_name?: string;
  email?: string;
  position?: string;
  role?: MemberRole;
  is_active?: boolean;
  daily_research_target?: number;
  daily_touch_target?: number;
  points?: number;
  workspaces?: Workspace[];
  joining_date?: string | null;
  salary_monthly?: number;
}

export type LeadRow = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  niche: string | null;
  source: LeadSource;
  website_url: string | null;
  website_status: WebsiteStatus;
  seo_score: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  assigned_to: string | null;
  status: LeadStatus;
  reply_type: ReplyType;
  monthly_value: number | null;
  notes: string | null;
  last_activity_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  workspace?: Workspace;
  is_visible_to_assignee?: boolean;
  assigned_at?: string | null;
}
export type LeadInsert = {
  id?: string;
  business_name: string;
  city?: string | null;
  state?: string | null;
  niche?: string | null;
  source?: LeadSource;
  website_url?: string | null;
  website_status?: WebsiteStatus;
  seo_score?: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  assigned_to?: string | null;
  status?: LeadStatus;
  reply_type?: ReplyType;
  monthly_value?: number | null;
  notes?: string | null;
  created_by?: string | null;
  workspace?: Workspace;
}
export type LeadUpdate = Partial<LeadInsert>;

export type TouchRow = {
  id: string;
  lead_id: string;
  member_id: string;
  channel: TouchChannel;
  direction: TouchDirection;
  message_summary: string;
  message_full: string | null;
  occurred_at: string;
  created_at: string;
  outcome?: CallOutcome | null;
}
export type TouchInsert = {
  id?: string;
  lead_id: string;
  member_id: string;
  channel: TouchChannel;
  direction: TouchDirection;
  message_summary: string;
  message_full?: string | null;
  occurred_at?: string;
}
export type TouchUpdate = Partial<TouchInsert>;

export type DailyStatRow = {
  id: string;
  member_id: string;
  date: string;
  leads_researched: number;
  touches_sent: number;
  replies_received: number;
  positive_replies: number;
  calls_booked: number;
  clients_closed: number;
}
export type DailyStatInsert = {
  id?: string;
  member_id: string;
  date: string;
  leads_researched?: number;
  touches_sent?: number;
  replies_received?: number;
  positive_replies?: number;
  calls_booked?: number;
  clients_closed?: number;
}
export type DailyStatUpdate = Partial<DailyStatInsert>;

export type TargetRow = {
  id: string;
  member_id: string | null;
  period: TargetPeriod;
  metric: string;
  value: number;
}
export type TargetInsert = {
  id?: string;
  member_id?: string | null;
  period?: TargetPeriod;
  metric: string;
  value: number;
}
export type TargetUpdate = Partial<TargetInsert>;

export type ClientRow = {
  id: string;
  business_name: string;
  closed_by: string | null;
  monthly_revenue: number;
  started_at: string;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
}
export type ClientInsert = {
  id?: string;
  business_name: string;
  closed_by?: string | null;
  monthly_revenue?: number;
  started_at?: string;
  status?: ClientStatus;
  notes?: string | null;
}
export type ClientUpdate = Partial<ClientInsert>;

export type ActivityLogRow = {
  id: number;
  member_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Json | null;
  created_at: string;
}
export type ActivityLogInsert = {
  member_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  detail?: Json | null;
}

export type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  lead_id: string | null;
  priority: TaskPriority;
  done: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type TaskInsert = {
  id?: string;
  title: string;
  due_date?: string | null;
  assigned_to?: string | null;
  lead_id?: string | null;
  priority?: TaskPriority;
  done?: boolean;
  created_by?: string | null;
}
export type TaskUpdate = Partial<TaskInsert>;

export type NoteRow = {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}
export type NoteInsert = {
  id?: string;
  lead_id: string;
  author_id?: string | null;
  body: string;
}

export type FileRow = {
  id: string;
  lead_id: string;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}
export type FileInsert = {
  id?: string;
  lead_id: string;
  uploaded_by?: string | null;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}

export type CustomFieldRow = {
  id: string;
  entity: "LEAD" | "CLIENT";
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "DATE";
  options: string[] | null;
  created_at: string;
}

export type WorkflowRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger_entity: string;
  trigger_event: string;
  trigger_value: string | null;
  action_type: "CREATE_TASK" | "CREATE_CLIENT" | "SET_FIELD" | "WEBHOOK";
  action_config: Record<string, unknown>;
  created_at: string;
}

export type SettingsRow = {
  key: string;
  value: string;
  updated_at: string;
}

export type MeetingRow = {
  id: string;
  lead_id: string | null;
  member_id: string | null;
  title: string;
  scheduled_at: string;
  status: MeetingStatus;
  notes: string | null;
  created_at: string;
}

export type AttendanceRow = {
  id: string;
  member_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
}

export type SalaryRow = {
  id: string;
  member_id: string;
  month: string;
  base_amount: number;
  commission_amount: number;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Supabase-js compatible Database shape (non-circular). */
export type Database = {
  public: {
    Tables: {
      members: { Row: MemberRow; Insert: MemberInsert; Update: MemberUpdate; Relationships: [] };
      leads: { Row: LeadRow; Insert: LeadInsert; Update: LeadUpdate; Relationships: [] };
      touches: { Row: TouchRow; Insert: TouchInsert; Update: TouchUpdate; Relationships: [] };
      daily_stats: { Row: DailyStatRow; Insert: DailyStatInsert; Update: DailyStatUpdate; Relationships: [] };
      targets: { Row: TargetRow; Insert: TargetInsert; Update: TargetUpdate; Relationships: [] };
      clients: { Row: ClientRow; Insert: ClientInsert; Update: ClientUpdate; Relationships: [] };
      activity_log: { Row: ActivityLogRow; Insert: ActivityLogInsert; Update: Partial<ActivityLogInsert>; Relationships: [] };
      tasks: { Row: TaskRow; Insert: TaskInsert; Update: TaskUpdate; Relationships: [] };
      notes: { Row: NoteRow; Insert: NoteInsert; Update: Partial<NoteInsert>; Relationships: [] };
      files: { Row: FileRow; Insert: FileInsert; Update: Partial<FileInsert>; Relationships: [] };
      custom_fields: { Row: CustomFieldRow; Insert: Partial<CustomFieldRow>; Update: Partial<CustomFieldRow>; Relationships: [] };
      workflow_rules: { Row: WorkflowRuleRow; Insert: Partial<WorkflowRuleRow>; Update: Partial<WorkflowRuleRow>; Relationships: [] };
      settings: { Row: SettingsRow; Insert: Partial<SettingsRow>; Update: Partial<SettingsRow>; Relationships: [] };
      meetings: { Row: MeetingRow; Insert: Partial<MeetingRow>; Update: Partial<MeetingRow>; Relationships: [] };
      attendance: { Row: AttendanceRow; Insert: Partial<AttendanceRow>; Update: Partial<AttendanceRow>; Relationships: [] };
      salaries: { Row: SalaryRow; Insert: Partial<SalaryRow>; Update: Partial<SalaryRow>; Relationships: [] };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: { [_ in never]: never };
    Enums: {
      member_role: MemberRole;
      lead_source: LeadSource;
      website_status: WebsiteStatus;
      lead_status: LeadStatus;
      reply_type: ReplyType;
      touch_channel: TouchChannel;
      touch_direction: TouchDirection;
      target_period: TargetPeriod;
      client_status: ClientStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
