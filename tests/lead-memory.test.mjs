import assert from "node:assert/strict";
import test from "node:test";

import { applyLeadMemory } from "../src/core/memory/lead-memory.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    channel: "telegram",
    channel_user_id: "101",
    name: null,
    phone: null,
    preferred_language: null,
    qualification: null,
    current_course_interest_id: null,
    branch_preference_id: null,
    lead_status: "NEW",
    created_at: "2026-09-23T09:00:00.000Z",
    updated_at: "2026-09-23T09:00:00.000Z",
    ...overrides,
  };
}

function semanticNormalization(overrides = {}) {
  return {
    normalizedEnglish: "Okay",
    detectedOriginalLanguage: "manglish",
    uncertainty: [],
    preservedEntities: [],
    ...overrides,
  };
}

function turnAnalysis(overrides = {}) {
  return {
    language: "manglish",
    requestedResponseLanguage: null,
    course: null,
    intents: ["other"],
    leadFacts: {
      name: null,
      qualification: null,
      branchPreference: null,
      contact: null,
    },
    objection: null,
    salesSignal: "unclear",
    intentRelationship: "single",
    ambiguity: [],
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    getBranchByName: async () => null,
    getCourseByInternalName: async () => null,
    updateLead: async () => {
      throw new Error("updateLead should not be called");
    },
    ...overrides,
  };
}

test("no explicit current-turn memory facts cause no Lead update", async () => {
  const storedLead = lead({
    name: "Stored Name",
    qualification: "Stored Qualification",
    preferred_language: "english",
    current_course_interest_id: "course-existing",
    branch_preference_id: "branch-existing",
  });
  let updateCalls = 0;

  const result = await applyLeadMemory(
    {
      lead: storedLead,
      semanticNormalization: semanticNormalization(),
      turnAnalysis: turnAnalysis({
        leadFacts: {
          name: "   ",
          qualification: "\t",
          branchPreference: "  ",
          contact: "new-phone-must-not-persist",
        },
      }),
    },
    dependencies({
      updateLead: async () => {
        updateCalls += 1;
        throw new Error("unexpected update");
      },
    }),
  );

  assert.strictEqual(result.lead, storedLead);
  assert.deepEqual(result.changedFields, []);
  assert.equal(updateCalls, 0);
});

test("explicit names are persisted and explicit later names are corrections", async () => {
  for (const [storedName, explicitName] of [
    [null, "  Anu  "],
    ["Anu", "Anjali"],
  ]) {
    const storedLead = lead({ name: storedName });
    let receivedPatch;
    const result = await applyLeadMemory(
      {
        lead: storedLead,
        semanticNormalization: semanticNormalization(),
        turnAnalysis: turnAnalysis({
          leadFacts: {
            name: explicitName,
            qualification: null,
            branchPreference: null,
            contact: null,
          },
        }),
      },
      dependencies({
        updateLead: async (_id, patch) => {
          receivedPatch = patch;
          return lead({ ...storedLead, ...patch });
        },
      }),
    );

    assert.deepEqual(receivedPatch, {
      name: explicitName.trim(),
    });
    assert.deepEqual(result.changedFields, ["name"]);
  }
});

test("explicit qualifications are persisted and explicit corrections replace them", async () => {
  for (const [storedQualification, explicitQualification] of [
    [null, "BCom"],
    ["BCom", "MCom"],
  ]) {
    let receivedPatch;
    const result = await applyLeadMemory(
      {
        lead: lead({ qualification: storedQualification }),
        semanticNormalization: semanticNormalization(),
        turnAnalysis: turnAnalysis({
          leadFacts: {
            name: null,
            qualification: explicitQualification,
            branchPreference: null,
            contact: null,
          },
        }),
      },
      dependencies({
        updateLead: async (_id, patch) => {
          receivedPatch = patch;
          return lead({ ...patch });
        },
      }),
    );

    assert.deepEqual(receivedPatch, {
      qualification: explicitQualification,
    });
    assert.deepEqual(result.changedFields, ["qualification"]);
  }
});

test("an explicit requested response language updates preferred language", async () => {
  let receivedPatch;
  const result = await applyLeadMemory(
    {
      lead: lead({ preferred_language: "english" }),
      semanticNormalization: semanticNormalization(),
      turnAnalysis: turnAnalysis({ requestedResponseLanguage: "malayalam" }),
    },
    dependencies({
      updateLead: async (_id, patch) => {
        receivedPatch = patch;
        return lead({ preferred_language: "malayalam" });
      },
    }),
  );

  assert.deepEqual(receivedPatch, { preferred_language: "malayalam" });
  assert.deepEqual(result.changedFields, ["preferred_language"]);
});

