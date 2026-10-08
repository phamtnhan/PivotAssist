import assert from "node:assert/strict";
import test from "node:test";
import { parseResumeText } from "@pivotassist/free-ai";
import { resumeDerivedReplacePolicy } from "./resume-derived.ts";

test("weak parse does not authorize wiping skills or experiences", () => {
  const policy = resumeDerivedReplacePolicy({
    extractedSkills: [],
    experiences: [],
    fullName: "Nguyễn Văn A",
  });
  assert.equal(policy.replaceSkills, false);
  assert.equal(policy.replaceExperiences, false);
  assert.equal(policy.updateFullName, true);
});

test("designed Vietnamese header is a name, not the Tôi là intro", () => {
  const parsed = parseResumeText(
    [
      "PHẠM",
      "MỸ LINH",
      "Chuyên gia Tôi là kỹ sư phần mềm với hơn 5 năm kinh nghiệm làm việc trong",
      "Phần mềm ngành công nghệ, cung cấp chuyên môn có giá trị cho các công ty",
      "gỡ lỗi phần mềm.",
    ].join("\n"),
  );
  assert.equal(parsed.fullName, "PHẠM MỸ LINH");
  assert.equal(parsed.currentJobTitle, "Chuyên gia");
  assert.equal(parsed.extractedSkills.includes("Go"), false);
});

test("short catalog skill Go only matches the real token", () => {
  const hit = parseResumeText("Backend engineer using Go and Rust in production.");
  assert.equal(hit.extractedSkills.includes("Go"), true);
  assert.equal(hit.extractedSkills.includes("Rust"), true);
});

test("extracts Vietnamese skills and multi-line experience from 2-column layout resume", () => {
  const parsed = parseResumeText(
    [
      "PHẠM",
      "MỸ LINH",
      "LĨNH VỰC CHUYÊN MÔN",
      "thành thạo nhiều ngôn ngữ lập trình cũng như viết mã, cùng với kiểm thử và gỡ lỗi phần mềm.",
      "123 Đường ABC, KINH NGHIỆM LÀM VIỆC",
      "Thành phố DEF",
      "Kỹ sư phần mềm cao cấp",
      "xinchao@trangwebhay.vn",
      "www.trangwebhay.vn Công ty VietMind | Tháng 5 năm 2033 - Hiện tại",
      "Quản lý một nhóm gồm 20 kỹ sư, đảm bảo việc cung cấp dự án thành công",
      "Kỹ sư Phần mềm",
      "Tập đoàn V-Bits | Tháng 5 năm 2030 - Tháng 3 năm 2033",
      "Triển khai kiểm thử tự động, giảm thời gian ngừng hoạt động của hệ thống xuống 30%",
    ].join("\n"),
  );

  assert.equal(parsed.fullName, "PHẠM MỸ LINH");
  assert.equal(parsed.extractedSkills.includes("Lập trình"), true);
  assert.equal(parsed.extractedSkills.includes("Kiểm thử"), true);
  assert.equal(parsed.extractedSkills.includes("Gỡ lỗi"), true);
  assert.equal(parsed.experiences.length >= 2, true);
  assert.equal(parsed.experiences[0].role, "Kỹ sư phần mềm cao cấp");
  assert.equal(parsed.experiences[0].company, "Công ty VietMind");
  assert.equal(parsed.experiences[1].role, "Kỹ sư Phần mềm");
  assert.equal(parsed.experiences[1].company, "Tập đoàn V-Bits");
});
