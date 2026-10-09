"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { isApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toastStore";
import { WITHDRAWAL_REASONS, useWithdraw, type WithdrawalReason } from "../api";

const field =
  "border-line-strong focus:border-brand w-full rounded-xl border bg-white px-3 text-[15px] outline-none";

/** /settings/withdraw — iOS WithdrawView(회원 탈퇴)를 옮긴 것 */
export function WithdrawView() {
  const [reason, setReason] = useState<WithdrawalReason | "">("");
  const [detail, setDetail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const withdraw = useWithdraw();

  // "기타"일 때만 상세 사유가 필수 (백엔드 서비스 단 검증과 같은 규칙)
  const reasonOk =
    reason !== "" && (reason !== "OTHER" || detail.trim().length > 0);
  const canSubmit = reasonOk && agreed;

  const submit = () => {
    if (!reason) return;
    withdraw.mutate(
      { reason, detail: reason === "OTHER" ? detail.trim() : "" },
      {
        onError: (e) => {
          setConfirmOpen(false);
          toast.error(
            isApiError(e)
              ? e.message
              : "탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.",
          );
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/settings">설정</Link>}
        title="회원 탈퇴"
      />

      <Card className="mt-6 max-w-2xl p-5 sm:p-6">
        <h2 className="text-[18px] font-bold">정말 탈퇴하실건가요?</h2>
        <p className="text-ink-3 mt-3 text-[13px] font-medium">
          탈퇴 시 유의사항
        </p>
        <ul className="text-ink-3 mt-1 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
          <li>
            수집된 개인정보 및 나를 계정에 저장된 모든 정보(목표, 루틴, 일정,
            미션과 관련된 모든 컨텐츠)는 삭제되어 복구할 수 없고 연결된 기기의
            연결이 해제됩니다.
          </li>
        </ul>

        <label className="mt-6 block">
          <span className="text-ink-2 mb-1.5 block text-[14px] font-semibold">
            떠나시는 이유를 알려주세요 <span className="text-danger">*</span>
          </span>
          <select
            value={reason}
            onChange={(e) => {
              const next = e.target.value as WithdrawalReason;
              setReason(next);
              if (next !== "OTHER") setDetail("");
            }}
            className={cn(field, "h-11")}
          >
            <option value="" disabled>
              탈퇴 사유 선택
            </option>
            {WITHDRAWAL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        {reason === "OTHER" && (
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="탈퇴 사유를 자유롭게 적어주세요"
            aria-label="탈퇴 상세 사유"
            className={cn(
              field,
              "placeholder:text-ink-4 mt-3 resize-none py-3 leading-relaxed",
            )}
          />
        )}

        <label className="mt-6 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
              "peer-focus-visible:outline-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              agreed
                ? "border-brand bg-brand text-white"
                : "border-line-strong bg-white",
            )}
            aria-hidden
          >
            {agreed && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="text-ink-2 text-[14px]">
            회원 탈퇴 유의 사항을 확인했으며 동의합니다.
          </span>
        </label>

        <Button
          variant="danger"
          size="lg"
          fullWidth
          className="mt-5"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
        >
          탈퇴하기
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="정말 탈퇴하시겠어요?"
        description="이 작업은 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        tone="danger"
        loading={withdraw.isPending || withdraw.isSuccess}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </>
  );
}