test("detected current language alone does not create a preferred language", async () => {
  let updateCalls = 0;
  const storedLead = lead();
  const result = await applyLeadMemory(
    {
      lead: storedLead,
      semanticNormalization: semanticNormalization({
        detectedOriginalLanguage: "malayalam",
      }),
      turnAnalysis: turnAnalysis({ language: "malayalam" }),
    },
    dependencies({
      updateLead: async () => {
        updateCalls += 1;
        throw new Error("unexpected update");
      },
    }),
  );

  assert.strictEqual(result.lead, storedLead);
  assert.equal(updateCalls, 0);
});

test("an explicit valid branch preference is resolved before its ID is stored", async () => {
  let receivedBranchName;
  let receivedPatch;
  const result = await applyLeadMemory(
    {
      lead: lead(),
      semanticNormalization: semanticNormalization(),
      turnAnalysis: turnAnalysis({
        leadFacts: {
          name: null,
          qualification: null,
          branchPreference: "  Future Branch  ",
          contact: null,
        },
      }),
    },
    dependencies({
      getBranchByName: async (name) => {
        receivedBranchName = name;
        return { id: "branch-future", name };
      },
      updateLead: async (_id, patch) => {
        receivedPatch = patch;
        return lead({ branch_preference_id: "branch-future" });
      },
    }),
  );

  assert.equal(receivedBranchName, "Future Branch");
  assert.deepEqual(receivedPatch, {
    branch_preference_id: "branch-future",
  });
  assert.deepEqual(result.changedFields, ["branch_preference_id"]);
});

test("an unknown explicit branch preserves an existing branch preference", async () => {
  const storedLead = lead({ branch_preference_id: "branch-existing" });
  let updateCalls = 0;
  const result = await applyLeadMemory(
    {
      lead: storedLead,
      semanticNormalization: semanticNormalization(),
      turnAnalysis: turnAnalysis({
        leadFacts: {
          name: null,
          qualification: null,
          branchPreference: "Unknown Branch",
          contact: null,
        },
      }),
    },
    dependencies({
      updateLead: async () => {
        updateCalls += 1;
        throw new Error("unexpected update");
      },
    }),
  );

  assert.strictEqual(result.lead, storedLead);
  assert.equal(updateCalls, 0);
});

test("an explicit course entity and canonical analysis establish empty course interest", async () => {
  let receivedCourseName;
  let receivedPatch;
  const result = await applyLeadMemory(
    {
      lead: lead(),
      semanticNormalization: semanticNormalization({
        preservedEntities: [{ type: "course", value: "Data Analytics" }],
      }),
      turnAnalysis: turnAnalysis({ course: "data_analytics" }),
    },
    dependencies({
      getCourseByInternalName: async (name) => {
        receivedCourseName = name;
        return { id: "course-data", internal_name: name };
      },
      updateLead: async (_id, patch) => {
        receivedPatch = patch;
        return lead({ current_course_interest_id: "course-data" });
      },
    }),
  );

  assert.equal(receivedCourseName, "data_analytics");
  assert.deepEqual(receivedPatch, {
    current_course_interest_id: "course-data",
  });
  assert.deepEqual(result.changedFields, ["current_course_interest_id"]);
});

test("a context-only canonical course without a current-turn course entity is not stored", async () => {
  const storedLead = lead();
  let courseLookups = 0;
  let updateCalls = 0;
  const result = await applyLeadMemory(
    {
      lead: storedLead,
      semanticNormalization: semanticNormalization({ preservedEntities: [] }),
      turnAnalysis: turnAnalysis({ course: "data_analytics" }),
    },
    dependencies({
      getCourseByInternalName: async () => {
        courseLookups += 1;
        return { id: "course-data", internal_name: "data_analytics" };
      },
      updateLead: async () => {
        updateCalls += 1;
        throw new Error("unexpected update");
      },
    }),
  );

  assert.strictEqual(result.lead, storedLead);
  assert.equal(courseLookups, 0);
  assert.equal(updateCalls, 0);
});

test("an explicit different course does not switch existing persistent interest", async () => {
  const storedLead = lead({ current_course_interest_id: "course-accounting" });
  let courseLookups = 0;
  let updateCalls = 0;
  const result = await applyLeadMemory(
    {
      lead: storedLead,
      semanticNormalization: semanticNormalization({
        preservedEntities: [{ type: "course", value: "Digital Marketing" }],
      }),
      turnAnalysis: turnAnalysis({ course: "digital_marketing" }),
    },
    dependencies({
      getCourseByInternalName: async () => {
        courseLookups += 1;
        return { id: "course-digital", internal_name: "digital_marketing" };
      },
      updateLead: async () => {
        updateCalls += 1;
        throw new Error("unexpected update");
      },
    }),
  );

  assert.strictEqual(result.lead, storedLead);
  assert.equal(courseLookups, 0);
  assert.equal(updateCalls, 0);
});

