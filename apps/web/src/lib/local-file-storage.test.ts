import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { resolveLocalDataAbsolutePath } from "./local-file-storage.ts";

test("resolveLocalDataAbsolutePath rejects path traversal and invalid prefix", () => {
  const cwd = "C:\\repo";
  // Safe cases
  assert.equal(
    resolveLocalDataAbsolutePath("local:resumes/user_1/cv.pdf", cwd),
    path.resolve(cwd, ".data", "resumes", "user_1", "cv.pdf"),
  );
  assert.equal(
    resolveLocalDataAbsolutePath("local:uploads/documents/doc.docx", cwd),
    path.resolve(cwd, ".data", "uploads", "documents", "doc.docx"),
  );

  // Traversal attacks
  assert.equal(resolveLocalDataAbsolutePath("local:../windows/win.ini", cwd), null);
  assert.equal(resolveLocalDataAbsolutePath("local:resumes/../../etc/passwd", cwd), null);
  assert.equal(resolveLocalDataAbsolutePath("local:..\\..\\windows\\system32", cwd), null);
  assert.equal(resolveLocalDataAbsolutePath("local:resumes/user/../../../secret.env", cwd), null);

  // Null byte injection
  assert.equal(resolveLocalDataAbsolutePath("local:resumes/user/cv.pdf\0.png", cwd), null);

  // Invalid prefixes
  assert.equal(resolveLocalDataAbsolutePath("/etc/passwd", cwd), null);
  assert.equal(resolveLocalDataAbsolutePath("https://evil.com/cv.pdf", cwd), null);
  assert.equal(resolveLocalDataAbsolutePath("", cwd), null);
});
