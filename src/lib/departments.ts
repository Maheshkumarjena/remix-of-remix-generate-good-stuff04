export interface CampusDepartment {
  id: string;
  name: string;
  code: string;
  type: "academic" | "administrative" | "hostel";
}

export const CAMPUS_DEPARTMENTS: CampusDepartment[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-111111111111",
    name: "Computer Science & Engineering",
    code: "CSE",
    type: "academic",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-222222222222",
    name: "Electronics & Communication Engg",
    code: "ECE",
    type: "academic",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-333333333333",
    name: "Mechanical Engineering",
    code: "MECH",
    type: "academic",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Academic Section & Registrar",
    code: "ACAD",
    type: "administrative",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-444444444444",
    name: "Examination Section",
    code: "EXAM",
    type: "administrative",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Accounts & Finance",
    code: "ACC",
    type: "administrative",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Hostel Administration",
    code: "HOSTEL",
    type: "hostel",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-555555555555",
    name: "Central Library",
    code: "LIB",
    type: "administrative",
  },
];

export function getDepartmentById(id?: string | null): CampusDepartment | undefined {
  if (!id) return undefined;
  return CAMPUS_DEPARTMENTS.find((d) => d.id === id);
}

export function getDepartmentName(id?: string | null): string {
  if (!id) return "General Campus";
  const dept = getDepartmentById(id);
  return dept ? `${dept.name} (${dept.code})` : id;
}