test("multiple valid facts use one approved patch without mutating inputs", async () => {
  const storedLead = Object.freeze(lead({ phone: "stored-phone" }));
  const semantic = Object.freeze({
    ...semanticNormalization({
      preservedEntities: Object.freeze([
        Object.freeze({ type: "course", value: "Accounting" }),
      ]),
    }),
  });
  const analysis = Object.freeze({
    ...turnAnalysis({
      requestedResponseLanguage: "english",
      course: "accounting",
      leadFacts: Object.freeze({
        name: "Asha",
        qualification: "BCom",
        branchPreference: "Kochi",
        contact: "new-phone-must-not-persist",
      }),
    }),
  });
  const storedLeadSnapshot = JSON.stringify(storedLead);
  const semanticSnapshot = JSON.stringify(semantic);
  const analysisSnapshot = JSON.stringify(analysis);
  let updateCalls = 0;
  let receivedPatch;
  const updatedLead = lead({
    name: "Asha",
    phone: "stored-phone",
    qualification: "BCom",
    preferred_language: "english",
    current_course_interest_id: "course-accounting",
    branch_preference_id: "branch-kochi",
  });

  const result = await applyLeadMemory(
    { lead: storedLead, semanticNormalization: semantic, turnAnalysis: analysis },
    dependencies({
      getBranchByName: async () => ({ id: "branch-kochi", name: "Kochi" }),
      getCourseByInternalName: async () => ({
        id: "course-accounting",
        internal_name: "accounting",
      }),
      updateLead: async (id, patch) => {
        updateCalls += 1;
        assert.equal(id, "lead-1");
        receivedPatch = patch;
        return updatedLead;
      },
    }),
  );

  assert.equal(updateCalls, 1);
  assert.deepEqual(receivedPatch, {
    name: "Asha",
    qualification: "BCom",
    preferred_language: "english",
    current_course_interest_id: "course-accounting",
    branch_preference_id: "branch-kochi",
  });
  assert.equal("phone" in receivedPatch, false);
  assert.equal("lead_status" in receivedPatch, false);
  assert.equal("channel" in receivedPatch, false);
  assert.equal("channel_user_id" in receivedPatch, false);
  assert.strictEqual(result.lead, updatedLead);
  assert.deepEqual(result.changedFields, [
    "name",
    "qualification",
    "preferred_language",
    "current_course_interest_id",
    "branch_preference_id",
  ]);
  assert.equal(JSON.stringify(storedLead), storedLeadSnapshot);
  assert.equal(JSON.stringify(semantic), semanticSnapshot);
  assert.equal(JSON.stringify(analysis), analysisSnapshot);
});

test("branch, course, and Lead update failures propagate unchanged", async () => {
  const branchFailure = new Error("branch lookup failed");
  const courseFailure = new Error("course lookup failed");
  const updateFailure = new Error("lead update failed");

  await assert.rejects(
    () =>
      applyLeadMemory(
        {
          lead: lead(),
          semanticNormalization: semanticNormalization(),
          turnAnalysis: turnAnalysis({
            leadFacts: {
              name: null,
              qualification: null,
              branchPreference: "Kochi",
              contact: null,
            },
          }),
        },
        dependencies({
          getBranchByName: async () => {
            throw branchFailure;
          },
        }),
      ),
    (error) => error === branchFailure,
  );

  await assert.rejects(
    () =>
      applyLeadMemory(
        {
          lead: lead(),
          semanticNormalization: semanticNormalization({
            preservedEntities: [{ type: "course", value: "Accounting" }],
          }),
          turnAnalysis: turnAnalysis({ course: "accounting" }),
        },
        dependencies({
          getCourseByInternalName: async () => {
            throw courseFailure;
          },
        }),
      ),
    (error) => error === courseFailure,
  );

  await assert.rejects(
    () =>
      applyLeadMemory(
        {
          lead: lead(),
          semanticNormalization: semanticNormalization(),
          turnAnalysis: turnAnalysis({
            leadFacts: {
              name: "Asha",
              qualification: null,
              branchPreference: null,
              contact: null,
            },
          }),
        },
        dependencies({
          updateLead: async () => {
            throw updateFailure;
          },
        }),
      ),
    (error) => error === updateFailure,
  );
});
