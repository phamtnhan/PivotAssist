"use client";

import { useState } from "react";
import { Check, NotePencil, Sparkle, Warning } from "@phosphor-icons/react";
import { apiErrorText } from "@/lib/api-errors";
import type { Locale } from "@/lib/i18n";

type ReviewRow = {
  id: string;
  reviewerId: string;
  reviewerName?: string | null;
  status: string;
  overallRecommendation?: string | null;
  strengths?: string | null;
  concerns?: string | null;
  comment?: string | null;
  privateNote?: string | null;
  hiddenUntilYouSubmit?: boolean;
};

type OfferRow = {
  id: string;
  status: string;
  title: string;
  compensationAmount: number;
  currency: string;
  employmentType: string;
  location: string | null;
  startDate: string | null;
  benefits: string | null;
  terms: string | null;
  expiresAt: string | null;
  approvals?: Array<{ id: string; approverName: string; status: string; orderIndex: number }>;
};

const ACTIONS = [
  { id: "NEXT_INTERVIEW", vi: "Mời vòng tiếp theo", en: "Invite to next interview" },
  { id: "ADDITIONAL_ASSESSMENT", vi: "Cần bổ sung thông tin", en: "Ask for more information" },
  { id: "HOLD", vi: "Giữ hồ sơ", en: "Hold" },
  { id: "REJECT", vi: "Hồ sơ chưa phù hợp", en: "Not a fit" },
  { id: "PROCEED_TO_OFFER", vi: "Soạn đề nghị", en: "Prepare offer" },
] as const;

