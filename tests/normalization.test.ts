import { describe, it, expect } from "vitest";
import {
  normalizeRecord,
  parseFrontmatterLenient,
  deriveTitle,
  usableUrl,
} from "../scripts/ingest-content.mjs";
import { ogImageFor, tagSlug, abs } from "../src/lib/site";

/**
 * The normalisation contract, asserted directly.
 *
 * These are deliberately framed as rules rather than as implementation
 * details, so that a parallel variant built against the same rules can run the
 * same file and be compared objectively rather than by reading two codebases.
 */

const fm = (body: string) => `---\n${body}\n---\n\nSome body text.\n`;

describe("the one real rule — publish", () => {
  it("excludes an entry with publish: false", () => {
    expect(normalizeRecord(fm("title: Gone\npublish: false"), "Gone.md")).toBeNull();
  });

  it("INCLUDES an entry with no publish field at all", () => {
    // 1321 of 1764 corpus files have no `publish` line. Filtering on
    // `publish === true` would silently drop ~75% of the corpus.
    const rec = normalizeRecord(fm("title: Present"), "Present.md");
    expect(rec).not.toBeNull();
    expect(rec!.title).toBe("Present");
  });

  it("includes an entry with publish: true", () => {
    expect(normalizeRecord(fm("title: Yes\npublish: true"), "Yes.md")).not.toBeNull();
  });
});

