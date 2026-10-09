"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Chip";
import type { SessionUserView } from "@/components/layout/types";
import { ProfileEditModal } from "./ProfileEditModal";

/** 설정 맨 위 프로필 요약 (iOS SettingProfileSummary) */
export function ProfileSummaryCard({ user }: { user: SessionUserView }) {
  const [editing, setEditing] = useState(false);
  // 모달을 열 때마다 현재 이름으로 입력칸을 새로 채우려고 key 를 바꿔요
  const [modalKey, setModalKey] = useState(0);
  const role = user.role ?? "FREE";

  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8EA2FF] to-[#B49CFF] text-lg font-bold text-white">
        {user.name.slice(0, 1)}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Badge tone={role === "FREE" ? "neutral" : "brand"}>{role}</Badge>
        <p className="truncate text-[18px] font-bold">{user.name}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setModalKey((k) => k + 1);
          setEditing(true);
        }}
      >
        프로필 수정
      </Button>
      <ProfileEditModal
        key={modalKey}
        open={editing}
        currentName={user.name}
        onClose={() => setEditing(false)}
      />
    </Card>
  );
}