export function EnterpriseReviewWorkspace(props: {
  locale: Locale;
  applicationId: string;
  candidateName: string;
  status: string;
  interviewId?: string;
  recommendation?: string | null;
  summaryText?: string | null;
  initialReviews: ReviewRow[];
  initialOffer: OfferRow | null;
  onStatus: (status: string) => void;
  onNotice: (message: string) => void;
}) {
  const vi = props.locale !== "en";
  const [action, setAction] = useState<(typeof ACTIONS)[number]["id"]>("NEXT_INTERVIEW");
  const [internalReason, setInternalReason] = useState("");
  const [candidateMessage, setCandidateMessage] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState(props.initialReviews);
  const [offer, setOffer] = useState(props.initialOffer);
  const [scorecard, setScorecard] = useState({
    overallRecommendation: "ADVANCE",
    strengths: "",
    concerns: "",
    comment: "",
    privateNote: "",
  });
  const [offerForm, setOfferForm] = useState({
    compensationAmount: offer?.compensationAmount ? String(offer.compensationAmount) : "",
    currency: offer?.currency ?? "VND",
    location: offer?.location ?? "",
    terms: offer?.terms ?? "",
    benefits: offer?.benefits ?? "",
  });

  const decide = async () => {
    if (action === "REJECT" && !confirmReject) {
      setConfirmReject(true);
      props.onNotice(
        vi
          ? "Xác nhận lần nữa để từ chối hồ sơ. Lý do nội bộ không gửi cho ứng viên."
          : "Confirm again to close this file. The internal reason is not sent to the applicant.",
      );
      return;
    }
    if (action === "REJECT" && !internalReason.trim()) {
      props.onNotice(
        vi ? "Nhập lý do nội bộ trước khi từ chối." : "Enter an internal reason before rejecting.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/enterprise/applications/${encodeURIComponent(props.applicationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            internalReason: internalReason.trim() || undefined,
            candidateMessage: candidateMessage.trim() || undefined,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(
          apiErrorText(
            payload,
            props.locale,
            vi ? "Không thể lưu quyết định." : "Could not save the decision.",
          ),
        );
      if (payload.application?.status) props.onStatus(payload.application.status);
      if (payload.offer) {
        setOffer(payload.offer);
        setOfferForm((current) => ({
          ...current,
          compensationAmount: payload.offer.compensationAmount
            ? String(payload.offer.compensationAmount)
            : current.compensationAmount,
          currency: payload.offer.currency ?? current.currency,
        }));
      }
      setConfirmReject(false);
      props.onNotice(
        payload.already
          ? vi
            ? "Quyết định đã được ghi nhận trước đó."
            : "This decision was already recorded."
          : vi
            ? "Đã lưu quyết định."
            : "Decision saved.",
      );
    } catch (error) {
      props.onNotice(
        error instanceof Error
          ? error.message
          : vi
            ? "Không thể lưu quyết định."
            : "Could not save the decision.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async (status: "DRAFT" | "SUBMITTED") => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/enterprise/applications/${encodeURIComponent(props.applicationId)}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scorecard, status, sessionId: props.interviewId }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(
          apiErrorText(
            payload,
            props.locale,
            vi ? "Không lưu được phiếu." : "Could not save the scorecard.",
          ),
        );
      if (payload.reviews) setReviews(payload.reviews);
      props.onNotice(
        status === "SUBMITTED"
          ? vi
            ? "Đã nộp phiếu đánh giá."
            : "Scorecard submitted."
          : vi
            ? "Đã lưu nháp phiếu."
            : "Scorecard draft saved.",
      );
    } catch (error) {
      props.onNotice(
        error instanceof Error
          ? error.message
          : vi
            ? "Không lưu được phiếu."
            : "Could not save the scorecard.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveOffer = async () => {
    if (!offer) return;
    const amount = Number(offerForm.compensationAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      props.onNotice(
        vi
          ? "Mức thù lao phải là số nguyên dương."
          : "Compensation must be a positive whole number.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/enterprise/offers/${encodeURIComponent(offer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compensationAmount: amount,
          currency: offerForm.currency,
          location: offerForm.location || null,
          terms: offerForm.terms || null,
          benefits: offerForm.benefits || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(
          apiErrorText(
            payload,
            props.locale,
            vi ? "Không lưu được đề nghị." : "Could not save the offer.",
          ),
        );
      setOffer((current) => (current ? { ...current, ...payload.offer } : payload.offer));
      props.onNotice(
        vi
          ? "Đã lưu đề nghị. Nếu đã duyệt, sửa mức lương sẽ mở lại bước duyệt."
          : "Offer saved. Changing pay after approval restarts approval.",
      );
    } catch (error) {
      props.onNotice(
        error instanceof Error
          ? error.message
          : vi
            ? "Không lưu được đề nghị."
            : "Could not save the offer.",
      );
    } finally {
      setBusy(false);
    }
  };

  const requestAndApproveSend = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const self = await fetch(`/api/auth/me`, { cache: "no-store" }).then((response) =>
        response.json().catch(() => null),
      );
      const approverId = self?.user?.userId ?? self?.user?.id;
      if (!approverId)
        throw new Error(
          vi ? "Không xác định được người duyệt." : "Could not resolve the approver.",
        );
      const requested = await fetch(
        `/api/enterprise/offers/${encodeURIComponent(offer.id)}/approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approverIds: [approverId], sequential: true }),
        },
      );
      const requestedPayload = await requested.json().catch(() => null);
      if (!requested.ok || !requestedPayload?.success)
        throw new Error(
          apiErrorText(
            requestedPayload,
            props.locale,
            vi ? "Không gửi duyệt được." : "Could not request approval.",
          ),
        );
      const decided = await fetch(
        `/api/enterprise/offers/${encodeURIComponent(offer.id)}/approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "APPROVED" }),
        },
      );
      const decidedPayload = await decided.json().catch(() => null);
      if (!decided.ok || !decidedPayload?.success)
        throw new Error(
          apiErrorText(
            decidedPayload,
            props.locale,
            vi ? "Không duyệt được." : "Could not approve.",
          ),
        );
      const sent = await fetch(`/api/enterprise/offers/${encodeURIComponent(offer.id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const sentPayload = await sent.json().catch(() => null);
      if (!sent.ok || !sentPayload?.success)
        throw new Error(
          apiErrorText(
            sentPayload,
            props.locale,
            vi ? "Không gửi được đề nghị." : "Could not send the offer.",
          ),
        );
      setOffer(sentPayload.offer);
      props.onStatus("OFFER_PENDING");
      props.onNotice(vi ? "Đã duyệt và gửi đề nghị cho ứng viên." : "Offer approved and sent.");
    } catch (error) {
      props.onNotice(
        error instanceof Error
          ? error.message
          : vi
            ? "Không gửi được đề nghị."
            : "Could not send the offer.",
      );
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/enterprise/offers/${encodeURIComponent(offer.id)}/withdraw`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(
          apiErrorText(
            payload,
            props.locale,
            vi ? "Không thu hồi được đề nghị." : "Could not withdraw the offer.",
          ),
        );
      setOffer(payload.offer);
      props.onStatus("HOLD");
      props.onNotice(vi ? "Đã thu hồi đề nghị." : "Offer withdrawn.");
    } catch (error) {
      props.onNotice(
        error instanceof Error
          ? error.message
          : vi
            ? "Không thu hồi được đề nghị."
            : "Could not withdraw the offer.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
          <Sparkle size={17} className="text-accent-deep" />
          {vi
            ? "Gợi ý của hệ thống (chỉ hỗ trợ quyết định)"
            : "System suggestion (decision support only)"}
        </div>
        <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">
          {vi
            ? "Gợi ý này không tự loại hay nhận. Người phụ trách phải xác nhận."
            : "This suggestion does not hire or reject anyone. A human must confirm."}
        </p>
        <div className="mt-3 text-[13px] text-ink">
          <span className="font-bold">{vi ? "Gợi ý:" : "Suggestion:"}</span>{" "}
          {props.recommendation === "ADVANCE"
            ? vi
              ? "Nên xem vòng tiếp"
              : "Consider next round"
            : props.recommendation === "HOLD"
              ? vi
                ? "Nên xem thêm"
                : "Review further"
              : props.recommendation === "REJECT"
                ? vi
                  ? "Có rủi ro khớp vị trí"
                  : "May not fit this role"
                : vi
                  ? "Chưa có"
                  : "None yet"}
        </div>
        {props.summaryText ? (
          <p className="mt-2 text-[12.5px] text-ink-soft leading-relaxed">{props.summaryText}</p>
        ) : null}
      </section>

      <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
          <NotePencil size={17} className="text-accent-deep" />
          {vi ? "Phiếu đánh giá của bạn" : "Your scorecard"}
        </div>
        <label className="block mt-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Khuyến nghị" : "Recommendation"}
          <select
            value={scorecard.overallRecommendation}
            onChange={(event) =>
              setScorecard((current) => ({ ...current, overallRecommendation: event.target.value }))
            }
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          >
            <option value="ADVANCE">{vi ? "Mời vòng tiếp" : "Advance"}</option>
            <option value="HOLD">{vi ? "Giữ hồ sơ" : "Hold"}</option>
            <option value="REJECT">{vi ? "Chưa phù hợp" : "Not a fit"}</option>
            <option value="OFFER">{vi ? "Soạn đề nghị" : "Prepare offer"}</option>
          </select>
        </label>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Điểm mạnh" : "Strengths"}
          <textarea
            value={scorecard.strengths}
            onChange={(event) =>
              setScorecard((current) => ({ ...current, strengths: event.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Điểm cần xem" : "Concerns"}
          <textarea
            value={scorecard.concerns}
            onChange={(event) =>
              setScorecard((current) => ({ ...current, concerns: event.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Nhận xét" : "Comment"}
          <textarea
            value={scorecard.comment}
            onChange={(event) =>
              setScorecard((current) => ({ ...current, comment: event.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Ghi chú riêng (chỉ bạn thấy)" : "Private note (only you)"}
          <textarea
            value={scorecard.privateNote}
            onChange={(event) =>
              setScorecard((current) => ({ ...current, privateNote: event.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveReview("DRAFT")}
            className="inline-flex items-center gap-1.5 border border-mist-dark rounded-xl px-3 py-2 text-[12px] font-bold disabled:opacity-60"
          >
            {vi ? "Lưu nháp" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveReview("SUBMITTED")}
            className="inline-flex items-center gap-1.5 bg-ink text-white rounded-xl px-3 py-2 text-[12px] font-bold disabled:opacity-60"
          >
            <Check size={14} /> {vi ? "Nộp phiếu" : "Submit"}
          </button>
        </div>
        {reviews.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[12.5px] text-ink-soft">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-mist px-3 py-2">
                <div className="font-bold text-ink">
                  {review.reviewerName ?? review.reviewerId} ·{" "}
                  {review.status === "SUBMITTED"
                    ? vi
                      ? "Đã nộp"
                      : "Submitted"
                    : vi
                      ? "Nháp"
                      : "Draft"}
                </div>
                {review.hiddenUntilYouSubmit ? (
                  <div>
                    {vi
                      ? "Nộp phiếu của bạn để xem đánh giá người khác."
                      : "Submit your scorecard to see other reviews."}
                  </div>
                ) : review.comment ? (
                  <div>{review.comment}</div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
          <Warning size={17} className="text-accent-deep" />
          {vi ? "Quyết định tuyển dụng" : "Hiring decision"}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAction(item.id);
                setConfirmReject(false);
              }}
              className={`rounded-xl border px-3 py-2 text-left text-[12.5px] font-bold ${action === item.id ? "border-accent-deep bg-accent-deep/5 text-accent-deep" : "border-mist-dark text-ink"}`}
            >
              {vi ? item.vi : item.en}
            </button>
          ))}
        </div>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Lý do nội bộ (không gửi ứng viên)" : "Internal reason (not sent to the applicant)"}
          <textarea
            value={internalReason}
            onChange={(event) => setInternalReason(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
          {vi ? "Lời nhắn gửi ứng viên (tuỳ chọn)" : "Message for the applicant (optional)"}
          <textarea
            value={candidateMessage}
            onChange={(event) => setCandidateMessage(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide()}
          className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white disabled:opacity-60 ${action === "REJECT" ? "bg-[#C5221F]" : "bg-accent-deep"}`}
        >
          {action === "REJECT" && confirmReject
            ? vi
              ? `Xác nhận từ chối ${props.candidateName}`
              : `Confirm reject ${props.candidateName}`
            : vi
              ? "Lưu quyết định"
              : "Save decision"}
        </button>
      </section>

      {offer ? (
        <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="text-[14px] font-bold text-ink">
            {vi ? "Đề nghị tuyển dụng" : "Offer"}
          </div>
          <p className="text-[12px] text-ink-soft mt-1">
            {vi ? "Trạng thái:" : "Status:"} {offer.status}
          </p>
          <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            {vi ? "Mức thù lao (số nguyên)" : "Compensation (whole number)"}
            <input
              value={offerForm.compensationAmount}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, compensationAmount: event.target.value }))
              }
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            {vi ? "Đơn vị tiền" : "Currency"}
            <input
              value={offerForm.currency}
              onChange={(event) =>
                setOfferForm((current) => ({
                  ...current,
                  currency: event.target.value.toUpperCase(),
                }))
              }
              className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            {vi ? "Địa điểm" : "Location"}
            <input
              value={offerForm.location}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, location: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            {vi ? "Phúc lợi" : "Benefits"}
            <textarea
              value={offerForm.benefits}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, benefits: event.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="block mt-3 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            {vi ? "Điều khoản" : "Terms"}
            <textarea
              value={offerForm.terms}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, terms: event.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveOffer()}
              className="inline-flex items-center gap-1.5 border border-mist-dark rounded-xl px-3 py-2 text-[12px] font-bold disabled:opacity-60"
            >
              {vi ? "Lưu đề nghị" : "Save offer"}
            </button>
            {offer.status !== "SENT" &&
            offer.status !== "ACCEPTED" &&
            offer.status !== "WITHDRAWN" &&
            offer.status !== "EXPIRED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void requestAndApproveSend()}
                className="inline-flex items-center gap-1.5 bg-accent-deep text-white rounded-xl px-3 py-2 text-[12px] font-bold disabled:opacity-60"
              >
                {vi ? "Duyệt và gửi" : "Approve and send"}
              </button>
            ) : null}
            {offer.status === "SENT" ||
            offer.status === "APPROVED" ||
            offer.status === "APPROVAL_PENDING" ||
            offer.status === "DRAFT" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void withdraw()}
                className="inline-flex items-center gap-1.5 border border-[#C5221F] text-[#C5221F] rounded-xl px-3 py-2 text-[12px] font-bold disabled:opacity-60"
              >
                {vi ? "Thu hồi đề nghị" : "Withdraw offer"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
