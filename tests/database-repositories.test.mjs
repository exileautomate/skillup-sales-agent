import assert from "node:assert/strict";
import test from "node:test";

import {
  getCourseByInternalName,
  getCourseBySlug,
  listCourses,
} from "../src/lib/db/repositories/courses.ts";
import {
  getActiveBranchesForCourse,
  getBranchByName,
} from "../src/lib/db/repositories/branches.ts";
import {
  createLead,
  findLeadByChannelUserId,
} from "../src/lib/db/repositories/leads.ts";
import {
  findLatestConversationForLeadChannel,
  listConversationsForLead,
  updateConversation,
} from "../src/lib/db/repositories/conversations.ts";
import {
  createDemoBookingRecord,
  getDemoBookingById,
} from "../src/lib/db/repositories/demo-bookings.ts";
import {
  getKnowledgeBaseRecordById,
  listKnowledgeBaseRecords,
} from "../src/lib/db/repositories/knowledge-base.ts";

function createMockClient(result, trace = []) {
  function createQuery() {
    const query = Promise.resolve(result);

    Object.assign(query, {
      select(columns) {
        trace.push(["select", columns]);
        return query;
      },
      eq(column, value) {
        trace.push(["eq", column, value]);
        return query;
      },
      order(column, options) {
        trace.push(["order", column, options]);
        return query;
      },
      limit(value) {
        trace.push(["limit", value]);
        return query;
      },
      maybeSingle() {
        trace.push(["maybeSingle"]);
        return Promise.resolve(result);
      },
      single() {
        trace.push(["single"]);
        return Promise.resolve(result);
      },
    });

    return query;
  }

  return {
    from(table) {
      trace.push(["from", table]);
      const query = createQuery();

      return {
        select: query.select,
        insert(input) {
          trace.push(["insert", input]);
          return query;
        },
        update(input) {
          trace.push(["update", input]);
          return query;
        },
      };
    },
  };
}

test("course repositories use deterministic keyed reads and normal absence returns null", async () => {
  const trace = [];
  const client = createMockClient({ data: null, error: null }, trace);

  const bySlug = await getCourseBySlug("missing-course", client);
  const byInternalName = await getCourseByInternalName("missing_course", client);

  assert.equal(bySlug, null);
  assert.equal(byInternalName, null);
  assert.deepEqual(
    trace.filter(([operation]) => operation === "eq"),
    [
      ["eq", "slug", "missing-course"],
      ["eq", "internal_name", "missing_course"],
    ],
  );
});

test("course repositories surface database failures instead of returning not found", async () => {
  const client = createMockClient({
    data: null,
    error: { message: "connection unavailable" },
  });

  await assert.rejects(
    () => getCourseBySlug("data-analytics", client),
    /Database course lookup by slug failed: connection unavailable/,
  );
});

test("course and branch list reads return rows from the database response", async () => {
  const courses = await listCourses(
    createMockClient({ data: [{ id: "course-1", slug: "data-analytics" }], error: null }),
  );
  const branch = await getBranchByName(
    "Calicut",
    createMockClient({ data: { id: "branch-1", name: "Calicut" }, error: null }),
  );

  assert.deepEqual(courses, [{ id: "course-1", slug: "data-analytics" }]);
  assert.deepEqual(branch, { id: "branch-1", name: "Calicut" });
});

test("active branch lookup reads course_branches and returns only related branch rows", async () => {
  const trace = [];
  const branches = await getActiveBranchesForCourse(
    "course-1",
    createMockClient(
      {
        data: [
          { branch: { id: "branch-2", name: "Mankave" } },
          { branch: { id: "branch-1", name: "Calicut" } },
          { branch: null },
        ],
        error: null,
      },
      trace,
    ),
  );

  assert.deepEqual(branches, [
    { id: "branch-1", name: "Calicut" },
    { id: "branch-2", name: "Mankave" },
  ]);
  assert.ok(trace.some(([operation, value]) => operation === "from" && value === "course_branches"));
  assert.ok(trace.some(([operation, column, value]) => operation === "eq" && column === "course_id" && value === "course-1"));
  assert.ok(trace.some(([operation, column, value]) => operation === "eq" && column === "is_active" && value === true));
});

