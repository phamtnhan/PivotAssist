"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Lock, WarningCircle } from "@phosphor-icons/react";
import { apiErrorText } from "@/lib/api-errors";
import { useLocale } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const { locale } = useLocale();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const english = locale === "en";

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!token) {
      setError(english ? "The reset link is missing." : "Liên kết khôi phục không có token.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(english ? "The passwords do not match." : "Hai mật khẩu không khớp.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setError(
          apiErrorText(
            payload,
            locale,
            english ? "Could not reset the password." : "Không thể đặt lại mật khẩu.",
          ),
        );
        return;
      }
      setSuccess(
        payload.message ??
          (english
            ? "Password reset. You can sign in now."
            : "Đã đặt lại mật khẩu. Bạn có thể đăng nhập."),
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(english ? "Could not reach the server." : "Không kết nối được máy chủ.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-16 text-[#121317]">
      <section className="mx-auto max-w-[440px] rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#1A73E8]">
            <Lock size={20} />
          </div>
          <h1 className="text-2xl font-[450]">{english ? "Reset password" : "Đặt lại mật khẩu"}</h1>
          <p className="mt-2 text-[13px] leading-6 text-[#5F6368]">
            {english
              ? "Choose a new password for your PivotAssist account."
              : "Chọn mật khẩu mới cho tài khoản PivotAssist."}
          </p>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-5 flex gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] p-3.5 text-[12.5px] text-[#C5221F]"
          >
            <WarningCircle size={17} weight="fill" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mb-5 flex gap-2 rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] p-3.5 text-[12.5px] text-[#137333]"
          >
            <CheckCircle size={17} weight="fill" className="shrink-0" />
            <span>{success}</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-[12.5px] font-[450]">
            {english ? "New password" : "Mật khẩu mới"}
            <input
              type="password"
              minLength={6}
              maxLength={128}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-[rgba(33,34,38,0.14)] bg-[#F8F9FA] px-4 py-2.5 text-[13.5px] focus:border-[#1A73E8] focus:bg-white focus:outline-none"
            />
          </label>
          <label className="block text-[12.5px] font-[450]">
            {english ? "Confirm password" : "Xác nhận mật khẩu"}
            <input
              type="password"
              minLength={6}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-[rgba(33,34,38,0.14)] bg-[#F8F9FA] px-4 py-2.5 text-[13.5px] focus:border-[#1A73E8] focus:bg-white focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#121317] py-3 text-[13.5px] font-[450] text-white transition-opacity disabled:opacity-60"
          >
            {isSaving
              ? english
                ? "Saving…"
                : "Đang lưu…"
              : english
                ? "Reset password"
                : "Đặt lại mật khẩu"}
            <ArrowRight size={15} />
          </button>
        </form>
        <Link
          href="/login"
          className="mt-5 block text-center text-[12.5px] text-[#1A73E8] hover:underline"
        >
          {english ? "Back to sign in" : "Quay lại đăng nhập"}
        </Link>
      </section>
    </main>
  );
}