describe("the filename is the baseline, not a fallback", () => {
  it("an entirely empty file still yields a non-empty title and slug", () => {
    const rec = normalizeRecord("", "Empty Tool Test.md");
    expect(rec).not.toBeNull();
    expect(rec!.title).toBe("Empty Tool Test");
    expect(rec!.slug).toBe("empty-tool-test");
  });

  it("a file with frontmatter delimiters but no keys still yields a title", () => {
    const rec = normalizeRecord("---\n---\n", "Bare Delimiters.md");
    expect(rec!.title).toBe("Bare Delimiters");
  });

  it("never returns an empty title", () => {
    for (const [raw, file] of [
      ["", "A.md"],
      [fm('title: ""'), "B.md"],
      [fm("title: []"), "C.md"],
    ] as const) {
      expect(normalizeRecord(raw, file)!.title.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("title precedence: title → og_title → site_name → og_site_name → filename", () => {
  it("prefers title when every candidate is present", () => {
    const data = {
      title: "From title",
      og_title: "From og_title",
      site_name: "From site_name",
      og_site_name: "From og_site_name",
    };
    expect(deriveTitle(data, "File.md")).toBe("From title");
  });

  it("falls through the chain in order", () => {
    expect(deriveTitle({ og_title: "B", site_name: "C", og_site_name: "D" }, "F.md")).toBe("B");
    expect(deriveTitle({ site_name: "C", og_site_name: "D" }, "F.md")).toBe("C");
    expect(deriveTitle({ og_site_name: "D" }, "F.md")).toBe("D");
    expect(deriveTitle({}, "Some File.md")).toBe("Some File");
  });
});

describe("for_clients is an input and never an output", () => {
  const raw = fm(
    ["title: Client Tool", "for_clients:", "  - Hypernova", "  - Avalanche", "  - Humain"].join("\n")
  );

  it("never appears in the serialized record", () => {
    const rec = normalizeRecord(raw, "Client Tool.md");
    const json = JSON.stringify(rec);
    expect(json).not.toContain("for_clients");
    expect(json).not.toContain("Hypernova");
    expect(json).not.toContain("Avalanche");
    expect(json).not.toContain("Humain");
  });

  it("survives only as a name-free boolean", () => {
    expect(normalizeRecord(raw, "Client Tool.md")!.fieldTested).toBe(true);
    expect(normalizeRecord(fm("title: Plain"), "Plain.md")!.fieldTested).toBe(false);
  });

  it("also handles the inline flow form", () => {
    const inline = fm("title: T\nfor_clients: [Hypernova, Avalanche]");
    const rec = normalizeRecord(inline, "T.md");
    expect(rec!.fieldTested).toBe(true);
    expect(JSON.stringify(rec)).not.toContain("Hypernova");
  });
});

describe("og_image sanity", () => {
  it('treats the stringified empty array "[]" as no image', () => {
    expect(usableUrl("[]")).toBeNull();
    expect(normalizeRecord(fm('title: T\nog_image: "[]"'), "T.md")!.ogImage).toBe("");
  });

  it("rejects bare [], empty strings and the literal word undefined", () => {
    expect(usableUrl("")).toBeNull();
    expect(usableUrl("undefined")).toBeNull();
    expect(usableUrl("not-a-url")).toBeNull();
    expect(usableUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });

  it("falls back to a stable, absolute house card when there is no image", () => {
    const a = ogImageFor("some-tool", "");
    const b = ogImageFor("some-tool", "[]");
    expect(a).toBe(b); // deterministic — the unfurler cache stays coherent
    expect(a.startsWith("https://")).toBe(true);
    expect(a.endsWith(".jpg")).toBe(true);
  });

  it("passes a real og_image through untouched", () => {
    expect(ogImageFor("x", "https://vendor.example/og.png")).toBe("https://vendor.example/og.png");
  });
});

describe("both tag syntaxes parse to the same shape", () => {
  const expected = ["Agentic-AI", "AI-Toolkit", "Check-It-Out"];

  it("inline flow style", () => {
    const rec = normalizeRecord(fm("title: T\ntags: [Agentic-AI, AI-Toolkit, Check-It-Out]"), "T.md");
    expect(rec!.tags).toEqual(expected);
  });

  it("block list style", () => {
    const rec = normalizeRecord(
      fm("title: T\ntags:\n  - Agentic-AI\n  - AI-Toolkit\n  - Check-It-Out"),
      "T.md"
    );
    expect(rec!.tags).toEqual(expected);
  });

  it("an empty tag list is an empty array, not a crash", () => {
    expect(normalizeRecord(fm("title: T\ntags: []"), "T.md")!.tags).toEqual([]);
    expect(normalizeRecord(fm("title: T"), "T.md")!.tags).toEqual([]);
  });
});

describe("leniency — a bad key drops the key, never the document", () => {
  it("survives a malformed value and keeps the other keys", () => {
    const raw = [
      "---",
      "title: Survivor",
      "url: https://example.com",
      "broken: [unclosed, list",
      "tags: [A, B]",
      "---",
      "",
      "Body.",
    ].join("\n");
    const rec = normalizeRecord(raw, "Survivor.md");
    expect(rec).not.toBeNull();
    expect(rec!.title).toBe("Survivor");
    expect(rec!.url).toBe("https://example.com");
  });

  it("survives a stray tab and an unquoted colon", () => {
    const raw = ["---", "title: A: B", "\tstray: value", "url: https://x.dev", "---", "", "Body."].join(
      "\n"
    );
    expect(() => normalizeRecord(raw, "Messy.md")).not.toThrow();
    expect(normalizeRecord(raw, "Messy.md")).not.toBeNull();
  });

  it("a file with no frontmatter at all is still a document", () => {
    const { data, body } = parseFrontmatterLenient("# Just a heading\n\nProse.", "NoFm.md");
    expect(data).toEqual({});
    expect(body).toContain("Just a heading");
  });
});

describe("share metadata invariants", () => {
  it("every URL the meta layer emits is absolute", () => {
    expect(abs("/tools/foo/")).toBe("https://lossless-toolkit.pages.dev/tools/foo/");
    expect(abs("https://vendor.example/x.jpg")).toBe("https://vendor.example/x.jpg");
  });

  it("tag slugs are URL-safe and stable", () => {
    expect(tagSlug("Agentic-AI")).toBe("agentic-ai");
    expect(tagSlug("R&D Tools")).toBe("r-and-d-tools");
    expect(tagSlug("  Spaced  Out  ")).toBe("spaced-out");
  });
});