test("lead primitives create a returned record and find by stable channel identity", async () => {
  const createTrace = [];
  const created = await createLead(
    { channel: "telegram", channel_user_id: "123" },
    createMockClient(
      { data: { id: "lead-1", channel: "telegram", channel_user_id: "123" }, error: null },
      createTrace,
    ),
  );
  const found = await findLeadByChannelUserId(
    "telegram",
    "123",
    createMockClient({ data: { id: "lead-1" }, error: null }),
  );

  assert.deepEqual(created, { id: "lead-1", channel: "telegram", channel_user_id: "123" });
  assert.deepEqual(found, { id: "lead-1" });
  assert.deepEqual(createTrace.find(([operation]) => operation === "insert"), [
    "insert",
    { channel: "telegram", channel_user_id: "123" },
  ]);
});

test("conversation primitives return empty lead lists and surface update results", async () => {
  const conversations = await listConversationsForLead(
    "lead-1",
    createMockClient({ data: [], error: null }),
  );
  const updated = await updateConversation(
    "conversation-1",
    { pending_question: "Which branch?" },
    createMockClient({ data: { id: "conversation-1", pending_question: "Which branch?" }, error: null }),
  );

  assert.deepEqual(conversations, []);
  assert.deepEqual(updated, { id: "conversation-1", pending_question: "Which branch?" });
});

test("latest conversation lookup scopes channel and orders ties deterministically", async () => {
  const trace = [];
  const latest = await findLatestConversationForLeadChannel(
    "lead-1",
    "telegram",
    createMockClient(
      {
        data: { id: "conversation-2", lead_id: "lead-1", channel: "telegram" },
        error: null,
      },
      trace,
    ),
  );

  assert.deepEqual(latest, {
    id: "conversation-2",
    lead_id: "lead-1",
    channel: "telegram",
  });
  assert.deepEqual(
    trace.filter(([operation]) => operation === "eq"),
    [
      ["eq", "lead_id", "lead-1"],
      ["eq", "channel", "telegram"],
    ],
  );
  assert.deepEqual(
    trace.filter(([operation]) => operation === "order"),
    [
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ],
  );
  assert.deepEqual(trace.find(([operation]) => operation === "limit"), ["limit", 1]);
});

test("demo booking primitives preserve database results without confirmation logic", async () => {
  const created = await createDemoBookingRecord(
    {
      lead_id: "lead-1",
      conversation_id: "conversation-1",
      course_id: "course-1",
      branch_id: "branch-1",
      student_name: "Student",
      contact: "123",
      booking_date: "2026-10-10",
      booking_time: "10:00:00",
    },
    createMockClient({ data: { id: "booking-1", status: "PENDING" }, error: null }),
  );
  const absent = await getDemoBookingById(
    "missing-booking",
    createMockClient({ data: null, error: null }),
  );

  assert.deepEqual(created, { id: "booking-1", status: "PENDING" });
  assert.equal(absent, null);
});

test("knowledge-base primitives filter structured fields and support normal absence", async () => {
  const trace = [];
  const records = await listKnowledgeBaseRecords(
    { course_id: "course-1", category: "fees", student_facing: true },
    createMockClient({ data: [], error: null }, trace),
  );
  const absent = await getKnowledgeBaseRecordById(
    "missing-record",
    createMockClient({ data: null, error: null }),
  );

  assert.deepEqual(records, []);
  assert.equal(absent, null);
  assert.deepEqual(
    trace.filter(([operation]) => operation === "eq"),
    [
      ["eq", "course_id", "course-1"],
      ["eq", "category", "fees"],
      ["eq", "student_facing", true],
    ],
  );
});
